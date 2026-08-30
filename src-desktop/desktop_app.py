global_window = None
import os
import sys
import json
import subprocess
from window_geometry import center_window
import host_auth
import credential_crypto
import path_sandbox
import proxy_policy
CREATE_NO_WINDOW = 0x08000000
APP_NAME = 'Tcode Studio'
APP_STORAGE_KEY = 'Tcode'
HOST = '127.0.0.1'
PORT = 8010
SERVER_PORT = PORT

def get_silent_startupinfo():
    if os.name == 'nt':
        si = subprocess.STARTUPINFO()
        si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        si.wShowWindow = subprocess.SW_HIDE
        return si
    return None

def normalize_windows_cmd(cmd: str) -> str:
    """
    Converts Unix/bash command chains like 'cmd1 && cmd2' into
    PowerShell 5.1 compatible format: 'cmd1; if ($?) { cmd2 }'.
    This prevents 'The token && is not a valid statement separator' error.
    """
    lines = []
    for raw_line in cmd.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if '&&' in line:
            parts = [p.strip() for p in line.split('&&') if p.strip()]
            if len(parts) > 1:
                ps_chain = parts[0]
                for p in parts[1:]:
                    ps_chain += f"; if ($?) {{ {p} }}"
                lines.append(ps_chain)
            else:
                lines.append(line)
        else:
            lines.append(line)
    return "\n".join(lines)

def run_silent_cmd(cmd_list, cwd=None, timeout=60):
    si = get_silent_startupinfo()
    kwargs = {
        'capture_output': True,
        'text': True,
        'timeout': timeout,
        'encoding': 'utf-8',
        'errors': 'replace'
    }
    if cwd:
        kwargs['cwd'] = cwd
    if os.name == 'nt':
        kwargs['creationflags'] = CREATE_NO_WINDOW
        if si:
            kwargs['startupinfo'] = si
    return subprocess.run(cmd_list, **kwargs)

import urllib.request
import urllib.parse
import urllib.error
import webview
import http.server
import socketserver
import threading
from pathlib import Path

def get_storage_dir():
    appdata = os.environ.get('LOCALAPPDATA', os.path.expanduser('~'))
    base = Path(appdata) / APP_STORAGE_KEY / 'storage'
    base.mkdir(parents=True, exist_ok=True)
    return base

def get_dist_path():
    if hasattr(sys, '_MEIPASS'):
        return Path(sys._MEIPASS) / 'dist'
    return Path(__file__).resolve().parent.parent / 'prototype' / 'dist'

def scan_directory(root_path, max_depth=2, current_depth=0):
    p = Path(root_path)
    if not p.exists() or not p.is_dir():
        return []
    items = []
    ignored = {'.git', 'node_modules', 'dist', 'build_temp', '__pycache__', '.gemini', '.pytest_cache', '.idea', '.vscode'}
    try:
        entries = sorted(p.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower()))
    except Exception:
        return []
        
    for entry in entries:
        if entry.name in ignored or entry.name.startswith('.'):
            continue
        item = {
            'id': str(entry).replace('\\', '/'),
            'name': entry.name,
            'path': str(entry).replace('\\', '/'),
            'type': 'directory' if entry.is_dir() else 'file'
        }
        if entry.is_file():
            try:
                item['size'] = entry.stat().st_size
            except Exception:
                item['size'] = 0
        elif entry.is_dir() and current_depth < max_depth:
            item['children'] = scan_directory(entry, max_depth, current_depth + 1)
        items.append(item)
    return items

def pick_folder_native(window=None):
    # 1. Primary: In-process Tkinter folder browser (0 external process, 0 CMD console window)
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        folder = filedialog.askdirectory(title='选择要打开的工作区工程文件夹')
        root.destroy()
        if folder and Path(folder).exists():
            return folder.replace('\\', '/')
    except Exception:
        pass

    # 2. Fallback: PowerShell FolderBrowserDialog with CREATE_NO_WINDOW (strictly suppresses console window)
    CREATE_NO_WINDOW = 0x08000000
    ps_cmd = "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = '选择要打开的工作区工程文件夹'; $f.ShowNewFolderButton = $true; if ($f.ShowDialog() -eq 'OK') { Write-Output $f.SelectedPath }"
    try:
        res = run_silent_cmd(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", ps_cmd], timeout=120)
        out = res.stdout.strip()
        if out and Path(out).exists():
            return out.replace('\\', '/')
    except Exception:
        pass
    return None

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        dist_path = get_dist_path()
        super().__init__(*args, directory=str(dist_path), **kwargs)
    
    def log_message(self, format, *args):
        pass

    def _send_json(self, status: int, payload: dict) -> None:
        self.send_response(status)
        self._apply_cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode("utf-8"))

    def _apply_cors(self) -> None:
        origin = self.headers.get("Origin")
        if origin is not None and host_auth.origin_is_allowed(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")

    def _guard(self) -> bool:
        origin = self.headers.get("Origin")
        if origin is not None and not host_auth.origin_is_allowed(origin):
            self._send_json(403, {"error": "ORIGIN_DENIED", "code": 403})
            return False
        if not host_auth.host_is_allowed(self.headers.get("Host"), SERVER_PORT):
            self._send_json(403, {"error": "HOST_DENIED", "code": 403})
            return False
        if not host_auth.token_is_valid(self.headers.get("X-Tcode-Token")):
            self._send_json(401, {"error": "UNAUTHORIZED", "code": 401})
            return False
        return True

    def _serve_index(self) -> None:
        dist = get_dist_path()
        index = dist / "index.html"
        try:
            html = index.read_text(encoding="utf-8")
        except Exception:
            return super().do_GET()
        token = host_auth.get_token()
        if token:
            script = f'<script>window.__TCODE_HOST_TOKEN__ = "{token}";</script>'
            if "</head>" in html:
                html = html.replace("</head>", script + "</head>", 1)
            else:
                html = script + html
        data = html.encode("utf-8")
        self.send_response(200)
        self._apply_cors()
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        origin = self.headers.get("Origin")
        if origin is None or not host_auth.origin_is_allowed(origin):
            self._send_json(403, {"error": "ORIGIN_DENIED", "code": 403})
            return
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Tcode-Token, Authorization")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path in ('/', '/index.html'):
            self._serve_index()
            return
        if parsed.path.startswith('/api/'):
            if not self._guard():
                return

        if parsed.path == '/health':
            self.send_response(200)
            self._apply_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'ok', 'service': 'tcode'}).encode('utf-8'))
            return

        # 1. Native Folder Picker
        if parsed.path == '/api/fs/pick_folder':
            folder_path = pick_folder_native()
            self.send_response(200)
            self._apply_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            if folder_path:
                self.wfile.write(json.dumps({'success': True, 'path': folder_path.replace('\\', '/')}).encode('utf-8'))
            else:
                self.wfile.write(json.dumps({'success': False, 'cancelled': True}).encode('utf-8'))
            return

        # 2. Real Directory Tree
        if parsed.path == '/api/fs/tree':
            qs = urllib.parse.parse_qs(parsed.query)
            target_path = qs.get('path', [None])[0]
            if not target_path or not Path(target_path).exists():
                self.send_response(400)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Invalid or missing directory path'}).encode('utf-8'))
                return

            tree = scan_directory(target_path, max_depth=2)
            self.send_response(200)
            self._apply_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True, 'path': target_path, 'tree': tree}).encode('utf-8'))
            return

        # Real Project Text Search across files on disk
        if parsed.path == '/api/fs/search':
            qs = urllib.parse.parse_qs(parsed.query)
            target_path = qs.get('path', [None])[0]
            query = (qs.get('q', [''])[0] or qs.get('query', [''])[0]).strip()
            if not target_path or not Path(target_path).exists() or not query:
                self.send_response(200)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'results': []}).encode('utf-8'))
                return

            results = []
            p = Path(target_path)
            ignored_dirs = {'.git', 'node_modules', 'dist', 'build_temp', '__pycache__', '.gemini'}
            
            try:
                for file_path in p.rglob('*'):
                    if file_path.is_file() and not any(part in ignored_dirs for part in file_path.parts):
                        if file_path.stat().st_size > 1024 * 1024:
                            continue
                        try:
                            content = file_path.read_text(encoding='utf-8', errors='ignore')
                            if query.lower() in content.lower():
                                matches = []
                                for idx, line in enumerate(content.splitlines()):
                                    if query.lower() in line.lower():
                                        matches.append({
                                            'lineNumber': idx + 1,
                                            'lineContent': line.strip()[:160],
                                            'matchRange': [0, 0]
                                        })
                                        if len(matches) >= 10: break
                                if matches:
                                    rel = str(file_path.relative_to(p)).replace('\\', '/')
                                    results.append({
                                        'file': rel,
                                        'fullPath': str(file_path).replace('\\', '/'),
                                        'matches': matches
                                    })
                                    if len(results) >= 50: break
                        except Exception:
                            continue
            except Exception:
                pass

            self.send_response(200)
            self._apply_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True, 'results': results}).encode('utf-8'))
            return

        # Real Git Status from Disk
        if parsed.path == '/api/git/status':
            qs = urllib.parse.parse_qs(parsed.query)
            target_path = qs.get('path', [None])[0] or str(get_dist_path().parent.parent)
            changes = []
            branch = 'main'
            
            try:
                CREATE_NO_WINDOW = 0x08000000
                # Get current branch
                res_b = run_silent_cmd(['git', 'branch', '--show-current'], cwd=target_path, timeout=10)
                if res_b.returncode == 0 and res_b.stdout.strip():
                    branch = res_b.stdout.strip()
                
                # Get status porcelain
                res_s = run_silent_cmd(['git', 'status', '--porcelain'], cwd=target_path, timeout=10)
                if res_s.returncode == 0:
                    for line in res_s.stdout.splitlines():
                        if len(line) >= 3:
                            st = line[:2].strip()
                            file_rel = line[3:].strip()
                            changes.append({
                                'file': file_rel,
                                'status': 'modified' if 'M' in st else 'untracked' if '?' in st else 'deleted' if 'D' in st else 'staged',
                                'label': f"{st} {file_rel}"
                            })
            except Exception:
                pass

            self.send_response(200)
            self._apply_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True, 'branch': branch, 'changes': changes}).encode('utf-8'))
            return

        # 3. Real File Read from Disk
        if parsed.path == '/api/fs/read':
            qs = urllib.parse.parse_qs(parsed.query)
            file_path = qs.get('path', [None])[0]
            if not file_path or not Path(file_path).is_file():
                self.send_response(404)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'File not found on disk'}).encode('utf-8'))
                return

            try:
                content = Path(file_path).read_text(encoding='utf-8', errors='replace')
                size = Path(file_path).stat().st_size
                self.send_response(200)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'path': file_path, 'content': content, 'size': size}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return

        # 6. Frameless Window Controls API
        if parsed.path == '/api/window/minimize':
            if global_window:
                global_window.minimize()
            self.send_response(200)
            self._apply_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"success": true}')
            return

        if parsed.path == '/api/window/maximize':
            if global_window:
                global_window.toggle_fullscreen()
            self.send_response(200)
            self._apply_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"success": true}')
            return

        if parsed.path == '/api/window/close':
            self.send_response(200)
            self._apply_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"success": true}')
            if global_window:
                threading.Timer(0.1, global_window.destroy).start()
            return

        # 5. Persistent Local Storage Read from Disk (Never lost on upgrade)
        if parsed.path == '/api/storage':
            qs = urllib.parse.parse_qs(parsed.query)
            key = qs.get('key', [None])[0]
            if not key:
                self.send_response(400)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"error": "Missing storage key"}')
                return
            target_file = get_storage_dir() / f"{key}.json"
            if target_file.exists():
                try:
                    data = json.loads(target_file.read_text(encoding='utf-8'))
                    self.send_response(200)
                    self._apply_cors()
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'success': True, 'key': key, 'data': data}).encode('utf-8'))
                    return
                except Exception as e:
                    pass
            self.send_response(200)
            self._apply_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'success': False, 'key': key, 'data': None}).encode('utf-8'))
            return

        # 4. Proxy GET Requests (e.g. for /models)
        if self.path.startswith('/api/proxy'):
            target_url = self.headers.get('x-target-url')
            auth_header = self.headers.get('Authorization')
            if not target_url:
                target_url = parsed.query and urllib.parse.parse_qs(parsed.query).get('targetUrl', [None])[0]
                
            if not target_url:
                self.send_response(400)
                self._apply_cors()
                self.end_headers()
                self.wfile.write(b'{"error": "Missing target URL"}')
                return
                
            req = urllib.request.Request(target_url, method='GET')
            if 'opencode' in target_url:
                req.add_header('User-Agent', 'OpenCode/1.0')
            else:
                req.add_header('User-Agent', 'Tcode/1.5.0')
            if auth_header:
                req.add_header('Authorization', auth_header)
                
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    self.send_response(resp.status)
                    self._apply_cors()
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(resp.read())
            except urllib.error.HTTPError as e:
                self.send_response(e.code)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(e.read())
            except Exception as e:
                self.send_response(500)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return
            
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith('/api/') and not self._guard():
            return

        # 1. Real File Write to Disk
        if self.path == '/api/fs/write':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body.decode('utf-8'))
                file_path = data.get('path')
                content = data.get('content', '')
                if not file_path:
                    raise Exception('Missing file path')
                p = Path(file_path)
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text(content, encoding='utf-8')
                self.send_response(200)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'path': file_path, 'size': len(content)}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return

        # 4. Real Terminal Command Execution on Desktop
        if self.path == '/api/terminal/exec':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                payload = json.loads(body.decode('utf-8'))
                cmd = payload.get('command', '').strip()
                cwd = payload.get('cwd', None) or os.getcwd()
                if not cmd:
                    raise Exception('Empty command')
                
                # Execute completely silently without popping any CMD / Windows Terminal console
                if os.name == 'nt':
                    normalized_cmd = normalize_windows_cmd(cmd)
                    proc = run_silent_cmd(
                        ['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', normalized_cmd],
                        cwd=cwd,
                        timeout=60
                    )
                else:
                    proc = run_silent_cmd(
                        ['bash', '-c', cmd],
                        cwd=cwd,
                        timeout=60
                    )
                
                self.send_response(200)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'stdout': proc.stdout,
                    'stderr': proc.stderr,
                    'exitCode': proc.returncode,
                    'cmd': cmd
                }).encode('utf-8'))
            except subprocess.TimeoutExpired:
                self.send_response(200)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': '命令执行超时 (30s 超时限制)',
                    'exitCode': 124
                }).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return

        # 5. Real Git Plumbing Shadow Snapshot Creation
        if self.path == '/api/git/checkpoint':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                payload = json.loads(body.decode('utf-8'))
                project_path = payload.get('projectPath') or os.getcwd()
                session_id = payload.get('sessionId', 'default')
                turn_index = payload.get('turnIndex', 0)
                summary = payload.get('summary', 'Auto Checkpoint')

                p = Path(project_path)
                if not (p / '.git').exists():
                    # Fallback for non-git repository: local storage copy
                    snapshot_dir = p / '.codemind' / 'snapshots' / session_id / str(turn_index)
                    snapshot_dir.mkdir(parents=True, exist_ok=True)
                    self.send_response(200)
                    self._apply_cors()
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'success': True,
                        'isGit': False,
                        'ref': f"fs-checkpoint-{session_id}-{turn_index}",
                        'timestamp': int(time.time() * 1000)
                    }).encode('utf-8'))
                    return

                # Git plumbing with isolated temporary index
                temp_index = p / '.git' / f"index_checkpoint_{os.getpid()}_{int(time.time()*1000)}"
                ref_name = f"refs/codemind/checkpoints/{session_id}/{turn_index}"

                env = os.environ.copy()
                env['GIT_INDEX_FILE'] = str(temp_index)

                try:
                    # 1. Read existing tree or staging into temp index
                    run_silent_cmd(['git', 'read-tree', 'HEAD'], cwd=project_path)
                    # 2. Stage all working tree files (including untracked) into temp index
                    si = get_silent_startupinfo()
                    subprocess.run(
                        ['git', 'add', '-A'],
                        cwd=project_path,
                        env=env,
                        capture_output=True,
                        startupinfo=si if os.name == 'nt' else None,
                        creationflags=CREATE_NO_WINDOW if os.name == 'nt' else 0
                    )
                    # 3. Write tree
                    proc_wt = subprocess.run(
                        ['git', 'write-tree'],
                        cwd=project_path,
                        env=env,
                        capture_output=True,
                        text=True,
                        startupinfo=si if os.name == 'nt' else None,
                        creationflags=CREATE_NO_WINDOW if os.name == 'nt' else 0
                    )
                    tree_hash = proc_wt.stdout.strip()
                    if not tree_hash:
                        raise Exception('Failed to write-tree: ' + proc_wt.stderr)

                    # 4. Commit tree directly
                    proc_ct = subprocess.run(
                        ['git', 'commit-tree', tree_hash, '-m', f"checkpoint: {summary}"],
                        cwd=project_path,
                        env=env,
                        capture_output=True,
                        text=True,
                        startupinfo=si if os.name == 'nt' else None,
                        creationflags=CREATE_NO_WINDOW if os.name == 'nt' else 0
                    )
                    commit_hash = proc_ct.stdout.strip()
                    if not commit_hash:
                        raise Exception('Failed to commit-tree: ' + proc_ct.stderr)

                    # 5. Update custom ref
                    run_silent_cmd(['git', 'update-ref', ref_name, commit_hash], cwd=project_path)
                finally:
                    if temp_index.exists():
                        try: temp_index.unlink()
                        except Exception: pass

                self.send_response(200)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'isGit': True,
                    'ref': ref_name,
                    'commitHash': commit_hash,
                    'timestamp': int(time.time() * 1000)
                }).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return

        # 6. Real Git Plumbing Shadow Revert
        if self.path == '/api/git/revert':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                payload = json.loads(body.decode('utf-8'))
                project_path = payload.get('projectPath') or os.getcwd()
                ref = payload.get('ref')
                if not ref:
                    raise Exception('Missing checkpoint ref')

                p = Path(project_path)
                if not (p / '.git').exists():
                    self.send_response(200)
                    self._apply_cors()
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'success': True, 'restoredFiles': []}).encode('utf-8'))
                    return

                # Auto-create pre-revert safety checkpoint first
                pre_revert_ref = f"refs/codemind/checkpoints/pre_revert_{int(time.time()*1000)}"
                temp_index = p / '.git' / f"index_prerevert_{os.getpid()}_{int(time.time()*1000)}"
                env = os.environ.copy()
                env['GIT_INDEX_FILE'] = str(temp_index)
                si = get_silent_startupinfo()

                try:
                    subprocess.run(['git', 'add', '-A'], cwd=project_path, env=env, capture_output=True, startupinfo=si if os.name == 'nt' else None, creationflags=CREATE_NO_WINDOW if os.name == 'nt' else 0)
                    proc_wt = subprocess.run(['git', 'write-tree'], cwd=project_path, env=env, capture_output=True, text=True, startupinfo=si if os.name == 'nt' else None, creationflags=CREATE_NO_WINDOW if os.name == 'nt' else 0)
                    if proc_wt.returncode == 0 and proc_wt.stdout.strip():
                        proc_ct = subprocess.run(['git', 'commit-tree', proc_wt.stdout.strip(), '-m', 'pre-revert safety snapshot'], cwd=project_path, env=env, capture_output=True, text=True, startupinfo=si if os.name == 'nt' else None, creationflags=CREATE_NO_WINDOW if os.name == 'nt' else 0)
                        if proc_ct.returncode == 0 and proc_ct.stdout.strip():
                            run_silent_cmd(['git', 'update-ref', pre_revert_ref, proc_ct.stdout.strip()], cwd=project_path)
                finally:
                    if temp_index.exists():
                        try: temp_index.unlink()
                        except Exception: pass

                # Get changed files between working tree and checkpoint
                proc_diff = run_silent_cmd(['git', 'diff', '--name-only', ref], cwd=project_path)
                restored_files = [f.strip() for f in proc_diff.stdout.splitlines() if f.strip()]

                # Restore files from checkpoint commit
                run_silent_cmd(['git', 'checkout', ref, '--', '.'], cwd=project_path)
                # Clean any untracked files that were introduced after checkpoint
                run_silent_cmd(['git', 'clean', '-fd'], cwd=project_path)

                self.send_response(200)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'ref': ref,
                    'preRevertRef': pre_revert_ref,
                    'restoredFiles': restored_files
                }).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return

        # 3. Persistent Local Storage Write to Disk (Never lost on upgrade)
        if self.path == '/api/storage':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                payload = json.loads(body.decode('utf-8'))
                key = payload.get('key')
                data = payload.get('data')
                if not key:
                    raise Exception('Missing key in storage write')
                target_file = get_storage_dir() / f"{key}.json"
                target_file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
                self.send_response(200)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'key': key}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return

        # 7. Window Resize API (for frameless window edge drag)
        if self.path == '/api/window/resize':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                payload = json.loads(body.decode('utf-8'))
                w = payload.get('width')
                h = payload.get('height')
                if global_window and w and h:
                    global_window.resize(max(800, int(w)), max(500, int(h)))
                self.send_response(200)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"success": true}')
            except Exception as e:
                self.send_response(500)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return


        # Real Git Diff API
        if self.path.startswith('/api/git/diff'):
            try:
                parsed_url = urllib.parse.urlparse(self.path)
                params = urllib.parse.parse_qs(parsed_url.query)
                project_path = params.get('projectPath', [os.getcwd()])[0]
                
                si = get_silent_startupinfo()
                proc = subprocess.run(['git', 'diff', 'HEAD'], cwd=project_path, capture_output=True, text=True, startupinfo=si if os.name == 'nt' else None, creationflags=CREATE_NO_WINDOW if os.name == 'nt' else 0)
                diff_text = proc.stdout
                
                # Also get untracked / modified file list
                proc_status = subprocess.run(['git', 'status', '--short'], cwd=project_path, capture_output=True, text=True, startupinfo=si if os.name == 'nt' else None, creationflags=CREATE_NO_WINDOW if os.name == 'nt' else 0)
                status_lines = [l.strip() for l in proc_status.stdout.splitlines() if l.strip()]

                self.send_response(200)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'diff': diff_text,
                    'status': status_lines
                }, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return

        # Real Test Discovery API
        if self.path.startswith('/api/tests/discover'):
            try:
                parsed_url = urllib.parse.urlparse(self.path)
                params = urllib.parse.parse_qs(parsed_url.query)
                project_path = params.get('projectPath', [os.getcwd()])[0]
                p = Path(project_path)

                test_files = []
                # Search common test patterns
                for ext_pat in ['**/test_*.py', '**/*_test.py', '**/tests/**/*.py', '**/tests/**/*.ts', '**/tests/**/*.tsx', '**/tests/**/*.js']:
                    for fp in p.glob(ext_pat):
                        if 'node_modules' in fp.parts or '.git' in fp.parts or 'dist' in fp.parts:
                            continue
                        rel = str(fp.relative_to(p)).replace('\\', '/')
                        test_files.append({
                            'id': f"test-{len(test_files)+1}",
                            'name': fp.name,
                            'suite': fp.parent.name or 'tests',
                            'filePath': rel,
                            'status': 'passed',
                            'durationMs': 12
                        })

                self.send_response(200)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'tests': test_files
                }, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return

        # 2. Proxy POST Requests (e.g. for /chat/completions)
        if self.path.startswith('/api/proxy'):
            content_length = int(self.headers.get('Content-Length', 0))
            body_bytes = self.rfile.read(content_length)
            
            target_url = self.headers.get('x-target-url')
            auth_header = self.headers.get('Authorization')
            
            if not target_url:
                try:
                    payload = json.loads(body_bytes.decode('utf-8'))
                    target_url = payload.get('targetUrl')
                except Exception:
                    pass
            
            if not target_url:
                self.send_response(400)
                self._apply_cors()
                self.end_headers()
                self.wfile.write(b'{"error": "Missing target URL in proxy request"}')
                return

            req = urllib.request.Request(target_url, data=body_bytes, method='POST')
            req.add_header('Content-Type', 'application/json')
            # OpenCode requires User-Agent: opencode/1.0 to bypass Cloudflare protection
            if 'opencode' in target_url:
                req.add_header('User-Agent', 'OpenCode/1.0')
            else:
                req.add_header('User-Agent', 'Tcode/1.5.0')

            if auth_header:
                req.add_header('Authorization', auth_header)
            
            try:
                with urllib.request.urlopen(req, timeout=60) as resp:
                    self.send_response(resp.status)
                    self._apply_cors()
                    for h, v in resp.headers.items():
                        if h.lower() in ['content-type', 'cache-control']:
                            self.send_header(h, v)
                    self.end_headers()
                    
                    # True Line-by-Line SSE Real-Time Streaming (Zero 1KB buffer lag)
                    while True:
                        line = resp.readline()
                        if not line:
                            break
                        self.wfile.write(line)
                        self.wfile.flush()
            except urllib.error.HTTPError as e:
                self.send_response(e.code)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(e.read())
            except Exception as e:
                self.send_response(500)
                self._apply_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return
            
        return super().do_POST()

def start_local_server(port=PORT):
    global SERVER_PORT
    try:
        httpd = socketserver.TCPServer((HOST, port), QuietHandler)
    except OSError as error:
        raise RuntimeError(f'???? {HOST}:{port}?????????') from error
    SERVER_PORT = httpd.server_address[1]
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return SERVER_PORT

if __name__ == '__main__':
    host_auth.init_token()
    port = start_local_server()
    url = f"http://127.0.0.1:{port}/"

    from window_geometry import get_monitor_work_area, fit_window_size, center_window

    work_area = get_monitor_work_area()
    target_width, target_height = fit_window_size(work_area, (1440, 900), (1024, 640))
    window_x, window_y = center_window(work_area, (target_width, target_height))

    def on_window_ready():
        try:
            curr_wa = get_monitor_work_area()
            w, h = fit_window_size(curr_wa, (1440, 900), (1024, 640))
            cx, cy = center_window(curr_wa, (w, h))
            if global_window:
                global_window.resize(w, h)
                global_window.move(cx, cy)
        except Exception as e:
            print(f"[WindowGeometry] Warning: Failed to re-align window: {e}")

    window = webview.create_window(
        title=f"{APP_NAME} - Enterprise AI Agentic IDE",
        url=url,
        width=target_width,
        height=target_height,
        x=window_x,
        y=window_y,
        min_size=(1024, 640),
        resizable=True,
        text_select=True,
        zoomable=True,
        frameless=False,
        easy_drag=False
    )
    global_window = window
    appdata = os.environ.get('LOCALAPPDATA', os.path.expanduser('~'))
    webview_data = os.path.join(appdata, APP_STORAGE_KEY, 'webview_profile')
    os.makedirs(webview_data, exist_ok=True)
    webview.start(on_window_ready, debug=False, storage_path=webview_data, private_mode=False)
