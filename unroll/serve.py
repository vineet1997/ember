"""Static server for the unroll slice, rooted at the REPO so it can reach
slice/data/. Caching off, for the reason slice/serve.py exists: a caching
server hands you yesterday's shader and you debug code that is not running.

    python unroll/serve.py            ->  http://localhost:8124/unroll/
"""
import functools, os, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        SimpleHTTPRequestHandler.end_headers(self)

    def log_message(self, fmt, *a):
        if "200" not in (a[1] if len(a) > 1 else ""):
            SimpleHTTPRequestHandler.log_message(self, fmt, *a)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8124
    h = functools.partial(NoCache, directory=ROOT)
    print("the unroll on http://localhost:%d/unroll/" % port)
    ThreadingHTTPServer(("127.0.0.1", port), h).serve_forever()
