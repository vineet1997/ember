"""Inline spike-data.json into index.html -> spike.build.html (artifact CSP blocks fetch)."""
import io, os
here = os.path.dirname(os.path.abspath(__file__))
h = io.open(os.path.join(here, "index.html"), encoding="utf-8").read()
d = io.open(os.path.join(here, "spike-data.json"), encoding="utf-8").read()
m = "<script>\n(function () {"
assert m in h, "anchor not found"
h = h.replace(m, "<script>window.__SPIKE_DATA__=" + d + ";</" + "script>\n" + m, 1)
out = os.path.join(here, "spike.build.html")
io.open(out, "w", encoding="utf-8").write(h)
print("built %s  %d KB" % (out, os.path.getsize(out) // 1024))
