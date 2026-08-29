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
    # 1. First try pywebview native folder dialog
    if window:
        try:
            res = window.create_file_dialog(webview.FOLDER_DIALOG)
            if res and len(res) > 0:
                return res[0]
        except Exception:
            pass
    # 2. Native Windows FolderBrowserDialog via PowerShell
    ps_cmd = "[System.Reflection.Assembly]::LoadWithPartialName('System.windows.forms') | Out-Null; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = '选择要打开的工作区工程文件夹'; $f.ShowNewFolderButton = $true; if ($f.ShowDialog() -eq 'OK') { Write-Output $f.SelectedPath }"
    try:
        res = subprocess.run(["powershell.exe", "-NoProfile", "-Command", ps_cmd], capture_output=True, text=True, timeout=120)
        out = res.stdout.strip()
        if out and Path(out).exists():
            return out
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
            req.add_header('User-Agent', 'CodeMind-Hub/1.0.8')
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
            req.add_header('User-Agent', 'CodeMind-Hub/1.0.8')
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
                    
                    while True:
                        chunk = resp.read(1024)
                        if not chunk:
                            break
                        self.wfile.write(chunk)
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
    webview.start(debug=False)
