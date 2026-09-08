"""Mutation-test the panel: make the film wrong and require it to notice.

    python evidence/mutate_law06.py

Mutation 1 is the audit's own injection, in the shape the audit used it: a
SMOOTH dependence of a world channel on the eruption. law06() must still pass -
that is the whole point, continuity is not independence - and independence()
must fail.

Mutation 2 takes the visible atlas link out of the chrome and requires the copy
check to fail.

Both are applied to the working tree and reverted from an in-memory BYTE copy
taken before anything is touched. The first version of this script reverted with
`git checkout --` and threw away an afternoon of uncommitted work in one line:
a mutation harness must restore what it FOUND, not what the repository last
remembered.
"""
import os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "slice", "tools"))
os.chdir(ROOT)
from harness import session, panel_tests, utf8_stdout

utf8_stdout()

FILM = os.path.join(ROOT, "slice", "film.js")
HTML = os.path.join(ROOT, "slice", "index.html")
BACKUP = {f: open(f, "rb").read() for f in (FILM, HTML)}

CLEAN = "    chill: temp === null ? 0.45 : clamp((-temp - 34) / 12, 0, 1),"
DIRTY = ("    chill: temp === null ? 0.45 : clamp((-temp - 34) / 12, 0, 1) +\n"
         "      (D.events.some(function (e) { return e.id === \"campanian-ignimbrite\"; })\n"
         "        ? 0.05 * Math.exp(-Math.pow((yr - 39850) / 400, 2)) : 0),")

LINK = 'id="chrome-atlas" '


def revert():
    for f, raw in BACKUP.items():
        open(f, "wb").write(raw)


def swap(path, old, new):
    """Byte-level, and in the file's own line endings - index.html is CRLF."""
    raw = BACKUP[path]
    ob, nb = old.encode("utf-8"), new.encode("utf-8")
    if b"\r\n" in raw:
        ob = ob.replace(b"\n", b"\r\n")
        nb = nb.replace(b"\n", b"\r\n")
    assert raw.count(ob) == 1, "expected 1 match, found %d in %s" % (raw.count(ob), path)
    open(path, "wb").write(raw.replace(ob, nb))


def run(label, want):
    with session() as (page, _):
        r = panel_tests(page, runs=1)[0]
    print("\n%s" % label)
    for k, v in r.items():
        print("   %-13s %s" % (k, "PASS" if v["pass"] else "FAIL"))
    ok = all(r[k]["pass"] == v for k, v in want.items())
    print("   -> %s" % ("as expected" if ok else "NOT WHAT WE WANTED"))
    return ok


good = True
try:
    swap(FILM, CLEAN, DIRTY)
    good &= run("MUTATION 1 - a smooth dependence of chill on the eruption "
                "(the audit's own injection)",
                {"law06": True, "independence": False})
finally:
    revert()

try:
    swap(HTML, LINK, "")
    good &= run("MUTATION 2 - the visible atlas link loses its id",
                {"copyCheck": False})
finally:
    revert()

for f, raw in BACKUP.items():
    assert open(f, "rb").read() == raw, "FAILED TO RESTORE %s" % f
print("\nboth files restored byte-for-byte")
print("%s" % ("BOTH MUTATIONS CAUGHT" if good else "A MUTATION WENT UNNOTICED"))
sys.exit(0 if good else 1)
