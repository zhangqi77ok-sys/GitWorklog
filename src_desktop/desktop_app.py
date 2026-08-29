import os
import sys
import json
import subprocess
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
    base = Path(appdata) / 'CodeMind-Hub' / 'storage'
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
        res = subprocess.run(
            ["powershell.exe", "-NoProfile", "-Command", ps_cmd],
            capture_output=True,
            text=True,
            timeout=120,
            creationflags=CREATE_NO_WINDOW
        )
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

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        
        # 1. Native Folder Picker
        if parsed.path == '/api/fs/pick_folder':
            folder_path = pick_folder_native()
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
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
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Invalid or missing directory path'}).encode('utf-8'))
                return

            tree = scan_directory(target_path, max_depth=2)
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True, 'path': target_path, 'tree': tree}).encode('utf-8'))
            return

        # Real Project Text Search across files on disk
        if parsed.path == '/api/fs/search':
            qs = urllib.parse.parse_qs(parsed.query)
            target_path = qs.get('path', [None])[0]
            query = qs.get('query', [''])[0].strip()
            if not target_path or not Path(target_path).exists() or not query:
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
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
                                        matches.append({'line': idx + 1, 'text': line.strip()[:160]})
                                        if len(matches) >= 5: break
                                if matches:
                                    rel = str(file_path.relative_to(p)).replace('\\', '/')
                                    results.append({
                                        'file': rel,
                                        'fullPath': str(file_path).replace('\\', '/'),
                                        'matches': matches
                                    })
                                    if len(results) >= 30: break
                        except Exception:
                            continue
            except Exception:
                pass

            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
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
                res_b = subprocess.run(['git', 'branch', '--show-current'], cwd=target_path, capture_output=True, text=True, creationflags=CREATE_NO_WINDOW)
                if res_b.returncode == 0 and res_b.stdout.strip():
                    branch = res_b.stdout.strip()
                
                # Get status porcelain
                res_s = subprocess.run(['git', 'status', '--porcelain'], cwd=target_path, capture_output=True, text=True, creationflags=CREATE_NO_WINDOW)
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
            self.send_header('Access-Control-Allow-Origin', '*')
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
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'File not found on disk'}).encode('utf-8'))
                return

            try:
                content = Path(file_path).read_text(encoding='utf-8', errors='replace')
                size = Path(file_path).stat().st_size
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'path': file_path, 'content': content, 'size': size}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return

        # 5. Persistent Local Storage Read from Disk (Never lost on upgrade)
        if parsed.path == '/api/storage':
            qs = urllib.parse.parse_qs(parsed.query)
            key = qs.get('key', [None])[0]
            if not key:
                self.send_response(400)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"error": "Missing storage key"}')
                return
            target_file = get_storage_dir() / f"{key}.json"
            if target_file.exists():
                try:
                    data = json.loads(target_file.read_text(encoding='utf-8'))
                    self.send_response(200)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'success': True, 'key': key, 'data': data}).encode('utf-8'))
                    return
                except Exception as e:
                    pass
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
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
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(b'{"error": "Missing target URL"}')
                return
                
            req = urllib.request.Request(target_url, method='GET')
            if 'opencode' in target_url:
                req.add_header('User-Agent', 'opencode/1.0')
            else:
                req.add_header('User-Agent', 'CodeMind-Hub/1.1.5')
            if auth_header:
                req.add_header('Authorization', auth_header)
                
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    self.send_response(resp.status)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(resp.read())
            except urllib.error.HTTPError as e:
                self.send_response(e.code)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(e.read())
            except Exception as e:
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return
            
        return super().do_GET()

    def do_POST(self):
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
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'path': file_path, 'size': len(content)}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
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
                
                # Execute in PowerShell on Windows, bash on Unix
                if os.name == 'nt':
                    proc = subprocess.run(
                        ['powershell.exe', '-NoProfile', '-Command', cmd],
                        cwd=cwd,
                        capture_output=True,
                        text=True,
                        timeout=30
                    )
                else:
                    proc = subprocess.run(
                        cmd,
                        shell=True,
                        cwd=cwd,
                        capture_output=True,
                        text=True,
                        timeout=30
                    )
                
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
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
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': '命令执行超时 (30s 超时限制)',
                    'exitCode': 124
                }).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
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
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'key': key}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
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
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(b'{"error": "Missing target URL in proxy request"}')
                return

            req = urllib.request.Request(target_url, data=body_bytes, method='POST')
            req.add_header('Content-Type', 'application/json')
            # OpenCode requires User-Agent: opencode/1.0 to bypass Cloudflare protection
            if 'opencode' in target_url:
                req.add_header('User-Agent', 'opencode/1.0')
            else:
                req.add_header('User-Agent', 'CodeMind-Hub/1.1.5')

            if auth_header:
                req.add_header('Authorization', auth_header)
            
            try:
                with urllib.request.urlopen(req, timeout=60) as resp:
                    self.send_response(resp.status)
                    self.send_header('Access-Control-Allow-Origin', '*')
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
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(e.read())
            except Exception as e:
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return
            
        return super().do_POST()

def start_local_server(port=49152):
    while True:
        try:
            httpd = socketserver.TCPServer(("127.0.0.1", port), QuietHandler)
            t = threading.Thread(target=httpd.serve_forever, daemon=True)
            t.start()
            return port
        except Exception:
            port += 1

if __name__ == '__main__':
    port = start_local_server()
    url = f"http://127.0.0.1:{port}/"
    
    window = webview.create_window(
        title="CodeMind-Hub - Enterprise AI Agentic IDE",
        url=url,
        width=1440,
        height=900,
        min_size=(1024, 640),
        text_select=True,
        zoomable=True
    )
    appdata = os.environ.get('LOCALAPPDATA', os.path.expanduser('~'))
    webview_data = os.path.join(appdata, 'CodeMind-Hub', 'webview_profile')
    os.makedirs(webview_data, exist_ok=True)
    webview.start(debug=False, storage_path=webview_data, private_mode=False)
