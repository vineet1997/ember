"""Serve the repository root without a browser cache.

The scene and master-film contracts resolve paths from the repository root and
expect port 8899 by default:

    python serve.py                 # http://127.0.0.1:8899/film/
    python serve.py 8123            # same root, a chosen port

Caching makes shader and generated-data edits look like they did not happen,
so this deliberately mirrors the existing scene servers' no-cache policy.
"""
import functools
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


ROOT = os.path.dirname(os.path.abspath(__file__))


class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "200" not in (args[1] if len(args) > 1 else ""):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8899
    handler = functools.partial(NoCache, directory=ROOT)
    print("One Ember root on http://127.0.0.1:%d/film/" % port)
    ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
