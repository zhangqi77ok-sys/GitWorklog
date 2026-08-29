import os
import sys
import json
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

    def do_POST(self):
        if self.path.startswith('/api/proxy'):
            content_length = int(self.headers.get('Content-Length', 0))
            body_bytes = self.rfile.read(content_length)
            
            target_url = self.headers.get('x-target-url')
            auth_header = self.headers.get('Authorization')
            
            if not target_url:
                try:
                    payload = json.loads(body_bytes.decode('utf-8'))
                    target_url = payload.get('targetUrl')
                except:
                    pass
            
            if not target_url:
                self.send_response(400)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(b'{"error": "Missing target URL in proxy request"}')
                return

            req = urllib.request.Request(target_url, data=body_bytes, method='POST')
            req.add_header('Content-Type', 'application/json')
            req.add_header('User-Agent', 'CodeMind-Hub/1.0.5')
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

    def do_GET(self):
        if self.path.startswith('/api/proxy'):
            target_url = self.headers.get('x-target-url')
            auth_header = self.headers.get('Authorization')
            if not target_url:
                parsed = urllib.parse.urlparse(self.path)
                qs = urllib.parse.parse_qs(parsed.query)
                target_url = qs.get('targetUrl', [None])[0]
                
            if not target_url:
                self.send_response(400)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(b'{"error": "Missing target URL in proxy request"}')
                return
                
            req = urllib.request.Request(target_url, method='GET')
            req.add_header('User-Agent', 'CodeMind-Hub/1.0.5')
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

def start_local_server(port=49152):
    while True:
        try:
            httpd = socketserver.TCPServer(("127.0.0.1", port), QuietHandler)
            t = threading.Thread(target=httpd.serve_forever, daemon=True)
            t.start()
            return port
        except:
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
