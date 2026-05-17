#!/usr/bin/env python
"""
Servidor HTTP para el frontend de Playas de Autos
Sirve archivos estáticos en puerto 3000
"""

import http.server
import socketserver
import os
import sys
from pathlib import Path

PORT = 3000
DIRECTORY = Path(__file__).parent

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIRECTORY), **kwargs)
    
    def end_headers(self):
        # Prevenir cacheo agresivo (sin no-store que algunos browsers tratan como reload-on-back)
        if self.path.endswith('.html') or self.path in ['/', '']:
            self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()
    
    def do_GET(self):
        # Redirigir /app a /index.html para SPA
        if self.path in ['/', ''] or not '.' in self.path.split('/')[-1]:
            self.path = '/index.html'
        return super().do_GET()

def run_server():
    """Inicia el servidor HTTP"""
    Handler = MyHTTPRequestHandler
    
    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print(f"""
            ╔══════════════════════════════════════════════════╗
            ║  🚗 Playas de Autos - Frontend                   ║
            ║  ✅ Servidor corriendo                           ║
            ║  📍 URL: http://localhost:{PORT}                 ║
            ║  🔐 Login: admin / admin123                      ║
            ║  ⚡ Ctrl+C para detener                          ║
            ╚══════════════════════════════════════════════════╝
            """)
            
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n✓ Servidor detenido")
        sys.exit(0)
    except OSError as e:
        if e.errno == 48 or e.errno == 98:  # Port already in use
            print(f"\n❌ Error: Puerto {PORT} ya está en uso")
            print(f"   Ejecuta: lsof -ti :{PORT} | xargs kill -9")
            sys.exit(1)
        raise

if __name__ == '__main__':
    os.chdir(DIRECTORY)
    run_server()
