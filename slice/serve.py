"""Static server for the slice, with caching off so a reload is a reload."""
import functools, os, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))


class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        SimpleHTTPRequestHandler.end_headers(self)

    def log_message(self, fmt, *a):
        if "200" not in (a[1] if len(a) > 1 else ""):
            SimpleHTTPRequestHandler.log_message(self, fmt, *a)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    h = functools.partial(NoCache, directory=HERE)
    print("slice on http://localhost:%d" % port)
    ThreadingHTTPServer(("127.0.0.1", port), h).serve_forever()
