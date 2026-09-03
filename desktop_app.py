import os
import sys
import argparse
import http.server
import socketserver
import threading
import urllib.request
import urllib.error
import time
import json
import webbrowser

def get_base_dir():
    if getattr(sys, "frozen", False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))

class TcodeHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        base_dir = get_base_dir()
        dist_dir = os.path.join(base_dir, "frontend_dist")
        if not os.path.exists(dist_dir):
            dist_dir = os.path.join(base_dir, "frontend", "dist")
        super().__init__(*args, directory=dist_dir, **kwargs)

    def do_GET(self):
        if self.path == "/api/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            data = json.dumps({"status": "healthy", "desktop": True, "timestamp": int(time.time() * 1000)})
            self.wfile.write(data.encode("utf-8"))
            return

        # 检查文件是否存在，如果不存在则回退至 index.html (SPA 支持)
        path = self.translate_path(self.path)
        if not os.path.exists(path) and not self.path.startswith("/api/"):
            self.path = "/index.html"

        super().do_GET()

    def do_POST(self):
        # 代理到后端微内核
        if self.path.startswith("/api/"):
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            backend_url = f"http://127.0.0.1:8765{self.path}"
            try:
                req = urllib.request.Request(
                    backend_url,
                    data=body,
                    headers={k: v for k, v in self.headers.items() if k.lower() != "host"},
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=30) as resp:
                    self.send_response(resp.status)
                    for k, v in resp.headers.items():
                        self.send_header(k, v)
                    self.end_headers()
                    self.wfile.write(resp.read())
            except Exception as e:
                self.send_response(502)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        super().do_POST()

def main():
    parser = argparse.ArgumentParser(description="Tcode Desktop Host")
    parser.add_argument("--port", type=int, default=8766, help="Port to listen on")
    parser.add_argument("--headless", action="store_true", help="Do not open browser automatically")
    args = parser.parse_args()

    port = args.port
    print(f"[Tcode Desktop] Starting embedded server on http://127.0.0.1:{port}")

    class ReusableTCPServer(socketserver.TCPServer):
        allow_reuse_address = True

    try:
        httpd = ReusableTCPServer(("127.0.0.1", port), TcodeHandler)
    except OSError:
        port = port + 1
        httpd = ReusableTCPServer(("127.0.0.1", port), TcodeHandler)

    if not args.headless:
        threading.Timer(0.8, lambda: webbrowser.open(f"http://127.0.0.1:{port}")).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[Tcode Desktop] Shutting down...")
        httpd.shutdown()

if __name__ == "__main__":
    main()
