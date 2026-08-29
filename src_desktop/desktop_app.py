import os
import sys
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
