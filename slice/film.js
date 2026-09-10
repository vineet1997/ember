/* ===========================================================================
   ONE EMBER  ·  Beats 05, 06 and 07  ·  one continuous t
     05  The line that held        60-50 ka   t 0.230-0.300   motion 0
     06  The crossing to Sahul     50-43 ka   t 0.300-0.380   motion 4
     07  The others                43-39 ka   t 0.380-0.440   motion 2

   LAW 01.  Deep time is a single float t. stateFor(t) is a pure function and
            nothing anywhere reads anything but its result. The purity test in
            the panel hashes 401 samples forward, then backward, and diffs.
   LAW 02.  The earth is slate, ice and bone. The only warm light on screen is
            people - the ember head, its trail, and the pigment a hand was
            blown around. Beat 07 adds a SECOND people-light, pale, and takes
            it away again permanently.
   LAW 04.  Orbital is THEN and rides the time axis. Ground is NOW: an object
            as we hold it today, so it cannot break monotonicity.
   LAW 06.  Nothing on screen that isn't causal - FOR WHAT HAPPENED, OR FOR HOW
            WE KNOW IT, and the register says which. Widened in Phase 5 for the
            Campanian Ignimbrite; see law06() in section 12, which is the half
            of the decision that is enforced rather than promised.
   LAW 08.  Every boundary is an edge that moves. The waterline, the modern
            coastline it has left behind, the head of the population - and the
            extent of a population that is going out, which SHRINKS rather than
            fading, because a fading fill is the thing the law forbids.

   PHASE 5 NOTE - three beats, one t, one artifact. The alternative was three
   addressable slices and it was rejected on Law 01: the two places this work
   was most likely to fail are 05's release into 06 and 06's pull-back into 07,
   and those are exactly the boundaries a three-artifact build makes
   unscrubbable. Beat 07 also asserts something no single beat can hold - that
   a colour is absent for the REST OF THE FILM - and that is a claim about t in
   [0.44, 1.0], beats which do not exist yet. It is checkable only because
   stateFor is total over the whole span. See law06() and absence().
   =========================================================================== */
(function () {
"use strict";

var RAD = Math.PI / 180, DEG = 180 / Math.PI;
var $ = function (id) { return document.getElementById(id); };

/* -- the gate: desktop is the film ----------------------------------------
   ASKED AT STARTUP AND ASKED AGAIN AFTERWARDS. It used to be asked once, at
   parse time, which left the one reader the gate exists for stranded: turn
   reduced motion on while the film is running, or drag the window down to
   phone width, and the film went on scrolling with no way out of it. The
   answer is a function of the environment, so it is re-asked whenever the
   environment changes - see applyGate() in section 13, wired to resize and to
   the media query itself, and note that the draw loop STOPS while the gate is
   up. Reduced motion means stop moving; a film still animating behind a panel
   that says it has stopped is the film lying. */
var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)");
function gateWanted() {
  return window.innerWidth < 1280 || window.innerHeight < 700 || REDUCED.matches;
}
var GATED = gateWanted();
if (GATED) { $("gate").classList.add("on"); return; }

/* ═══ 1 · BOOT ═══════════════════════════════════════════════════════════ */

var D = null, TEXG = null, TXG = null, gl = null, prog = null, U = {};
/* The three frame tiles, by id. Only ONE is bound at a time - see section 7,
   tileFor(t): the camera is only ever in one of them, and swapping on the CPU
   keeps the shader at two elevation fetches instead of eight. */
var TEX = { sunda: null, redsea: null, europe: null };
var TXO = { sunda: null, redsea: null, europe: null };   /* the decoded GL textures */
/* The background tiles arrive after the film. Their one-time conversion has
   already produced a felt hitch on Slow-4G, but the first benchmark established
   only that the float loop is not all of it. Keep the phases separate: a clock
   around the whole conversion would be a number without a next decision. */
var TILE_TIMING = { tile: null, state: "waiting for a background tile",
                    imageDecode: null, readback: null, terrainDecode: null,
                    upload: null, mipmap: null, total: null };
var earth = $("earth"), over = $("over"), octx = over.getContext("2d");
var W = 0, H = 0, DPR = 1;

/* Attached before anything can fail. The panel is where you find out WHY the
   film did not start, so it must not be a casualty of the film not starting. */
window.addEventListener("keydown", function (e) {
  if (e.key === "i" || e.key === "I") $("panel").classList.toggle("on");
  if ((e.key === "d" || e.key === "D") && gl) DEBUG = (DEBUG + 1) % 5;
});

/* ?still=1 disables the copy transitions, so a frame drawn by renderAt() is
   finished when it returns instead of being 0.9s into a fade. */
if (/[?&]still=1/.test(location.search)) document.body.classList.add("still");

var steps = 0, STEPS = 3, LOAD_FAILED = false;
function step(msg) {
  /* A LATER SUCCESS MUST NOT ERASE AN EARLIER FAILURE. Five parallel loads all
     wrote into this one line, so a tile that failed said so only until the next
     tile succeeded - after which the reader sat in front of an opaque loader
     watching a progress line for a load that was never going to finish. */
  if (LOAD_FAILED) return;
  steps++;
  $("lbar").style.width = Math.round(steps / STEPS * 100) + "%";
  $("lmsg").textContent = msg;
}

/* WHAT BLOCKS THE FILM, AND WHAT MERELY FOLLOWS IT.

   The three frame tiles are 33 MB between them, and all three used to sit in
   one Promise.all with the record and the globe: 36.8 MB before the first
   frame, about twenty-nine seconds on a 10 Mbit line and five minutes on a
   1 Mbit one - and two of those tiles are for beats the reader cannot reach for
   another several thousand words of scroll.

   So the blocking set is three files: the record, the globe, and the ONE tile
   the opening frame stands on. The other two are fetched after the film is
   running, nearest first. Until one arrives its beat draws from the global
   texture instead, which is a resolution change and never a value change - see
   bindTile(), where the fallback is arranged so the shader mixes the global
   field with ITSELF and the frame is that field exactly.                    */
var TILES = {
  redsea: { src: "data/bathy_redsea.png", msg: "both doors out of Africa" },
  sunda:  { src: "data/bathy_sunda.png",  msg: "Wallacea, 1.85 km per pixel" },
  europe: { src: "data/bathy_europe.png", msg: "Europe and west Asia" }
};

/* Which tile the film will open on: the hash if there is one, otherwise
   whatever scroll position the browser has restored. A wrong guess is not an
   error, it is one beat drawn from the globe for a few seconds. */
function entryTile() {
  var want = tFromHash();
  if (want === null) want = tFor(window.scrollY / maxScroll());
  return tileFor(want);
}

var pRecord = fetch("data/film.json").then(function (r) { return r.json(); })
  .then(function (j) { D = j; step("the record"); });
var pGlobe = image("data/bathy_global.png")
  .then(function (i) { TEXG = i; step("the earth, 2048 x 1024"); });
/* The record decides which tile is first - it carries tSpan and the beat table
   - so this one waits on it. film.json is 120 KB and the globe is coming down
   through that wait, so the cost is one round trip and not one download. */
var pFirst = pRecord.then(function () {
  var k = entryTile();
  return image(TILES[k].src).then(function (i) { TEX[k] = i; step(TILES[k].msg); });
});

Promise.all([pRecord, pGlobe, pFirst]).then(function () {
  start();
  loadRest();
}, assetFailure);

/* AN ASSET DID NOT ARRIVE, and the reader is looking at an opaque black page.
   Two things were wrong here and only one of them was the message. The other
   was that this was a dead end with no door in it: the WebGL failure path has
   offered the atlas since Phase 5 and this path, where the reader is equally
   stuck, offered nothing at all. */
function assetFailure(e) {
  LOAD_FAILED = true;
  $("lmsg").textContent = String(e && e.message || e);
  $("lmsg").style.color = "#E8703A";
  $("ldetail").style.display = "block";
  $("ldetail").innerHTML =
    '<p><a class="go" href="atlas.html">Read beat 06 as the atlas</a></p>' +
    "<p>One of the rasters the film draws the earth from did not arrive, and " +
    "there is no honest frame without it: every coastline in this beat is " +
    "computed from that elevation and from nothing else. A reload is worth one " +
    "try. The atlas above is the same beat, baked from the same shader, and " +
    "needs none of it.</p>";
}

/* THE OTHER TWO TILES, while the film is already running.

   Nearest first, and "nearest" is read off tileFor() rather than typed beside
   it, so the priority cannot drift from the boundaries it is about.

   Decoding a 4320x1860 terrain-RGB image into floats is a third of a second of
   main thread, and invariant 5 says that must not land at a beat boundary.
   requestIdleCallback puts it in a gap between frames and the timeout is the
   promise that it happens at all. That is a mitigation, not a guarantee, and
   the trade is the honest one: one possible hitch, once per tile, against
   twenty-nine seconds of black screen before the first frame. */
function loadRest() {
  if (!gl) return;
  var rest = Object.keys(TILES).filter(function (k) { return !TEX[k]; });
  rest.sort(function (a, b) { return tileReach(a) - tileReach(b); });
  (function next() {
    var k = rest.shift();
    if (!k) return;
    /* A slow network can hold this here for minutes. Say which tile is still
       arriving instead of leaving the reader to mistake blank phase clocks for
       a completed zero-cost conversion. The clocks begin only after image(). */
    TILE_TIMING = { tile: k, state: "downloading in background",
                    imageDecode: null, readback: null, terrainDecode: null,
                    upload: null, mipmap: null, total: null };
    image(TILES[k].src).then(function (i) {
      TEX[k] = i;
      TILE_TIMING = { tile: k, state: "waiting for an idle gap",
                      imageDecode: null, readback: null, terrainDecode: null,
                      upload: null, mipmap: null, total: null };
      idle(function () {
        var started = performance.now();
        TILE_TIMING.state = "measuring conversion";
        gl.activeTexture(gl.TEXTURE1);
        TXO[k] = elevTexture(TEX[k], gl.CLAMP_TO_EDGE, D.measured.tiles.sunda, TILE_TIMING);
        TILE_TIMING.total = performance.now() - started;
        TILE_TIMING.state = "complete";
        /* elevTexture leaves ITS texture bound to the unit; drop the cached
           binding so the next frame re-states the box and the size. */
        boundTile = "";
        next();
      });
    }, function () {
      /* A background tile that never arrives is not fatal - its beat draws from
         the globe - but it must not stop the tile behind it. */
      next();
    });
  })();
}

/* the nearest t at which this tile is the one the film would bind, measured
   from where the reader is now. Derived from tileFor, never from a copy of
   its boundaries. */
function tileReach(k) {
  var here = tFor(cur), best = 9;
  for (var i = 0; i <= 400; i++) {
    var t = D.tSpan[0] + (D.tSpan[1] - D.tSpan[0]) * (i / 400);
    if (tileFor(t) === k) best = Math.min(best, Math.abs(t - here));
  }
  return best;
}

function idle(fn) {
  if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 4000 });
  else setTimeout(fn, 60);
}

/* Every frame tile decoded and uploaded. The bake asks this before it starts:
   a still baked while sunda was still in flight would be beat 06 drawn from the
   2048-wide globe, which is a true picture of the wrong resolution and would
   silently become the atlas. */
function tilesReady() {
  return Object.keys(TILES).every(function (k) { return !!TXO[k]; });
}

function image(src) {
  return new Promise(function (res, rej) {
    var i = new Image();
    i.onload = function () { res(i); };
    i.onerror = function () { rej(new Error("could not load " + src)); };
    i.src = src;
  });
}

/* ═══ 2 · THE TIME CURVE  (Laws 01 and 05) ═══════════════════════════════ */

function yearAt(t) {
  var B = D.beats;
  for (var i = 0; i < B.length; i++) {
    if (t <= B[i].t1 || i === B.length - 1) {
      var f = clamp((t - B[i].t0) / (B[i].t1 - B[i].t0), 0, 1);
      return B[i].y0 + (B[i].y1 - B[i].y0) * f;
    }
  }
  return 0;
}
function beatAt(t) {
  var B = D.beats;
  for (var i = 0; i < B.length; i++) if (t <= B[i].t1) return B[i];
  return B[B.length - 1];
}
function lookup(arr, x) {
  if (x <= arr[0][0]) return arr[0][1];
  var n = arr.length - 1;
  if (x >= arr[n][0]) return arr[n][1];
  var lo = 0, hi = n;
  while (hi - lo > 1) { var m = (lo + hi) >> 1; if (arr[m][0] <= x) lo = m; else hi = m; }
  var a = arr[lo], b = arr[hi];
  return a[1] + (b[1] - a[1]) * ((x - a[0]) / ((b[0] - a[0]) || 1));
}
function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function ss(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
function span(t, a, b) { return ss((t - a) / (b - a)); }
function lerp(a, b, f) { return a + (b - a) * f; }
function arc(a, b) { var d = b - a; while (d > 180) d -= 360; while (d < -180) d += 360; return d; }

/* ═══ 3 · THE CAMERA ═════════════════════════════════════════════════════
   t, sub-point lon/lat, altitude in earth radii, pitch from nadir, and
   bearing - the compass direction the camera leans toward, which at pitch 0
   is simply the direction that points to the top of the frame.

   The shape of the move: the beat runs oblique, low and eastward, so the
   emerging shelf reads as landscape. It rises once, after landfall, to look
   back at the water. Then it settles flat over Sulawesi - and the one moment
   the film becomes a map is the moment the map becomes a hand.            */

/* BEAT 05 IS THE FILM'S ONLY TRUE LOCK, and it is a lock in the strongest
   sense the code can express: the keyframes at 0.2300 and 0.2900 are the SAME
   TUPLE, so every lerp between them returns its own left operand exactly. The
   camera does not drift by a float. hashState puts the camera in the hash, so
   the purity test already proves the hold is bit-identical across sixty
   thousandths of t, and hold() in section 12 proves it is the only one.

   What carries a beat when the camera cannot: not the camera. The earth's own
   curve does, and it turns out to have a three-act shape sitting inside the
   lock for free. Sea level from data/sealevel_merged.json, over 60-50 ka:

       60.0-58.0 ka   -84.7 -> -85.7 m   nothing. the plume crosses.
       58.0-54.0 ka   -85.7 -> -70.1 m   FIFTEEN METRES IN FOUR THOUSAND YEARS
       54.0-50.0 ka   -70.1 -> -68.3 m   nothing again. the dead stretch.

   So the middle of the hold has the fastest waterline in the first half of the
   film, and the last fifth has nothing at all moving except the year. That was
   not designed. It was read off the curve, and it is the whole answer to
   whether a locked beat survives: it survives because the world is not locked,
   and then for one stretch at the end even the world stops and the reader is
   left with a number going down. Law 08 does the work the camera cannot.

   The frame holds BOTH DOORS, because the route is unresolved (dispersal-route
   is confidence "band") and a locked shot on one door would have chosen the
   route and then refused to move off its own choice for ten thousand years.
   The Red Sea runs up the frame with Sinai at the top and Bab-el-Mandeb at the
   bottom, which is why the bearing is north-north-west and not north.         */
var CAM = [
  /* the settle. Beat 04 ends pulled back and grey; the camera comes down and
     stops. All of the arriving happens BEFORE the beat, so motion 0 is 0. */
  [0.2150,  44.0,  24.0, 2.35,  8, 332],
  [0.2230,  40.0,  21.5, 1.35, 16, 334],
  [0.2300,  38.5,  20.5, 0.98, 20, 336],
  /* ------------------------- THE LOCK ------------------------- */
  [0.2900,  38.5,  20.5, 0.98, 20, 336],
  /* ------------------------------------------------------------ */
  /* The release. The largest velocity change in the film, and it is the reason
     the hold is worth its scroll: nothing, for ten thousand years, and then the
     whole of Asia in a second and a half. It rises to two earth radii first, so
     fifty-eight degrees of longitude read as the globe turning rather than as
     a whip pan, and it arrives on beat 06's own opening pose exactly. */
  [0.2925,  48.0,  20.0, 1.55, 12,  60],
  [0.2955,  72.0,  16.0, 1.95,  8,  78],
  [0.2980,  92.0,  12.0, 1.30, 14,  30],
  /* BEAT 06. The camera turns once, slowly, across the whole beat. It opens
     looking north over a Sundaland that is standing dry, so the reader can find
     themselves on a map they half know. It swings east to travel with the
     light. It ends looking south-east onto the coast of Sahul. Then it rises,
     and on the way down the world keeps turning - until an island is oriented
     like a hand. Untouched by Phase 5: every keyframe from here to 0.3950 is
     the shipped beat, and the release above was built to arrive on this pose
     rather than to renegotiate it. */
  [0.3000, 103.0,   7.0, 0.72, 26,  24],
  [0.3120, 108.0,   2.0, 0.48, 36,  32],
  [0.3260, 115.0,  -1.5, 0.38, 43,  62],
  [0.3350, 121.0,  -3.0, 0.32, 45,  95],
  [0.3440, 127.5,  -5.5, 0.30, 45, 112],
  [0.3480, 131.0,  -9.0, 0.28, 44, 132],
  [0.3520, 132.9, -11.8, 0.26, 43, 152],
  [0.3560, 128.0,  -5.0, 0.62, 14, 141],
  [0.3620, 120.8,  -2.1, 0.44,  3, 124],
  [0.3660, 120.16, -2.08, 0.40, 0, 118],
  [0.3900, 120.16, -2.08, 0.40, 0, 118],
  /* The beat ends pulled back and still roughly where it was. The swing west
     belongs to beat 07's opening, not to 06's last two frames - taking it here
     spun the map a hundred and seventy degrees in a third of a second. */
  [0.3950, 114.0,   5.0, 1.05, 16, 142],

  /* BEAT 07. The swing west, which beat 06 deliberately left on the table.
     Ninety-nine degrees of longitude - Sulawesi to the Atlantic, the whole
     distance the film has just spent two beats crossing, run backwards in
     about two seconds. That is the point of it and not a transport problem: it
     is the film saying "and meanwhile, all the way back there". It peaks at
     2.1 earth radii, where the apparent motion is low enough that the speed
     reads as the globe turning. */
  [0.4000,  92.0,  16.0, 1.72, 11, 250],
  [0.4040,  60.0,  32.0, 2.10,  8, 278],
  [0.4070,  34.0,  41.0, 1.55, 13, 290],
  [0.4090,  22.0,  44.0, 1.05, 19, 296],
  [0.4130,  14.0,  45.5, 0.82, 25, 302],
  /* Europe, close and slow: motion 2, a drift west that never becomes a move.
     The pale extent is withdrawing under it, and a camera doing anything
     interesting here would be competing with the only thing that matters. */
  [0.4230,   8.0,  46.0, 0.74, 29, 308],
  [0.4330,   2.5,  46.5, 0.70, 31, 314],
  [0.4400,  -1.5,  46.0, 0.68, 32, 317],
  /* The dead frame. NOT a hold - beat 05 keeps that, and the difference is
     deliberately made checkable rather than asserted: these two tuples differ,
     so the camera is still moving, by about a kilometre a second. hold() in
     section 12 counts the spans where the camera is bit-identical and fails if
     there is more than one. A dead frame is a local beat; a hold is a law. */
  [0.4550,  -2.6,  45.9, 0.675, 32, 317.4]
];
var FOV = 26;                                  /* a slightly long lens; it flattens */
var TAN_HALF = Math.tan(FOV / 2 * RAD);

function camAt(t) {
  var n = CAM.length;
  if (t <= CAM[0][0]) t = CAM[0][0];
  for (var i = 0; i < n - 1; i++) {
    if (t <= CAM[i + 1][0]) {
      var a = CAM[i], b = CAM[i + 1], f = ss((t - a[0]) / (b[0] - a[0]));
      return {
        lon: a[1] + arc(a[1], b[1]) * f,
        lat: lerp(a[2], b[2], f),
        alt: lerp(a[3], b[3], f),
        pitch: lerp(a[4], b[4], f),
        bearing: a[5] + arc(a[5], b[5]) * f
      };
    }
  }
  var z = CAM[n - 1];
  return { lon: z[1], lat: z[2], alt: z[3], pitch: z[4], bearing: z[5] };
}

/* world space: y is the pole, x through (0E, 0N) */
function xyz(lon, lat) {
  var cl = Math.cos(lat * RAD);
  return [cl * Math.cos(lon * RAD), Math.sin(lat * RAD), cl * Math.sin(lon * RAD)];
}
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function scale(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }

/* The frame the shader and the overlay both use. One definition, two consumers -
   if these ever disagree, the ember drifts off the coast it is standing on.

   A keyframe names the LOOK-AT point, which is what a director actually cares
   about: the thing at the centre of the frame. The camera position falls out of
   it. In the triangle centre-camera-target, the angle at the camera is the
   pitch and the sides are 1+alt and 1, so the sine rule gives the arc the
   camera must stand back along the reverse bearing:

        gamma = asin((1+alt) sin pitch) - pitch

   which also says the pitch cannot exceed asin(1/(1+alt)) - past that the
   camera is looking over the horizon and there is no ground at frame centre.  */
function localFrame(n) {
  var east = norm(cross(n, [0, 1, 0]));       /* +z at (0E,0N), which is east */
  return { east: east, north: cross(east, n) };
}
function frame(c) {
  var nL = xyz(c.lon, c.lat);
  var lf = localFrame(nL);
  var br = c.bearing * RAD;
  var hL = add(scale(lf.north, Math.cos(br)), scale(lf.east, Math.sin(br)));

  var R = 1 + c.alt;
  var pmax = Math.asin(Math.min(1, 1 / R)) * DEG - 0.35;
  var p = Math.min(c.pitch, pmax) * RAD;
  var g = Math.asin(clamp(R * Math.sin(p), -1, 1)) - p;

  /* stand back along the reverse bearing by gamma, then rise to altitude */
  var nS = norm(add(scale(nL, Math.cos(g)), scale(hL, -Math.sin(g))));
  var pos = scale(nS, R);

  var fwd = norm(sub(nL, pos));
  var sf = localFrame(nS);
  var hS = add(scale(sf.north, Math.cos(br)), scale(sf.east, Math.sin(br)));
  var up = norm(sub(hS, scale(fwd, dot(hS, fwd))));
  var right = cross(up, fwd);                 /* east to the right of frame */
  return { pos: pos, fwd: fwd, up: up, right: right, d: R,
           lookAt: nL, gamma: g * DEG, pitch: p * DEG };
}

/* project a lon/lat to screen pixels; null if behind the horizon or the lens */
function project(F, lon, lat) {
  var p = xyz(lon, lat);
  if (dot(p, norm(F.pos)) < 1 / F.d) return null;         /* over the horizon */
  var r = sub(p, F.pos), cz = dot(r, F.fwd);
  if (cz <= 1e-6) return null;
  return [W / 2 + (dot(r, F.right) / cz / TAN_HALF) * (H / 2),
          H / 2 - (dot(r, F.up) / cz / TAN_HALF) * (H / 2)];
}

/* ═══ 4 · THE REGISTERS  (Law 03, Law 04) ════════════════════════════════
   Orbital until the match cut, ground after it, and the cut itself is the
   only place the two are both on screen. `cut` is 0 orbital, 1 ground.     */

var CUT_IN = [0.3580, 0.3660], CUT_OUT = [0.3860, 0.3930];

function cutAt(t) {
  if (t < CUT_IN[0]) return 0;
  if (t < CUT_IN[1]) return span(t, CUT_IN[0], CUT_IN[1]);
  if (t < CUT_OUT[0]) return 1;
  if (t < CUT_OUT[1]) return 1 - span(t, CUT_OUT[0], CUT_OUT[1]);
  return 0;
}
function registerAt(t) {
  var c = cutAt(t);
  return c === 0 ? "orbital" : c === 1 ? "ground" : "match cut";
}

/* ═══ 5 · THE POPULATION  (Law 02, Law 04) ═══════════════════════════════
   A head that moves along a path with a trail behind it, never a light that
   appears and sits. The head is a short arc, not a dot, because the dot is a
   population. It slows across the open water, which is the only place in the
   beat where the earth is doing nothing and the people are doing everything. */

/* THREE GRAMMARS OF LIGHT, and the difference between them is an argument
   rather than a style.

     PLUME   (beat 05)  The evidence is a band, not a path. dispersal-route is
                        confidence "band", whose grammar in timeline.json reads
                        "Diffuse plume. Never a line." Two spines, both drawn,
                        neither favoured, because the two doors are unresolved.
     HEAD    (beats 06, 07)  A dispersal. A head moving along a path with a
                        trail behind it: Law 02's second clause.
     EXTENT  (beat 07)  A population that OCCUPIES rather than travels. Routes
                        are the wrong shape for a resident population, so the
                        pale light gets a field instead - and when it goes, the
                        field's patches SHRINK to nothing rather than fading,
                        because Law 08 forbids the fade and the shrink is the
                        same fact drawn as an edge.

   BEAT 05 IS THE ONE BEAT WHERE LAW 02'S SECOND CLAUSE DOES NOT APPLY.
   "Migration is light that travels, never lights that appear and sit" governs
   how a migration is drawn. Beat 05's subject is the negation of a migration:
   a light that is not going anywhere and is still lit. So the plume crosses in
   the first half of the lock, and then it stops and stays, and the staying IS
   the sentence. Any other beat doing this would be breaking the law. */

var ROUTES = {};                                        /* densified in start() */

function headAt(t) {
  /* Beat 06's thread. RETIMED AT THE FRONT ONLY, and by construction: the four
     phases below are identical to the shipped beat from t = 0.3000 onward, and
     headAt(0.3000) is still 0.352 to five places. What changed is that the
     ember no longer begins the film already in India - it now starts where beat
     05's plume left it, at 57E, and covers Arabia to Sumatra during the release.
     The camera flies east at the same time and they arrive together. */
  return clamp(
      span(t, 0.2900, 0.3000) * 0.352     /* the release: Arabia to the Bay of Bengal */
    + span(t, 0.3000, 0.3340) * 0.268     /* down through Asia and across Sunda */
    + span(t, 0.3340, 0.3480) * 0.16      /* the open water */
    + span(t, 0.3480, 0.3580) * 0.22,     /* into Sahul */
    0, 1);
}

/* Beat 05's plume. It crosses in the first half of the lock and completes at
   0.2760, which is where the sea-level curve goes flat - so the light stops
   moving at the same t the earth stops moving, and the dead stretch has nothing
   in it but a year going down and a light that is still on. */
function plumeAt(t) {
  /* The doors sit at 25% along the southern spine and 43% along the northern
     one, so the middle phase below is the crossing itself and it is given the
     most scroll for the least distance - the same shape beat 06 gives the open
     water at Wallacea. The first version ran the plume past both doors inside
     the first 5% of the beat, which spent the lock's whole budget on the part
     after the interesting part. */
  return clamp(0.04
    + span(t, 0.2300, 0.2440) * 0.18      /* down to the doors */
    + span(t, 0.2440, 0.2620) * 0.28      /* THROUGH them */
    + span(t, 0.2620, 0.2760) * 0.50,     /* up into Arabia, and stop */
    0, 1);
}

/* Beat 07's thread, already under way when the camera arrives - the swing west
   should read as "and meanwhile, all the way back there", not as a light that
   waited for the camera. */
function head7At(t) {
  return clamp(0.18
    + span(t, 0.3950, 0.4090) * 0.22
    + span(t, 0.4090, 0.4330) * 0.60,
    0, 1);
}

/* ---- the pale light, and Law 01's hardest case -------------------------
   THE CLAIM: when the second light goes out, that colour leaves the film's
   palette for the remaining seven beats.

   A flag would do this in one line and would be wrong, because a flag is a
   memory of a t you passed through, and Law 01 says the frame is a function of
   the t you are AT. Scrub backwards past a flag and the colour does not come
   back; scrub forwards to 0.9 without passing 0.44 and it never goes.

   As a function it is not merely possible, it is easier. paleRGB(t) returns the
   colour when the colour exists and NULL when it does not, and null is not a
   dimmed colour - it is nothing to draw with. Every site that draws pale light
   reads it and returns early. So the palette is not policed, it is absent.

   That this is a real function and not a flag is checkable, and it is checked
   twice: hashState carries paleRGB, so the purity test already proves the
   colour comes back at exactly the same t when you scrub backwards; and
   absence() walks t from the extinction to 1.0 - across seven beats that do
   not exist yet - and fails on any t where the colour is not null. Being able
   to test beats 08 to 14 today is the whole return on one continuous t.       */

var PALE_IN = [0.2830, 0.2890];     /* it is already waiting, at the top of the lock */
var PALE_OUT = [0.4300, 0.4405];    /* the withdrawal, and then the colour is gone */
var PALE_RGB = "208,180,152";       /* warm, because it is people - and paler than ember */
var PALE_K = 0.18;                  /* how long one patch takes to leave: patches overlap */

function paleRGBAt(t) {
  if (t >= PALE_OUT[1]) return null;                 /* gone, and gone for good */
  return span(t, PALE_IN[0], PALE_IN[1]) > 0 ? PALE_RGB : null;   /* and not yet arrived */
}
function paleAt(t) {
  return paleRGBAt(t) === null ? 0 : span(t, PALE_IN[0], PALE_IN[1]);
}
/* The withdrawal threshold. Runs past 1 by exactly PALE_K so that the last
   patch reaches zero radius rather than merely reaching its own rank. */
function paleOutAt(t) {
  return span(t, PALE_OUT[0], PALE_OUT[1]) * (1 + PALE_K);
}

/* ═══ 6 · STATE — the whole frame, as one pure function of t ═════════════ */

function stateFor(t) {
  var yr = yearAt(t);
  var sea = lookup(D.sea, yr);
  var temp = yr > 59900 ? null : lookup(D.temp, yr);
  var c = camAt(t);
  return {
    t: t, yr: yr, sea: sea, temp: temp,
    /* THE CHANNEL THAT GREYS THE SKY, lifted out of drawEarth so that it is
       state rather than a local. Law 06 was widened for the Campanian
       Ignimbrite on the promise that an epistemic object may not perturb
       stateFor - and the failure it was guarding against was, precisely, the
       eruption greying the European sky. This is the number that does that: it
       drives uChill, which tints the sky and the limb. It was computed inside
       the draw call, so it was not in the state, not in the hash, and not in
       the list of channels law06 walks. The test that exists to prove the
       eruption does not grey the sky was not watching the greying.

       temp is nullable - the NGRIP record stops at 60 ka - and chill is not:
       0.45 is the value the renderer already used for "no record". So chill is
       the total channel and temp is the raw one, and law06 now walks both. */
    chill: temp === null ? 0.45 : clamp((-temp - 34) / 12, 0, 1),
    beat: beatAt(t).id,
    cut: cutAt(t),
    lon: c.lon, lat: c.lat, alt: c.alt, pitch: c.pitch, bearing: c.bearing,
    /* the three lights */
    plume: plumeAt(t),
    head: headAt(t),
    head7: head7At(t),
    /* the palette itself is a function of t: null is not a dim colour, it is
       no colour, and there is nothing downstream that can draw with it */
    paleRGB: paleRGBAt(t),
    pale: paleAt(t),
    paleOut: paleOutAt(t),
    /* which frame tile is bound. A render decision, but it is a pure function
       of t like everything else, so it goes in the state and in the hash and
       the purity test covers it. */
    tile: tileFor(t),
    /* how much of the shelf is standing dry, as a fraction of the beat's own
       range - drives the ghost coastline's weight, nothing else */
    expose: clamp(-sea / 131, 0, 1)
  };
}
function hashState(s) {
  return [s.t.toFixed(5), s.yr.toFixed(2), s.sea.toFixed(4),
          s.temp === null ? "n" : s.temp.toFixed(4), s.chill.toFixed(5),
          s.beat, s.cut.toFixed(5),
          s.lon.toFixed(4), s.lat.toFixed(4), s.alt.toFixed(5),
          s.pitch.toFixed(4), s.bearing.toFixed(4),
          s.plume.toFixed(5), s.head.toFixed(5), s.head7.toFixed(5),
          s.paleRGB === null ? "none" : s.paleRGB,
          s.pale.toFixed(5), s.paleOut.toFixed(5), s.tile,
          s.expose.toFixed(5)].join("|");
}

/* ═══ 7 · THE RENDERER — a fragment shader ═══════════════════════════════
   The film carries no coastline geometry at all. One elevation raster, one
   float, one comparison, and every shoreline in the beat falls out of it -
   including the ones that have been under water for twelve thousand years. */

var VERT =
"#version 300 es\n" +
"void main(){\n" +
"  vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2);\n" +
"  gl_Position = vec4(p*2.0-1.0, 0.0, 1.0);\n" +
"}\n";

var FRAG =
"#version 300 es\n" +
"precision highp float;\n" +
"out vec4 frag;\n" +
"uniform vec2 uRes;\n" +
"uniform sampler2D uGlobal, uTile;\n" +
"uniform vec4 uBox;               // tile lon0, lon1, lat0, lat1\n" +
"uniform float uScale, uOffset;   // terrain-RGB decode, fallback path only\n" +
"uniform int uFloatElev, uDebug;\n" +
"uniform vec2 uGlobalSize, uTileSize;\n" +
"uniform float uSea, uTanHalf, uChill, uFade, uGhost, uCopy;\n" +
"uniform vec3 uCam, uFwd, uUp, uRight;\n" +
"const float PI = 3.141592653589793;\n" +
"\n" +
"// Metres, either straight out of a float texture or unpacked from the\n" +
"// terrain-RGB fallback for a machine without EXT_color_buffer_float.\n" +
"float dec(vec3 c){\n" +
"  return uFloatElev == 1 ? c.r : (c.r*255.0*256.0 + c.g*255.0)*uScale + uOffset;\n" +
"}\n" +
"\n" +
"// One elevation field. The tile is the same ETOPO grid at 60\", so the two\n" +
"// textures agree and the crossfade across the tile border is invisible.\n" +
"// No branch around the tile fetch: derivatives inside non-uniform flow are\n" +
"// undefined, and the whole beat depends on those derivatives.\n" +
"struct Sample { vec2 g; vec2 q; float k; float lg; float lt; };\n" +
"\n" +
"Sample locate(vec2 ll){\n" +
"  Sample s;\n" +
"  s.g = vec2(ll.x/360.0 + 0.5, 0.5 - ll.y/180.0);\n" +
"  s.q = vec2((ll.x-uBox.x)/(uBox.y-uBox.x), (uBox.w-ll.y)/(uBox.w-uBox.z));\n" +
"  float m = min(min(s.q.x, 1.0-s.q.x), min(s.q.y, 1.0-s.q.y));\n" +
"  s.k = smoothstep(0.0, 0.030, m);\n" +
"  // the mip level the hardware would have picked, computed by hand so the\n" +
"  // smoothed field can ask for one level coarser without four more taps\n" +
"  vec2 ax = dFdx(s.g)*uGlobalSize, ay = dFdy(s.g)*uGlobalSize;\n" +
"  s.lg = 0.5*log2(max(max(dot(ax,ax), dot(ay,ay)), 1.0));\n" +
"  vec2 bx = dFdx(s.q)*uTileSize,   by = dFdy(s.q)*uTileSize;\n" +
"  s.lt = 0.5*log2(max(max(dot(bx,bx), dot(by,by)), 1.0));\n" +
"  return s;\n" +
"}\n" +
"float elevAt(Sample s, float bias){\n" +
"  return mix(dec(textureLod(uGlobal, s.g, s.lg + bias).rgb),\n" +
"             dec(textureLod(uTile, clamp(s.q,0.0,1.0), s.lt + bias).rgb), s.k);\n" +
"}\n" +
"\n" +
"vec2 lonlat(vec3 p){ return vec2(atan(p.z,p.x)*180.0/PI, asin(clamp(p.y,-1.0,1.0))*180.0/PI); }\n" +
"\n" +
"void main(){\n" +
"  vec2 ndc = (gl_FragCoord.xy - uRes*0.5) / (uRes.y*0.5);\n" +
"  vec3 dir = normalize(uFwd + uRight*ndc.x*uTanHalf + uUp*ndc.y*uTanHalf);\n" +
"\n" +
"  float b = dot(uCam, dir), c = dot(uCam,uCam) - 1.0;\n" +
"  float disc = b*b - c;\n" +
"\n" +
"  // ---- sky. Cold, thin, and it is the only reason a low angle reads. ----\n" +
"  if (disc <= 0.0){\n" +
"    float graze = clamp(-disc*8.0, 0.0, 1.0);\n" +
"    vec3 sky = mix(vec3(0.055,0.083,0.125), vec3(0.012,0.019,0.032), graze);\n" +
"    sky = mix(sky, vec3(0.016,0.024,0.039), uChill*0.5);\n" +
"    frag = vec4(sky*uFade, 1.0); return;\n" +
"  }\n" +
"  vec3 p = uCam + dir*(-b - sqrt(disc));\n" +
"  vec2 ll = lonlat(p);\n" +
"  Sample sm = locate(ll);\n" +
"  float e = elevAt(sm, 0.0);\n" +
"\n" +
"  // A coastline is fractal. At a pixel a metre of roughness flips the sign of\n" +
"  // the threshold back and forth, and an edge drawn on the raw field comes\n" +
"  // out as frost scattered over ten pixels instead of a line. Smoothing to\n" +
"  // the pixel the frame actually has is not cheating - it is drawing the\n" +
"  // coast at the scale the frame can hold, which is what a chart does.\n" +
"  //\n" +
"  // One mip level coarser IS that smoothing, and it costs one fetch instead\n" +
"  // of four taps. The first version sampled five times in each of two\n" +
"  // textures and ran at 1.3 frames a second on integrated graphics.\n" +
"  float eS = elevAt(sm, 1.25);\n" +
"\n" +
"  // ---- relief, from the screen gradient of the smoothed field: free. ----\n" +
"  vec3 nrm = normalize(vec3(-dFdx(eS)*0.055, dFdy(eS)*0.055, 1.0));\n" +
"  float lam = clamp(dot(nrm, normalize(vec3(-0.55,0.62,0.56))), 0.0, 1.0);\n" +
"\n" +
"  float above = e - uSea;\n" +
"  float aboveS = eS - uSea;\n" +
"  vec3 col;\n" +
"\n" +
"  if (above > 0.0){\n" +
"    // keyed to elevation, not to depth below the waterline: how high ground\n" +
"    // is does not change when the sea moves, and the tone should not either\n" +
"    float h = clamp(e/3800.0, 0.0, 1.0);\n" +
"    // land that is still land today\n" +
"    vec3 old = mix(vec3(0.190,0.216,0.252), vec3(0.400,0.415,0.432), h);\n" +
"    // LAW 08: the shelf is not a fade. It is the band between two hard edges,\n" +
"    // and it is paler because it has been sea floor until now. Its tone\n" +
"    // carries how deep it used to be, which is the only structure a plain\n" +
"    // this flat actually has - and it is measured, not invented.\n" +
"    vec3 shelf = mix(vec3(0.352,0.368,0.382), vec3(0.286,0.304,0.322),\n" +
"                     clamp(-e/110.0, 0.0, 1.0));\n" +
"    float isShelf = step(e, 0.0);\n" +
"    col = mix(old, shelf, isShelf);\n" +
"    col *= 0.70 + 0.46*lam;\n" +
"  } else {\n" +
"    float dep = clamp(-above/2600.0, 0.0, 1.0);\n" +
"    col = mix(vec3(0.052,0.082,0.130), vec3(0.014,0.024,0.044), dep);\n" +
"    col = mix(col, vec3(0.072,0.108,0.155), 1.0-smoothstep(0.0,190.0,-above));\n" +
"  }\n" +
"\n" +
"  // ---- LAW 08: two edges, each one pixel wide at any zoom ----\n" +
"  // Distance to the zero crossing IN PIXELS, not in metres: a metre threshold\n" +
"  // frosts a flat shelf white, a pixel threshold draws a line. And gated on\n" +
"  // slope, because ground that is flat AND at sea level has no coastline to\n" +
"  // draw - that is a tidal plain, and the honest rendering of it is nothing.\n" +
"  float gAbove = length(vec2(dFdx(aboveS), dFdy(aboveS)));\n" +
"  float live = (1.0 - smoothstep(0.40, 1.15, abs(aboveS)/max(gAbove, 1e-5)))\n" +
"             * smoothstep(0.6, 2.4, gAbove);\n" +
"  float gg = length(vec2(dFdx(eS), dFdy(eS)));\n" +
"  float ghost = (1.0 - smoothstep(0.40, 1.15, abs(eS)/max(gg, 1e-5)))\n" +
"                * smoothstep(0.6, 2.4, gg) * uGhost;\n" +
"  // The coastline we know is a memory and is drawn like one; the coastline\n" +
"  // they walked is the subject. If they ever read as equals the shot has\n" +
"  // stopped saying which one is happening.\n" +
"  col = mix(col, vec3(0.318,0.404,0.510), ghost*0.55);\n" +
"  col = mix(col, vec3(0.918,0.902,0.863), live*0.82);\n" +
"\n" +
"  // ---- limb. Falls off toward the horizon, never a halo. ----\n" +
"  float grz = clamp(dot(normalize(p), -dir), 0.0, 1.0);\n" +
"  col *= 0.56 + 0.44*smoothstep(0.0, 0.34, grz);\n" +
"  col += vec3(0.043,0.063,0.090) * pow(1.0-grz, 3.0) * (0.55 + uChill*0.35);\n" +
"\n" +
"  // ---- graduated filter. The frame's own edges come down so the ruler and\n" +
"  // the head can live there, and the lower left comes down further while\n" +
"  // there is a sentence in it. A graduated ND is grading; it is not a plate\n" +
"  // behind a word, and it leaves when the word does. ----\n" +
"  vec2 uv = gl_FragCoord.xy / uRes;\n" +
"  col *= mix(0.30, 1.0, smoothstep(0.0, 0.20, uv.y));\n" +
"  col *= mix(0.52, 1.0, smoothstep(1.0, 0.90, uv.y));\n" +
"  // A graduated ND across the left third, weighted to the bottom, for as long\n" +
"  // as there is a sentence standing in it. The copy column is a fixed place,\n" +
"  // so the grade is a fixed place, and it leaves when the copy leaves.\n" +
"  float band = smoothstep(0.46, 0.04, uv.x) * (0.55 + 0.45*smoothstep(0.85, 0.12, uv.y));\n" +
"  col *= mix(1.0, 0.34, clamp(band, 0.0, 1.0)*uCopy);\n" +
"\n" +
"  // ---- the director's x-ray. This is how the waterline got fixed, and the\n" +
"  // next person to fight it will want it back. Cycled with the d key. ----\n" +
"  if (uDebug == 1) col = vec3(live);\n" +
"  if (uDebug == 2) col = vec3(ghost);\n" +
"  if (uDebug == 3) col = vec3(gAbove/40.0);\n" +
"  if (uDebug == 4) col = vec3(abs(above)/max(gAbove,1e-5)/4.0);\n" +
"\n" +
"  frag = vec4(col*uFade, 1.0);\n" +
"}\n";

/* WHICH FRAME TILE IS BOUND, as a function of t.

   Three beats now need three high-resolution tiles, and the obvious move was
   three more samplers - which doubles the elevation fetches per pixel from two
   to eight, for tiles that are eighty degrees of longitude apart and can never
   be in the same frame. So there is ONE tile slot and the CPU swaps the texture
   into it. The shader is byte-for-byte the shipped one, and the earth pass
   costs what it cost in Phase 4.

   NEITHER SWAP IS CLEAN, and the first draft of this comment claimed one of
   them was, which was wrong and worth correcting rather than leaving.

   At the top of each transit the camera is about two earth radii up and the
   frame is roughly fifty degrees across. The Red Sea tile ends at 62E and Sunda
   begins at 92E - thirty degrees apart - so there is no camera longitude on
   that arc where a frame that wide holds neither of them. Same for Sunda into
   Europe. A single slot therefore cannot avoid swapping while the outgoing tile
   is still clipping a frame edge.

   What makes it acceptable is not geometry, it is speed. Both swaps are put at
   the top of the arc, where the camera is crossing about ten degrees of
   longitude per frame: the change is one frame, in a band at the frame's edge,
   inside the tile's own 3% blend margin, and the tile and the global texture
   encode the same field so it is a resolution change and never a value change.

   The alternative is a second slot and a crossfade, which doubles the
   elevation fetches from two to eight per pixel - for the whole film - to buy
   two frames. The budget could afford it and it would still be the wrong
   trade. If it ever shows on a real screen, that is the fix.                  */
function tileFor(t) {
  if (t < 0.2950) return "redsea";
  if (t < 0.4025) return "sunda";
  return "europe";
}

function shader(type, src) {
  var s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s));
  return s;
}
var ANISO = 0, FLOAT_ELEV = false;

/* Terrain-RGB is not mip-safe, and this cost a day to find.

   Elevation is stored as (R*256 + G), so R is the high byte. A mip level
   averages R across its four texels and rounds to eight bits, and half a step
   of R is 128 elevation units - thirty-nine metres. Averaging happens exactly
   where R changes, which is exactly at a coastline, so the one place the film
   cannot afford to be wrong is the one place the encoding is worst. On a shelf
   sloping a tenth of a metre per kilometre, thirty-nine metres moves the
   waterline several hundred kilometres.

   So the bytes are decoded once, on load, into a real float texture. Mip
   averaging of a float elevation IS elevation averaging, which makes the
   pyramid valid, the derivatives clean, and the shader shorter: no decode. */
function decodePNG(img, meta, timing) {
  var c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  var x = c.getContext("2d", { willReadFrequently: false });
  var t0 = performance.now();
  x.drawImage(img, 0, 0);
  /* drawImage is where the browser must make decoded PNG pixels available to
     the canvas. It can include a canvas copy too, so call it image decode on
     the panel only with that boundary stated there. */
  if (timing) timing.imageDecode = performance.now() - t0;
  t0 = performance.now();
  var d = x.getImageData(0, 0, img.width, img.height).data;
  if (timing) timing.readback = performance.now() - t0;
  var n = img.width * img.height, out = new Float32Array(n);
  var sc = meta.scale, off = meta.offset;
  t0 = performance.now();
  for (var i = 0, j = 0; i < n; i++, j += 4) out[i] = (d[j] * 256 + d[j + 1]) * sc + off;
  if (timing) timing.terrainDecode = performance.now() - t0;
  return out;
}

function elevTexture(img, wrap, meta, timing) {
  var tx = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tx);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  if (FLOAT_ELEV) {
    /* Decode before starting the upload clock. JavaScript evaluates call
       arguments first; timing texImage2D(decodePNG(...)) would quietly time
       the very phases this instrument is supposed to separate. */
    var elev = decodePNG(img, meta, timing);
    var uploadAt = performance.now();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, img.width, img.height, 0,
                  gl.RED, gl.FLOAT, elev);
    if (timing) timing.upload = performance.now() - uploadAt;
  } else {
    var uploadAt = performance.now();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, gl.RGB, gl.UNSIGNED_BYTE, img);
    if (timing) timing.upload = performance.now() - uploadAt;
  }
  var mip = FLOAT_ELEV;
  if (mip) {
    var mipAt = performance.now();
    try { gl.generateMipmap(gl.TEXTURE_2D); } catch (e) { mip = false; }
    if (timing) timing.mipmap = performance.now() - mipAt;
    if (gl.getError() !== gl.NO_ERROR) mip = false;
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER,
                   mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  /* almost every frame in this beat is a grazing angle, which is exactly the
     case isotropic mips over-blur; without this the far half of the shelf
     turns to mud */
  /* Capped at four. The elevation is fetched at an explicit LOD, which does
     not use anisotropy anyway, and at maximum it cost more than the grazing
     angles were worth. */
  var ext = gl.getExtension("EXT_texture_filter_anisotropic");
  if (ext && mip) {
    ANISO = Math.min(4, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT));
    gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, ANISO);
  }
  return tx;
}

/* Context attributes, most wanted first. A driver that refuses one combination
   will often accept a plainer one, and the only thing in the first set that
   the film actually needs is antialias - preserveDrawingBuffer exists so the
   frame can be screenshotted, which is a workshop convenience, not a feature.
   Giving up on the first refusal turned a fussy driver into "needs WebGL2". */
var GL_ATTEMPTS = [
  { antialias: true, alpha: false, depth: false, preserveDrawingBuffer: true },
  { antialias: true, alpha: false, depth: false },
  { alpha: false, depth: false },
  {}
];
var GL_TRIED = [];

/* Throwaway probe on its own canvas, so asking the question does not consume
   the real canvas's one shot at a context. */
function probeGL(type, attrs) {
  var c = document.createElement("canvas"), g = null;
  try { g = c.getContext(type, attrs || {}); }
  catch (e) { return { ok: false, err: String((e && e.message) || e) }; }
  if (!g) return { ok: false };
  var d = g.getExtension("WEBGL_debug_renderer_info");
  var out = { ok: true, renderer: String(d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL)
                                           : g.getParameter(g.RENDERER)) };
  var lose = g.getExtension("WEBGL_lose_context");
  if (lose) lose.loseContext();
  return out;
}

function initGL() {
  /* ?nogl=1 forces the refusal, because an error path you cannot reach is an
     error path you have not tested - and this one was broken for a week. */
  if (/[?&]nogl=1/.test(location.search)) {
    GL_TRIED.push("forced by ?nogl=1");
    var forced = new Error("WebGL2 did not start."); forced.gl = true; throw forced;
  }
  for (var i = 0; i < GL_ATTEMPTS.length && !gl; i++) {
    try { gl = earth.getContext("webgl2", GL_ATTEMPTS[i]); }
    catch (e) { GL_TRIED.push(JSON.stringify(GL_ATTEMPTS[i]) + " threw " + e.message); continue; }
    GL_TRIED.push(JSON.stringify(GL_ATTEMPTS[i]) + (gl ? "  ok" : "  refused"));
  }
  if (!gl) { var err = new Error("WebGL2 did not start."); err.gl = true; throw err; }
  prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  gl.bindVertexArray(gl.createVertexArray());

  ["uRes", "uGlobal", "uTile", "uBox", "uScale", "uOffset", "uSea", "uTanHalf", "uFloatElev", "uDebug", "uGlobalSize", "uTileSize",
   "uChill", "uFade", "uGhost", "uCopy", "uCam", "uFwd", "uUp", "uRight"]
    .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

  var any = D.measured.tiles.sunda;                /* all three share the encoding */
  gl.uniform1f(U.uTanHalf, TAN_HALF);

  FLOAT_ELEV = !!gl.getExtension("EXT_color_buffer_float");
  /* KEPT, not discarded: bindTile() puts this same texture into the tile slot
     while a tile is still in flight. */
  gl.activeTexture(gl.TEXTURE0); TXG = elevTexture(TEXG, gl.REPEAT, any);
  gl.uniform1i(U.uGlobal, 0);
  gl.uniform2f(U.uGlobalSize, TEXG.width, TEXG.height);

  /* Each frame tile is decoded and uploaded ONCE. Decoding a 4320x1860
     terrain-RGB image into floats takes a good fraction of a second, and the
     one place that must never happen is mid-scroll at a beat boundary - the
     same reason the stencil plate is built at load. Only the binding changes
     per frame, and a binding is free.

     ONLY THE TILES THAT HAVE ARRIVED. The other two are uploaded by loadRest()
     as they land, in an idle callback, for the reason above. */
  gl.activeTexture(gl.TEXTURE1);
  Object.keys(TEX).forEach(function (k) {
    if (TEX[k]) TXO[k] = elevTexture(TEX[k], gl.CLAMP_TO_EDGE, any);
  });
  gl.uniform1i(U.uTile, 1);

  TQ.ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  gl.uniform1i(U.uFloatElev, FLOAT_ELEV ? 1 : 0);
  gl.uniform1f(U.uScale, any.scale);
  gl.uniform1f(U.uOffset, any.offset);
}

/* GPU time for the earth pass, from EXT_disjoint_timer_query_webgl2.

   The frame-interval readout is clamped by vsync: 16.7 ms means nothing was
   dropped, and says nothing about how much of the budget was used. That
   difference is the whole question for the remaining thirteen beats, which
   will stack ice, sky and more routes on top of this shader. A timer query
   answers it directly - it is the GPU's own clock, not the frame's. */
var TQ = { ext: null, q: null, active: false, pending: false, ms: -1 };

function gpuTimerPoll() {
  if (!TQ.pending || !TQ.q) return;
  if (gl.getParameter(TQ.ext.GPU_DISJOINT_EXT)) { TQ.pending = false; return; }
  if (gl.getQueryParameter(TQ.q, gl.QUERY_RESULT_AVAILABLE)) {
    TQ.ms = gl.getQueryParameter(TQ.q, gl.QUERY_RESULT) / 1e6;
    TQ.pending = false;
  }
}

var boundTile = "";

/* THE FRAME TILE, CHOSEN BY t - and what to draw before it has arrived.

   Rebinding only when the choice actually changes keeps this off the per-frame
   path entirely for all but two frames in the film.

   The tile may not be there yet: two of the three are now fetched after the
   film starts, so that the reader waits for one raster and not for three. The
   fallback binds THE GLOBAL TEXTURE into the tile slot and hands it the whole
   world as its box. Then s.q is s.g to the bit, and s.lt is s.lg, so elevAt
   mixes the global field with itself and the frame IS the global field - a
   resolution change, never a value change, and no branch anywhere near a
   derivative (invariant 3). Law 08's edge is still an edge computed from real
   elevation; it is simply a coarser one for a few seconds.

   The key carries the pending state, so the arrival of a tile rebinds instead
   of being cached out. */
function bindTile(name) {
  var key = (TXO[name] ? "" : "~") + name;
  if (key === boundTile) return;
  gl.activeTexture(gl.TEXTURE1);
  if (TXO[name]) {
    var tl = D.measured.tiles[name];
    gl.bindTexture(gl.TEXTURE_2D, TXO[name]);
    gl.uniform4f(U.uBox, tl.lon0, tl.lon1, tl.lat0, tl.lat1);
    gl.uniform2f(U.uTileSize, tl.w, tl.h);
  } else {
    gl.bindTexture(gl.TEXTURE_2D, TXG);
    gl.uniform4f(U.uBox, -180, 180, -90, 90);
    gl.uniform2f(U.uTileSize, TEXG.width, TEXG.height);
  }
  boundTile = key;
}

function drawEarth(s, F) {
  var chill = s.chill;                       /* computed in stateFor - see there */

  bindTile(s.tile);

  gl.uniform2f(U.uRes, earth.width, earth.height);
  gl.uniform1f(U.uSea, s.sea);
  gl.uniform1f(U.uChill, chill);
  gl.uniform1f(U.uFade, 1 - s.cut);
  gl.uniform1f(U.uGhost, clamp(s.expose * 3.0, 0, 1));
  gl.uniform1f(U.uCopy, copyEnvelope(s.t));
  gl.uniform1i(U.uDebug, DEBUG);
  gl.uniform3fv(U.uCam, F.pos);
  gl.uniform3fv(U.uFwd, F.fwd);
  gl.uniform3fv(U.uUp, F.up);
  gl.uniform3fv(U.uRight, F.right);

  gpuTimerPoll();
  if (TQ.ext && !TQ.pending && !TQ.active) {
    if (!TQ.q) TQ.q = gl.createQuery();
    gl.beginQuery(TQ.ext.TIME_ELAPSED_EXT, TQ.q);
    TQ.active = true;
  }
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  if (TQ.active) {
    gl.endQuery(TQ.ext.TIME_ELAPSED_EXT);
    TQ.active = false; TQ.pending = true;
  }
}

/* ═══ 8 · THE OVERLAY ════════════════════════════════════════════════════ */

/* ICED is --ice-dim, and the two must not drift: the film draws a margin
   label's value in it on canvas and the atlas prints that same string as HTML
   in the CSS token. Lifted with the token on 2026-09-08, from 95,119,148. */
var EMBER = "232,112,58", BONE = "230,226,216", ICE = "143,168,196", ICED = "100,124,153";

/* Catmull-Rom through the waypoints. A route drawn as straight segments shows
   its own corners, and a corner reads as a decision - which is exactly the
   claim the data file says this path is NOT making. */
function densify(path, n) {
  var P = [path[0]].concat(path, [path[path.length - 1]]);
  var out = [];
  for (var i = 1; i < P.length - 2; i++) {
    for (var k = 0; k < n; k++) {
      var f = k / n, f2 = f * f, f3 = f2 * f, c = [0, 0];
      for (var d = 0; d < 2; d++) {
        var p0 = P[i - 1][d], p1 = P[i][d], p2 = P[i + 1][d], p3 = P[i + 2][d];
        c[d] = 0.5 * ((2 * p1) + (-p0 + p2) * f +
               (2 * p0 - 5 * p1 + 4 * p2 - p3) * f2 +
               (-p0 + 3 * p1 - 3 * p2 + p3) * f3);
      }
      out.push(c);
    }
  }
  out.push(path[path.length - 1]);
  return out;
}

function drawRoute(s, F, ROUTE, head, rgb, headRGB) {
  if (head <= 0) return null;
  var n = ROUTE.length, upto = head * (n - 1);
  var pts = [], i;
  for (i = 0; i <= Math.floor(upto); i++) {
    var q = project(F, ROUTE[i][0], ROUTE[i][1]);
    pts.push(q ? { x: q[0], y: q[1], f: i / (n - 1) } : null);
  }
  /* the trail: brightest at the head, never fully gone behind it.
     A point just inside the horizon projects hundreds of screen-widths away,
     so a segment with an endpoint far outside the frame is a projection
     artefact, not a journey, and is dropped. */
  octx.lineCap = "round"; octx.lineJoin = "round";
  function near(q) { return q.x > -W && q.x < 2 * W && q.y > -H && q.y < 2 * H; }
  for (i = 1; i < pts.length; i++) {
    if (!pts[i] || !pts[i - 1]) continue;
    if (!near(pts[i]) || !near(pts[i - 1])) continue;
    var age = (head - pts[i].f) / Math.max(head, 1e-3);
    var a = (1 - age) * 0.75 + 0.16;
    octx.strokeStyle = "rgba(" + rgb + "," + (a * 0.8).toFixed(3) + ")";
    octx.lineWidth = 1.0 + (1 - age) * 1.9;
    octx.beginPath(); octx.moveTo(pts[i - 1].x, pts[i - 1].y);
    octx.lineTo(pts[i].x, pts[i].y); octx.stroke();
  }

  /* the head. LAW 04: the dot is a population, so it is an arc across the
     direction of travel, not a point. */
  var hi = clamp(Math.floor(upto), 0, n - 2);
  var pa = project(F, ROUTE[hi][0], ROUTE[hi][1]);
  var pb = project(F, ROUTE[hi + 1][0], ROUTE[hi + 1][1]);
  if (!pa || !pb) return null;
  var fx = upto - hi;
  var hx = lerp(pa[0], pb[0], fx), hy = lerp(pa[1], pb[1], fx);
  var dx = pb[0] - pa[0], dy = pb[1] - pa[1], dl = Math.hypot(dx, dy) || 1;
  var nx = -dy / dl, ny = dx / dl;
  var half = 9;

  var g = octx.createRadialGradient(hx, hy, 0, hx, hy, 26);
  g.addColorStop(0, "rgba(" + rgb + ",0.42)");
  g.addColorStop(1, "rgba(" + rgb + ",0)");
  octx.fillStyle = g;
  octx.beginPath(); octx.arc(hx, hy, 26, 0, 6.2832); octx.fill();

  octx.strokeStyle = "rgba(" + headRGB + ",0.96)";
  octx.lineWidth = 2.6;
  octx.beginPath();
  octx.moveTo(hx - nx * half, hy - ny * half);
  octx.quadraticCurveTo(hx + dx / dl * 5, hy + dy / dl * 5, hx + nx * half, hy + ny * half);
  octx.stroke();
  return [hx, hy];
}

/* -- soft light, cheaply ---------------------------------------------------
   The plume and the pale extent are both hundreds of soft dots per frame, and
   a radial gradient per dot per frame is the wrong order of magnitude - it is
   seven thousand gradient objects a second. So each colour gets ONE sprite,
   built at load, and a dot is a drawImage.

   That is a second pre-built image in the loop, where invariant 6 said there
   was one. The invariant's actual content is "nothing expensive is built
   inside the loop", and these are built at load beside the stencil plate. The
   wording in CLAUDE.md has been corrected rather than quietly stretched.     */
var DOT = {}, DOT_R = 48;

function buildDot(rgb) {
  var c = document.createElement("canvas");
  c.width = c.height = DOT_R * 2;
  var x = c.getContext("2d");
  var g = x.createRadialGradient(DOT_R, DOT_R, 0, DOT_R, DOT_R, DOT_R);
  g.addColorStop(0.00, "rgba(" + rgb + ",0.95)");
  g.addColorStop(0.34, "rgba(" + rgb + ",0.40)");
  g.addColorStop(1.00, "rgba(" + rgb + ",0)");
  x.fillStyle = g;
  x.fillRect(0, 0, DOT_R * 2, DOT_R * 2);
  return c;
}
function blot(c, x, y, r, a) {
  if (!c || r <= 0.4 || a <= 0.004) return;
  octx.globalAlpha = a > 1 ? 1 : a;
  octx.drawImage(c, x - r, y - r, r * 2, r * 2);
}
/* screen pixels per degree of great circle at a point - so a blob drawn over
   the ground keeps its size in KILOMETRES as the camera moves, instead of
   pulsing every time the altitude changes */
function degPx(F, lon, lat) {
  var k = Math.max(0.25, Math.cos(lat * RAD));
  var a = project(F, lon - 0.25 / k, lat), b = project(F, lon + 0.25 / k, lat);
  if (!a || !b) return null;
  return Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5;
}

/* -- beat 05: the plume  (Law 02's band case) ----------------------------
   dispersal-route is confidence "band", and timeline.json spells out what that
   obliges: "Diffuse plume. Never a line." Two spines are drawn, breakout and
   breakout-north, at equal weight - the second one exists because until Phase 5
   the film had geometry for only one of the two doors it says are unresolved,
   which meant the renderer chose the route while the caption said it hadn't.

   Particles trail the leading edge by a fixed lag, so the cloud is dense at the
   front and thins behind. At full progress the lags leave it spread along the
   last third of the path rather than collapsed to a point: the light arrives as
   a population standing in Arabia, and then it stays there, lit, which is the
   only thing beat 05 is about.                                              */
var PLUME = null, PLUME_PER = 46, PLUME_LAG = 0.46;

function buildPlume() {
  var out = [];
  ["breakout", "breakout-north"].forEach(function (id, si) {
    for (var i = 0; i < PLUME_PER; i++) {
      var a = hash2(si * 977 + i * 13, 7919);
      var b = hash2(i * 31 + 5, si * 641 + 13);
      var c = hash2(i * 101 + si, 4409);
      out.push({ id: id,
                 lag: PLUME_LAG * (i / (PLUME_PER - 1)) + (c - 0.5) * 0.022,
                 off: (a - 0.5) * 2, sz: 0.62 + 0.66 * b });
    }
  });
  return out;
}

function drawPlume(s, F) {
  var a = labelAlpha(s.t, [0.2255, 0.2995]);
  if (a <= 0.01 || s.plume <= 0) return;
  var dot = DOT[EMBER];
  octx.globalCompositeOperation = "lighter";
  for (var i = 0; i < PLUME.length; i++) {
    var p = PLUME[i], R = ROUTES[p.id], n = R.length;
    var u = clamp(s.plume - p.lag, 0, 1) * (n - 1);
    var i0 = clamp(Math.floor(u), 0, n - 2), f = u - i0;
    var lon = lerp(R[i0][0], R[i0 + 1][0], f);
    var lat = lerp(R[i0][1], R[i0 + 1][1], f);
    /* offset perpendicular to the spine, wide at the doors and tapering: the
       uncertainty about WHERE they went is largest at the crossing itself */
    var kx = Math.max(0.25, Math.cos(lat * RAD));
    var dx = (R[i0 + 1][0] - R[i0][0]) * kx, dy = R[i0 + 1][1] - R[i0][1];
    var dl = Math.hypot(dx, dy) || 1;
    var w = lerp(1.62, 0.72, u / (n - 1)) * p.off;
    lon += (-dy / dl) * w / kx;
    lat += (dx / dl) * w;

    var q = project(F, lon, lat);
    if (!q || q[0] < -140 || q[0] > W + 140 || q[1] < -140 || q[1] > H + 140) continue;
    var sc = degPx(F, lon, lat);
    if (!sc) continue;
    var fade = 1 - p.lag / (PLUME_LAG + 0.03);
    blot(dot, q[0], q[1], sc * 0.92 * p.sz, a * (0.055 + 0.175 * fade));
  }
  octx.globalCompositeOperation = "source-over";
  octx.globalAlpha = 1;
}

/* -- beat 07: the pale extent, and its withdrawal  (Laws 02 and 08) -------
   A population that occupies rather than travels, so it is a field and not a
   route. Every patch is a point on land inside the indicative ring in
   timeline.json, and the ORDER they go out is baked into the data file - fixed,
   inspectable, dateless, and deliberately not a wave, because Higham 2014 finds
   the disappearance was staggered rather than swept.

   The patches SHRINK. They do not fade. Law 08 is explicit that a gradient says
   atmosphere and an edge says something is happening, and a field of lights
   dimming together is the exact thing it forbids - it would also read as one
   population getting quieter, when what the evidence describes is range
   contracting in a mosaic. Radius to zero is an edge that moves.

   And the whole function is gated on s.paleRGB being non-null. After the
   extinction there is no colour to pass, so there is nothing to draw - the
   absence is structural rather than policed.                                */
function drawPale(s, F) {
  if (s.paleRGB === null || s.pale <= 0.01) return;
  var P = D.measured.pale, pts = P.points, dot = DOT[s.paleRGB];
  octx.globalCompositeOperation = "lighter";
  for (var i = 0; i < pts.length; i++) {
    var p = pts[i];
    var shrink = clamp((p[2] - s.paleOut + PALE_K) / PALE_K, 0, 1);
    if (shrink <= 0.02) continue;
    var q = project(F, p[0], p[1]);
    if (!q || q[0] < -140 || q[0] > W + 140 || q[1] < -140 || q[1] > H + 140) continue;
    var sc = degPx(F, p[0], p[1]);
    if (!sc) continue;
    /* Radius roughly half the sampling step, so the patches read as separate
        lights rather than merging into one warm field. At 0.74 they overlapped
        into a sepia haze that tinted a third of the frame and made the EARTH
        look warm, which is Law 02 backwards. Discrete also makes the
        withdrawal legible: patches wink out, a wash just thins. */
     blot(dot, q[0], q[1], sc * P.stepDeg * 0.50 * (0.66 + 0.5 * p[3]) * shrink,
          s.pale * (0.20 + 0.24 * p[3]));
  }
  octx.globalCompositeOperation = "source-over";
  octx.globalAlpha = 1;
}

/* -- THE ANNOTATION SINK  (and why the atlas needed one) ------------------
   The atlas bakes the WORLD from this shader, at the same values of t the film
   uses - earth, lights, leaders, marker dots - and then places every WORD on
   top of it as live HTML. That split is the whole design, and it is forced:
   the atlas is the crawler content, the screen-reader fallback and the answer
   for a browser with WebGL switched off, so a baked sentence would be pixels
   in exactly the artifact whose job is to be text. It would also be invisible
   to the Law 07 copy check, which reads the film's own surfaces - and a check
   that cannot see a line is a line that is not checked.

   So no canvas text site writes text directly any more. Each hands its string
   to gtext(), which either draws it - the film - or records where it would
   have gone, in CSS pixels, with the class the type system gives it. The
   geometry of the LEADER is baked either way, so the real text lands on the
   end of a real leader rather than beside a redrawn guess at one.

   BAKE is a render option and not world state: stateFor never reads it, it is
   not in the hash, and the purity test is untouched by it.                  */
var BAKE = null;
function r1(v) { return Math.round(v * 10) / 10; }
function gtext(str, x, y, o) {
  if (BAKE) {
    BAKE.text.push({ s: str, x: r1(x), y: r1(y), align: octx.textAlign,
                     cls: o.cls, a: +(o.a).toFixed(3) });
    return;
  }
  octx.fillText(track(str), x, y);
}

/* -- instrumentation -----------------------------------------------------
   The marker goes on the globe; the words go in the right margin, in a stack
   that cannot collide with itself, joined by a leader. Placement law 1 said
   type lives beside the globe and not on it, and a label with a leader is the
   only way to name a place without writing across it.                      */
var LABELS = [
  /* ---- beat 05. Both doors, and only the facts that DO NOT MOVE, because a
     locked frame gives the reader ten thousand years to read them and a value
     ticking in a still shot is the loudest thing on screen. Every line here is
     true at every sea level in the record, so none of them ever changes. The
     numbers that do move live in the record voice, which arrives and leaves. */
  { t: [0.2360, 0.2960], lon: 33.5, lat: 29.6, ring: 0,
    k: "SINAI", v: "DRY LAND AT EVERY SEA LEVEL IN THE RECORD" },
  { t: [0.2360, 0.2960], lon: 43.3, lat: 12.6, ring: 0,
    k: "BAB-EL-MANDEB", v: "WATER AT EVERY SEA LEVEL IN THE RECORD" },
  { t: [0.2520, 0.2900], lon: 52.0, lat: 27.2, ring: 0,
    k: "THE PERSIAN GULF", v: "98% OF THIS BASIN DRY  ·  61% TODAY" },
  /* ---- beat 06 */
  { t: [0.3020, 0.3420], lon: 107.0, lat: 2.0, ring: 0,
    k: "SUNDA", v: "BORNEO, SUMATRA AND JAVA, JOINED TO THE MAINLAND" },
  { t: [0.3040, 0.3420], lon: 110.5, lat: -3.5, ring: 0,
    k: "THE PALE GROUND", v: "LAND THAT IS UNDER WATER TODAY" },
  { t: [0.3300, 0.3600], lon: 124.0, lat: -1.5, ring: 0,
    k: "WALLACEA", v: "NEVER BRIDGED, AT ANY SEA LEVEL IN THE RECORD" },
  { t: [0.3300, 0.3580], lon: 137.0, lat: -15.0, ring: 0,
    k: "SAHUL", v: "AUSTRALIA, NEW GUINEA AND TASMANIA: ONE CONTINENT" },
  { t: [0.3480, 0.3600], lon: 122.60, lat: -4.95, ring: 1,
    k: "LIANG METANDUNO", v: "AT LEAST 67,800 BP  ·  OLDEST ROCK ART ON EARTH" },
  { t: [0.3460, 0.3580], lon: 132.87, lat: -12.40, ring: 2,
    k: "MADJEDBEBE", v: "65,000 – 59,000 BP  ·  OSL  ·  CONTESTED" },
  /* ---- beat 07 */
  { t: [0.4120, 0.4350], lon: 9.0, lat: 47.5, ring: 0,
    k: "THE OTHERS", v: "EXTENT INDICATIVE  ·  NOT A SOURCED RANGE MAP" },
  /* LAW 06, WIDENED. The eruption is marked and dated and it touches nothing:
     no ash, no greyed sky, no dimmed light. It is here because it is how we
     know WHEN here is, and law06() proves the world does not notice it. */
  { t: [0.4225, 0.4520], lon: 14.14, lat: 40.83, ring: 1,
    k: "CAMPI FLEGREI", v: "39,850 ± 140 BP  ·  A CLOCK, NOT A CAUSE" }
];

/* The ground register's own instrumentation, hoisted out of drawCut so that
   copyCheck can read it. These five lines have been on screen since Phase 4
   and were NOT in the copy check, because the check reads tables and these were
   string literals inside a draw call. Two of them make claims the film is
   answerable for - that the stencil is a diagram and not a photograph, and that
   a plate is reserved rather than missing - so they belong where the check can
   see them. */
var GROUND = {
  head: "GROUND REGISTER  ·  PRESENT TENSE",
  sub: ["FINGERTIPS WORKED TO POINTS, LIKE CLAWS",
        "ORIGINAL DIAGRAM, NOT A PHOTOGRAPH OF THE SITE"],
  plate: ["LEANG KARAMPUANG  ·  ≥51,200 BP",
          "OLDEST NARRATIVE SCENE",
          "PLATE RESERVED  ·  PERMISSION PENDING"]
};

function labelAlpha(t, w) {
  return Math.min(span(t, w[0], w[0] + 0.006), 1 - span(t, w[1] - 0.006, w[1]));
}

function drawLabels(s, F) {
  var live = [];
  LABELS.forEach(function (L) {
    var a = labelAlpha(s.t, L.t); if (a <= 0.01) return;
    var p = project(F, L.lon, L.lat); if (!p) return;
    if (p[0] < -80 || p[0] > W + 80 || p[1] < -80 || p[1] > H + 80) return;
    live.push({ L: L, a: a, p: p });
  });
  live.sort(function (u, v) { return u.p[1] - v.p[1]; });

  var RX = W - 56, y0 = 128, gap = 46;
  octx.textBaseline = "middle";
  live.forEach(function (e, i) {
    var y = y0 + i * gap, a = e.a, p = e.p;

    /* the marker on the globe */
    octx.save();
    if (e.L.ring === 2) octx.setLineDash([3, 3]);
    octx.strokeStyle = "rgba(" + (e.L.ring ? ICE : ICED) + "," + (a * 0.85).toFixed(3) + ")";
    octx.lineWidth = 1;
    if (e.L.ring) {
      octx.beginPath(); octx.arc(p[0], p[1], 7, 0, 6.2832); octx.stroke();
    } else {
      octx.beginPath(); octx.arc(p[0], p[1], 2.2, 0, 6.2832);
      octx.fillStyle = "rgba(" + ICED + "," + (a * 0.9).toFixed(3) + ")"; octx.fill();
    }
    octx.restore();

    /* the leader: out from the marker, then a level run into the margin */
    var elbow = RX - 232;
    octx.strokeStyle = "rgba(" + ICED + "," + (a * 0.42).toFixed(3) + ")";
    octx.lineWidth = 1;
    octx.beginPath();
    octx.moveTo(p[0] + (e.L.ring ? 9 : 4), p[1]);
    octx.lineTo(elbow, y);
    octx.lineTo(RX - 4, y);
    octx.stroke();

    octx.textAlign = "right";
    octx.font = '500 10.5px "IBM Plex Mono",monospace';
    octx.fillStyle = "rgba(" + ICE + "," + a.toFixed(3) + ")";
    gtext(e.L.k, RX, y - 9, { cls: "lab-k", a: a });
    octx.font = '400 10px "IBM Plex Mono",monospace';
    octx.fillStyle = "rgba(" + ICED + "," + (a * 0.88).toFixed(3) + ")";
    gtext(e.L.v, RX, y + 6, { cls: "lab-v", a: a * 0.88 });

    /* The label's whole geometry, so the atlas can put real type on the end of
       the leader this frame has already drawn: where the marker is, where the
       leader turns, and where the words are anchored. */
    if (BAKE) BAKE.labels.push({
      k: e.L.k, v: e.L.v, a: +a.toFixed(3), ring: e.L.ring,
      lon: e.L.lon, lat: e.L.lat,
      mx: r1(p[0]), my: r1(p[1]), ex: r1(elbow), tx: r1(RX), ty: r1(y)
    });
  });
}

/* Plex Mono has no letter-spacing in canvas, so the tracking the type system
   asks for is done by hand. */
function track(str) { return str.split("").join(" "); }

/* -- the measured gap ----------------------------------------------------- */
function drawGap(s, F) {
  var a = labelAlpha(s.t, [0.3320, 0.3580]); if (a <= 0.01) return;
  var row = gapRow(s.sea);
  var A = project(F, row.gapFrom[0], row.gapFrom[1]);
  var B = project(F, row.gapTo[0], row.gapTo[1]);
  if (!A || !B) return;
  octx.save();
  octx.setLineDash([2, 4]);
  octx.strokeStyle = "rgba(" + BONE + "," + (a * 0.75).toFixed(3) + ")";
  octx.lineWidth = 1.1;
  octx.beginPath(); octx.moveTo(A[0], A[1]); octx.lineTo(B[0], B[1]); octx.stroke();
  octx.restore();
  [A, B].forEach(function (P) {
    octx.strokeStyle = "rgba(" + BONE + "," + (a * 0.9).toFixed(3) + ")";
    octx.lineWidth = 1.1;
    octx.beginPath(); octx.moveTo(P[0] - 4, P[1]); octx.lineTo(P[0] + 4, P[1]); octx.stroke();
  });
  /* A dimension line, annotated the way a dimension line is: the number sits
     off the segment, on whichever side has more frame. */
  var mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
  var ux = B[0] - A[0], uy = B[1] - A[1], ul = Math.hypot(ux, uy) || 1;
  var px = -uy / ul, py = ux / ul;
  if (mx + px * 40 < W * 0.45) { px = -px; py = -py; }
  var lx = mx + px * 26, ly = my + py * 26;
  octx.strokeStyle = "rgba(" + BONE + "," + (a * 0.45).toFixed(3) + ")";
  octx.lineWidth = 1;
  octx.beginPath(); octx.moveTo(mx, my); octx.lineTo(lx, ly); octx.stroke();

  octx.textAlign = px < 0 ? "right" : "left"; octx.textBaseline = "middle";
  var tx = lx + (px < 0 ? -8 : 8);
  octx.font = '500 14px "IBM Plex Mono",monospace';
  octx.fillStyle = "rgba(" + BONE + "," + a.toFixed(3) + ")";
  gtext(row.bottleneckKm.toFixed(1) + " KM", tx, ly - 10, { cls: "dim-k", a: a });
  octx.font = '400 10px "IBM Plex Mono",monospace';
  octx.fillStyle = "rgba(" + ICE + "," + (a * 0.85).toFixed(3) + ")";
  /* Precisely what was computed: the minimum, over every island-hopping route
     from Sunda to Sahul, of the longest single hop. Not "the narrowest
     crossing", which would be a different and much smaller number. */
  gtext("THE WIDEST HOP ANY ROUTE MUST INCLUDE", tx, ly + 8, { cls: "dim-v", a: a * 0.85 });

  /* The dimension itself, for the atlas: both ends on the water, the leader,
     and the figure's anchor. The number is NOT written into the sidecar as a
     string only - the row it came from goes with it, so the atlas cannot end
     up quoting a figure whose sea level it has forgotten. */
  if (BAKE) BAKE.gap = { a: +a.toFixed(3), km: row.bottleneckKm, seaM: row.seaM,
                         minIslandKm2: row.minIslandKm2,
                         ax: r1(A[0]), ay: r1(A[1]), bx: r1(B[0]), by: r1(B[1]),
                         mx: r1(mx), my: r1(my), lx: r1(lx), ly: r1(ly),
                         align: px < 0 ? "right" : "left" };
}

/* the widest hop any island-hopping route must include, at this sea level */
function gapRow(sea) {
  var rows = D.measured.wallacea.rows.filter(function (r) { return r.minIslandPx === 10; });
  var best = rows[0], bd = 1e9;
  rows.forEach(function (r) {
    var d = Math.abs(r.seaM - sea);
    if (d < bd) { bd = d; best = r; }
  });
  return best;
}

/* ═══ 9 · THE MATCH CUT ══════════════════════════════════════════════════
   Law 03's first verb: a shape held across a change of scale.

   Sulawesi has four arms radiating from a body, and their tips and its palm
   are measured off the raster at this beat's own sea level - not eyeballed.
   The camera flattens to nadir and turns until the fan of arms opens upward,
   and then four strokes are drawn on it. Across the cut those strokes close
   from the hundred and thirty-three degrees the island has to the sixty a
   hand has, limestone comes up underneath, and the thumb - which has no
   island to come from - grows last.

   The film does not claim the island is a hand. It holds one shape long
   enough for the eye to accept the other, which is what a match cut is. */

var ARMS = [                                  /* measured at -73.9 m, see below */
  { lon: 125.16, lat:  1.84 },                /* north-east arm  -> index  */
  { lon: 123.52, lat: -0.69 },                /* east arm        -> middle */
  { lon: 122.81, lat: -5.69 },                /* south-east arm  -> ring   */
  { lon: 119.86, lat: -5.88 }                 /* south arm       -> little */
];
/* the largest circle that fits inside the island: 120.16E 2.08S, radius 95 km */
var PALM = { lon: 120.16, lat: -2.08 };

/* The canonical hand, in SCREEN coordinates - y increases downward, so the
   fingers point at negative y. Defining it y-up and letting the least-squares
   fit sort it out does not work: a similarity transform cannot reflect, so it
   compensates with a rotation and the hand arrives lying on its side.
   Unit is one hand length, palm base at the origin. */
var HAND = {
  fingers: [
    { base: [-0.19, -0.44], tip: [-0.31, -1.06], w: 0.082 },
    { base: [-0.04, -0.48], tip: [-0.02, -1.16], w: 0.085 },
    { base: [ 0.11, -0.47], tip: [ 0.23, -1.08], w: 0.080 },
    { base: [ 0.23, -0.42], tip: [ 0.47, -0.90], w: 0.071 }
  ],
  thumb: { base: [-0.17, -0.10], tip: [-0.56, -0.40], w: 0.132 },
  palmCentre: [0.02, -0.26],
  palm: [[-0.19, 0.06], [-0.25, -0.06], [-0.28, -0.26], [-0.27, -0.43],
         [-0.19, -0.51], [-0.06, -0.54], [0.08, -0.53], [0.20, -0.48],
         [0.27, -0.38], [0.28, -0.18], [0.24, -0.02], [0.19, 0.06]]
};

var plate = null, plateFit = null;

/* Fit the canonical hand to where the island actually is on screen, so the
   cut lands instead of jumping. Similarity transform, least squares, five
   correspondences: four arm tips and the palm. */
function fitHand(F) {
  var src = [], dst = [];
  ARMS.forEach(function (a, i) {
    var p = project(F, a.lon, a.lat); if (!p) return;
    dst.push(p); src.push(HAND.fingers[i].tip);
  });
  var pp = project(F, PALM.lon, PALM.lat);
  if (!pp || dst.length < 3) return null;
  dst.push(pp); src.push(HAND.palmCentre);

  var n = src.length, i, sx = 0, sy = 0, dx = 0, dy = 0;
  for (i = 0; i < n; i++) { sx += src[i][0]; sy += src[i][1]; dx += dst[i][0]; dy += dst[i][1]; }
  sx /= n; sy /= n; dx /= n; dy /= n;
  var a = 0, b = 0, d = 0;
  for (i = 0; i < n; i++) {
    var ux = src[i][0] - sx, uy = src[i][1] - sy;
    var vx = dst[i][0] - dx, vy = dst[i][1] - dy;
    a += ux * vx + uy * vy; b += ux * vy - uy * vx; d += ux * ux + uy * uy;
  }
  a /= d; b /= d;
  return { a: a, b: b, cx: dx - (a * sx - b * sy), cy: dy - (b * sx + a * sy),
           k: Math.hypot(a, b) };
}
function applyFit(f, p) {
  return [f.a * p[0] - f.b * p[1] + f.cx, f.b * p[0] + f.a * p[1] + f.cy];
}

/* A finger: parallel sides that close to a POINT. The fingertips at Liang
   Metanduno were deliberately reshaped to points, like claws, and that is the
   single most specific thing known about the oldest hand on any wall. */
function blade(x, a, b, w) {
  var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  var nx = -dy / l * w * 0.5, ny = dx / l * w * 0.5;
  var kx = dx / l, ky = dy / l;
  x.moveTo(a[0] + nx, a[1] + ny);
  x.lineTo(a[0] + nx + kx * l * 0.66, a[1] + ny + ky * l * 0.66);
  x.quadraticCurveTo(a[0] + nx * 0.55 + kx * l * 0.93, a[1] + ny * 0.55 + ky * l * 0.93,
                     b[0], b[1]);
  x.quadraticCurveTo(a[0] - nx * 0.55 + kx * l * 0.93, a[1] - ny * 0.55 + ky * l * 0.93,
                     a[0] - nx + kx * l * 0.66, a[1] - ny + ky * l * 0.66);
  x.lineTo(a[0] - nx, a[1] - ny);
  x.closePath();
}

/* The hand, filled. Each part is its own fill: the palm winds clockwise and a
   blade winds the other way, so a single path with the nonzero rule punches
   the fingers back out of the palm exactly where they overlap it. */
function handFill(x, fit) {
  var pl = HAND.palm.map(function (q) { return applyFit(fit, q); });
  x.beginPath();
  x.moveTo((pl[0][0] + pl[pl.length - 1][0]) / 2, (pl[0][1] + pl[pl.length - 1][1]) / 2);
  for (var i = 0; i < pl.length; i++) {
    var a = pl[i], b = pl[(i + 1) % pl.length];
    x.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  x.closePath(); x.fill();

  HAND.fingers.forEach(function (fg) {
    x.beginPath();
    blade(x, applyFit(fit, fg.base), applyFit(fit, fg.tip), fit.k * fg.w);
    x.fill();
  });
  x.beginPath();
  blade(x, applyFit(fit, HAND.thumb.base), applyFit(fit, HAND.thumb.tip),
        fit.k * HAND.thumb.w);
  x.fill();
}

/* -- procedural limestone and blown pigment ------------------------------
   Value noise, three octaves, evaluated per pixel. Built once per viewport.
   The wall is COLD: Law 02 gives warm light to people only. The ochre is the
   one exception the law makes for itself, because a stencil is not a picture
   of a person - it is the place a person was.                             */

function hash2(x, y) {
  var h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y) {
  var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  var a = hash2(xi, yi), b = hash2(xi + 1, yi);
  var c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
}
function fbm(x, y, oct) {
  var s = 0, amp = 0.5, f = 1;
  for (var i = 0; i < oct; i++) { s += vnoise(x * f, y * f) * amp; amp *= 0.5; f *= 2.07; }
  return s;
}

function buildPlate(fit) {
  var c = document.createElement("canvas");
  c.width = W; c.height = H;
  var x = c.getContext("2d");

  /* 1. the hand, rendered to a mask so the pigment can be kept off it */
  var mk = document.createElement("canvas");
  mk.width = W; mk.height = H;
  var m = mk.getContext("2d");
  m.fillStyle = "#000"; m.fillRect(0, 0, W, H);
  m.fillStyle = "#fff";
  handFill(m, fit);
  m.filter = "blur(2.5px)";                 /* a blown edge, not a cut one */
  m.drawImage(mk, 0, 0);
  m.filter = "none";
  var mask = m.getImageData(0, 0, W, H).data;

  /* 2. the wall and the pigment, one pass.
     Noise frequencies are in PIXELS, not in fractions of the frame. Spray
     grain is a two-pixel thing; expressed as a fraction of the width it comes
     out as a hundred-pixel cloud, which is why the first attempt read as a
     red glow behind a grey blob rather than as pigment on stone. */
  var img = x.createImageData(W, H), px = img.data;
  var hx = fit.cx + (HAND.palmCentre[0] * fit.a - HAND.palmCentre[1] * fit.b);
  var hy = fit.cy + (HAND.palmCentre[0] * fit.b + HAND.palmCentre[1] * fit.a);
  var reach = fit.k * 1.62;

  for (var j = 0, i = 0; j < H; j++) {
    for (var k = 0; k < W; k++, i += 4) {

      /* Limestone. PALE - a stencil is the wall showing through, so if the
         stone is darker than the pigment the image inverts and reads as a
         painted hand, which is the opposite of what happened. */
      var v = 0.42 + fbm(k * 0.0055, j * 0.0055, 3) * 0.46
                   + vnoise(k * 0.42, j * 0.42) * 0.10;
      /* calcite: the mineral that dated it, running down the wall */
      v += Math.pow(Math.max(0, fbm(k * 0.004 + 55, j * 0.0006 + 9, 2) - 0.46), 1.7) * 0.42;

      /* the torch. One pool of light, falling off fast, so the frame keeps
         the darkness the rest of the film is made of. */
      var dx = k - hx, dy = (j - hy) * 1.05, rr = Math.hypot(dx, dy);
      var torch = 1.22 - 1.10 * smooth01(rr / (H * 0.92));
      v *= Math.max(0.040, torch);

      var r = v * 228, g = v * 225, b = v * 212;

      /* pigment: blown from a mouth, so it is dense near the hand, blotchy at
         every scale, granular at the pixel, and stops dead at the hand's edge */
      /* Pigment. The outer boundary of a blown spray is not a soft radial
         falloff - that reads as a glow behind the hand. It is a ragged edge
         at roughly arm's reach, so the boundary itself is warped by noise and
         then closes quickly, and inside it the wall keeps showing through in
         patches. */
      var edge = fbm(k * 0.005 + 20, j * 0.005 + 60, 3);
      var dens = 1 - smooth01((rr / reach - 0.34 - 0.52 * edge) / 0.30);
      dens *= 0.55 + 0.75 * fbm(k * 0.021 + 400, j * 0.021 + 300, 3);
      dens *= 0.60 + 0.62 * fbm(k * 0.19 + 700, j * 0.19 + 200, 2);
      dens *= 0.70 + 0.45 * vnoise(k * 0.85 + 31, j * 0.85 + 77);
      dens *= 1 - mask[i] / 255;
      /* Capped short of opaque. Ochre blown on limestone never covers - the
         wall shows through everywhere, and that is most of what makes it read
         as pigment rather than as a red shape. */
      dens = Math.min(0.85, dens * 1.05);

      /* The pigment is the one warm thing the earth is allowed, because a
         stencil is not a picture of a person - it is the place a person was. */
      var tt = Math.min(1, torch);
      px[i]     = r + (92 * tt - r) * dens;
      px[i + 1] = g + (44 * tt - g) * dens;
      px[i + 2] = b + (36 * tt - b) * dens;
      px[i + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}
function smooth01(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

/* Where the stencil settles once the cut has landed: right of centre, so the
   copy column keeps the left, and about two fifths of the frame high. The
   plate is BUILT here and transformed back onto the island during the cut, so
   the wall's own grain never stretches with the move. */
function settleFit() {
  var k = H * 0.355, rot = -5.5 * RAD;
  return { a: k * Math.cos(rot), b: k * Math.sin(rot),
           cx: W * 0.615, cy: H * 0.645, k: k };
}
/* R = target o source^-1, both similarities, done in the complex plane */
function residual(target, src) {
  var d = src.a * src.a + src.b * src.b;
  var ca = (target.a * src.a + target.b * src.b) / d;
  var cb = (target.b * src.a - target.a * src.b) / d;
  return { a: ca, b: cb,
           cx: target.cx - (ca * src.cx - cb * src.cy),
           cy: target.cy - (cb * src.cx + ca * src.cy) };
}
function mixFit(u, v, f) {
  return { a: lerp(u.a, v.a, f), b: lerp(u.b, v.b, f),
           cx: lerp(u.cx, v.cx, f), cy: lerp(u.cy, v.cy, f),
           k: Math.hypot(lerp(u.a, v.a, f), lerp(u.b, v.b, f)) };
}

function drawCut(s, F) {
  var m = s.cut;
  if (m <= 0 || !plateFit) return;

  /* How far the island has resolved into a hand. The effective placement runs
     from where Sulawesi is on screen to where the stencil settles, and the
     armature, the plate and the copy all read the same number. */
  var res = ss(clamp((m - 0.10) / 0.66, 0, 1));
  var fit = mixFit(plateFit.island, plateFit.settle, res);

  var tips = ARMS.map(function (a, i) {
    var p = project(F, a.lon, a.lat);
    var q = applyFit(fit, HAND.fingers[i].tip);
    return p ? [lerp(p[0], q[0], res), lerp(p[1], q[1], res)] : q;
  });
  var pp = project(F, PALM.lon, PALM.lat);
  var pc = applyFit(fit, HAND.palmCentre);
  var px = pp ? lerp(pp[0], pc[0], res) : pc[0];
  var py = pp ? lerp(pp[1], pc[1], res) : pc[1];

  /* the wall comes up under the shape, never over it */
  var wall = ss(clamp((m - 0.06) / 0.58, 0, 1));
  if (plate) {
    var R = residual(fit, plateFit.settle);
    octx.save();
    octx.globalAlpha = wall;
    octx.transform(R.a, R.b, -R.b, R.a, R.cx, R.cy);
    octx.drawImage(plate, 0, 0, W, H);
    octx.restore();
    octx.globalAlpha = 1;
  }

  /* The armature: while it is still resolving it is drawn as light on the
     wall. It hands over to the plate's own stencil exactly when it arrives,
     so the crossfade has nothing to reveal.

     Only on the way IN. The way out of the ground register is a pull-back, not
     a match cut run backwards - beat 07 opens by pulling back from the stencil
     and swinging west, and re-drawing the armature over the globe on the way
     out put four white sticks on the Philippines. */
  var lit = s.t > CUT_IN[1] ? 0 : 1 - ss(clamp((m - 0.62) / 0.30, 0, 1));
  if (lit > 0.01) {
    octx.lineCap = "round";
    octx.strokeStyle = "rgba(" + BONE + "," + (lit * 0.92).toFixed(3) + ")";
    tips.forEach(function (tp, i) {
      octx.lineWidth = 1.4 + res * fit.k * HAND.fingers[i].w * 0.82;
      octx.beginPath(); octx.moveTo(px, py); octx.lineTo(tp[0], tp[1]); octx.stroke();
    });
    octx.fillStyle = "rgba(" + BONE + "," + (lit * 0.85).toFixed(3) + ")";
    octx.beginPath();
    octx.arc(px, py, 3 + res * fit.k * 0.20, 0, 6.2832); octx.fill();
  }

  /* ground-register instrumentation, once the wall has settled */
  var ga = ss(clamp((m - 0.74) / 0.26, 0, 1));
  if (ga > 0.01) {
    octx.font = '400 10.5px "IBM Plex Mono",monospace';
    octx.textAlign = "right"; octx.textBaseline = "middle";
    var bx = W - 56, by = 128;
    octx.fillStyle = "rgba(" + ICE + "," + ga.toFixed(3) + ")";
    gtext(GROUND.head, bx, by, { cls: "lab-k", a: ga });
    octx.fillStyle = "rgba(" + ICED + "," + (ga * 0.9).toFixed(3) + ")";
    GROUND.sub.forEach(function (L, i) {
      gtext(L, bx, by + 17 + i * 16, { cls: "lab-v", a: ga * 0.9 });
    });

    /* The plate the film still owes. Image rights for the ground register are
       a lead time, not a launch time, and the Sulawesi material sits with
       custodians whose permission is a courtesy and often a requirement. Until
       it is cleared the layout carries the hole rather than hiding it. */
    octx.save(); octx.setLineDash([2, 4]);
    octx.strokeStyle = "rgba(" + ICED + "," + (ga * 0.42).toFixed(3) + ")";
    octx.lineWidth = 1;
    octx.strokeRect(bx - 300, by + 58, 300, 98);
    octx.restore();
    octx.fillStyle = "rgba(" + ICED + "," + (ga * 0.8).toFixed(3) + ")";
    var PY = [88, 106, 126];
    GROUND.plate.forEach(function (L, i) {
      gtext(L, bx - 18, by + PY[i], { cls: "lab-v", a: ga * 0.8 });
    });

    /* The reserved plate is a DRAWN rectangle, so it bakes with the world; the
       atlas needs its box only to know that the hole is there and where. */
    if (BAKE) BAKE.reserved = { a: +ga.toFixed(3), x: r1(bx - 300), y: r1(by + 58),
                                w: 300, h: 98 };
  }
}

/* ═══ 10 · COPY  (Laws 04 and 07) ════════════════════════════════════════ */

/* The film voice is paced narration, not a slogan. Each beat may use a few
   short passages, separated by room for the image to speak. Their joined text
   is the beat's own onScreen field in timeline.json; copyCheck asserts that
   rather than trusting it. */
var VOICES = [
  /* Beat 05. The final sentence lands in the held frame, then leaves silence. */
  { beat: 5, t: [0.2370, 0.2475], lines: ["Later, another dispersal began."] },
  { beat: 5, t: [0.2490, 0.2615], lines: ["It was not the first, and it was not guaranteed to succeed."] },
  { beat: 5, t: [0.2630, 0.2735], lines: ["Along the way, these travellers met other human peoples and had children together."] },
  { beat: 5, t: [0.2750, 0.2860], lines: ["But it endured."] },
  { beat: 6, t: [0.3030, 0.3160], lines: ["Falling seas joined many islands to the continents around them."] },
  { beat: 6, t: [0.3175, 0.3315], lines: ["But the water east of Asia never became a bridge."] },
  { beat: 6, t: [0.3330, 0.3425], lines: ["The people who reached Sahul crossed open sea."] },
  /* Beat 07. The unanswered disappearance arrives after the pale light goes. */
  { beat: 7, t: [0.4100, 0.4250], lines: ["Other human peoples still lived across Eurasia."] },
  { beat: 7, t: [0.4415, 0.4500], lines: ["By the end of this beat, Neanderthals are gone."] },
  { beat: 7, t: [0.4510, 0.4625], lines: ["We do not know exactly why."] }
];
/* The record. Law 07 lives in this voice: whatever the film says out loud, the
   qualifiers its own evidence carries are stated in full, in the same frame.
   The first of these is the beat's actual argument. The film does not
   adjudicate Sahul - and a beat that refuses to adjudicate has to SAY so, or
   it is only a beat that avoided the question. */
var RECORDS = [
  /* ---- beat 05 ---- */
  { t: [0.2370, 0.2640],
    html: "Two doors, and the genomes do not say which. Sinai is dry land at every " +
          "sea level in the record. Bab&#8209;el&#8209;Mandeb is water at every sea " +
          "level &mdash; and sixty thousand years ago, under ten kilometres of it, " +
          "as little as five, depending how small an island you will step on." +
          '<span class="src">DISPERSAL ROUTE &middot; 60,000&ndash;50,000 BP &middot; UNRESOLVED<br>' +
          'ETOPO 2022 BEDROCK &middot; 60&Prime; &middot; BOTTLENECK, PER CORRIDOR<br>' +
          'ISLANDS COUNTED DOWN TO 3.4 KM&sup2;, 34 KM&sup2; AND 344 KM&sup2;</span>' },
  { t: [0.2780, 0.2985],
    html: "A single stretch of gene flow, about seven thousand years long, shared by " +
          "every non&#8209;African alive. Leaving Africa and meeting the others were " +
          "not two events." +
          '<span class="src">NEANDERTHAL GENE FLOW &middot; 50,500&ndash;43,500 BP &middot; SOLID<br>' +
          'S&Uuml;MER 2024 &middot; IASI 2024<br>' +
          '1.5&ndash;2% IN PRESENT&#8209;DAY NON&#8209;AFRICANS</span>' },
  /* ---- beat 06 ---- */
  { t: [0.3430, 0.3610],
    html: "The rock under Madjedbebe reads sixty&#8209;five thousand years. The " +
          "genomes read fifty to forty&#8209;three. Both are careful, both are " +
          "published, and nobody has resolved it &mdash; so neither does the film." +
          '<span class="src">MADJEDBEBE &middot; 65,000&ndash;59,000 BP &middot; OSL<br>' +
          'ARRIVAL &middot; 50,000&ndash;43,000 BP &middot; GENETIC<br>' +
          'DRAWN ON THE TIME RAIL, NOT ON THE MAP</span>' },
  { t: [0.3720, 0.3900],
    html: "We cannot identify the hand directly. The authors believe it was ours. " +
          "If they are right, the northern sea route was being travelled far earlier " +
          "than the map once allowed." +
          '<span class="src">LIANG METANDUNO &middot; MUNA ISLAND<br>' +
          'AT LEAST 67,800 BP &middot; U&#8209;SERIES ON CALCITE</span>' },
  /* ---- beat 07 ----
     Denny is the ground register in TYPE. The beat does not build a second
     procedural ground plate, and that is a decision rather than a shortfall:
     beat 06's match cut ends at t 0.3930 and a second one would land at 0.4180,
     about four seconds later. Two match cuts that close together stop being the
     film's rarest move and start being a tic - which is the storyboard's own
     argument for why beat 07 gets no second hold. Law 04 is still honoured: she
     is present tense, and the frame says she predates the beat. */
  { t: [0.4100, 0.4175],
    html: "One splinter of long bone from a cave in the Altai. Her mother was " +
          "Neanderthal. Her father was Denisovan &mdash; a first&#8209;generation " +
          "child of two different kinds of human, surviving as one bone." +
          '<span class="src">DENISOVA 11 &middot; ~90,000 BP &middot; SOLID &middot; SLON 2018<br>' +
          'GROUND REGISTER &middot; PRESENT TENSE<br>' +
          'SHE PREDATES THIS BEAT BY FIFTY THOUSAND YEARS</span>' },
  /* The Law 06 decision, said out loud in the frame it applies to. */
  { t: [0.4185, 0.4300],
    html: "Thirty&#8209;nine thousand eight hundred and fifty years ago, give or take " +
          "a hundred and forty, Campi Flegrei erupted. Recent work finds no lasting " +
          "consequence for anyone living here. It is on screen because it is how we " +
          "know when here is." +
          '<span class="src">CAMPANIAN IGNIMBRITE &middot; 39,850 &plusmn; 140 BP &middot; ' +
          '<sup>40</sup>AR/<sup>39</sup>AR<br>' +
          'GIACCIO 2017 &middot; BEST&#8209;DATED TEPHRA IN EUROPEAN PREHISTORY<br>' +
          'DRAWN ON THE TIME RAIL, NOT ON THE MAP</span>' },
  { t: [0.4415, 0.4550],
    html: "The last securely dated occupation is forty&#8209;one to thirty&#8209;nine " +
          "thousand years ago, and it was staggered, not simultaneous. Why they ended " +
          "is still argued &mdash; competition, climate, absorption. The film draws the " +
          "going out. It does not draw a reason." +
          '<span class="src">NEANDERTHALS DISAPPEAR &middot; 41,000&ndash;39,000 BP &middot; SUPPORTED<br>' +
          'HIGHAM 2014 &middot; LAST SECURELY DATED OCCUPATION<br>' +
          'CAUSE CONTESTED &middot; NOT DEPICTED<br>' +
          '1.5&ndash;2% ANCESTRY IN PRESENT&#8209;DAY NON&#8209;AFRICANS</span>' }
];

/* ═══ 10a · THE ATLAS  (beat 06) ═════════════════════════════════════════

   The atlas is one static artifact that is simultaneously the mobile
   experience, the reduced-motion fallback, the no-JS fallback, the crawler
   content and the answer for a browser with WebGL switched off. Same art, same
   writing, no scroll-cinema.

   ITS COPY LIVES HERE, beside the film's, and that is the whole reason it can
   be trusted. The alternative was to write the essay in the generator, which
   would have made slice/build_atlas.py a second source of truth for sentences
   about the past - and this project's failure mode is a sentence claiming more
   than the data behind it. Here, every line below goes through copyCheck()
   with the film's own, against the qualifiers its own event carries in
   timeline.json, and the generator only transports what the check has already
   passed.

   The shots are the beat as a journey: the opening pose, the shelf, the light
   moving east, the gap, the disagreement, landfall, the match cut, the wall.
   Eight frames, in order, each drawn by the same shader at the same t the film
   uses - see bakeAt() in section 13.                                        */
var ATLAS = {
  kicker: "THE STATIC ATLAS",
  lede: [
    "People reached Sahul somewhere between fifty and forty&#8209;three thousand years " +
    "ago; the rocks argue for older. Falling seas joined many islands to the " +
    "continents around them. But the water east of Asia never became a bridge. " +
    "The people who reached Sahul crossed open sea. This is beat 06 " +
    "of <i>One Ember</i>.",

    "This page is the film&rsquo;s other half. The film is desktop, scroll and WebGL; " +
    "this is the same beat as eight still frames, baked from the same shader at the " +
    "same eight values of the film&rsquo;s single time variable, so the two artifacts " +
    "cannot disagree about what the world looked like. Every word on this page is " +
    "text, not pixels.",

    "It is also the mobile experience, the reduced&#8209;motion fallback, the " +
    "no&#8209;JavaScript fallback, the crawler content, and the answer for a browser " +
    "that has switched WebGL off."
  ],
  /* One caption per still. The still carries the film's own copy - the film
     voice, the record voice, the margin labels - lifted straight out of the
     tables above by t; the caption is the atlas's own sentence, and it is the
     only writing on this page the film does not already say. */
  shots: [
    { t: 0.3000, id: "01", ev: [], cap:
      "The camera comes in over Sundaland as beat 05 lets go. The sea stands " +
      "sixty&#8209;eight metres below today&rsquo;s, and Borneo, Sumatra and Java are " +
      "not islands in this frame: they share one piece of land with the Asian " +
      "mainland." },

    { t: 0.3080, id: "02", ev: [], cap:
      "The pale ground is the shelf &mdash; land standing dry here that is under water " +
      "today. Measured over the box the connectivity test uses, ninety to a hundred and " +
      "sixty degrees east and fifty south to thirty north: 30.88 per cent of it stands " +
      "dry at the end of this beat against 23.75 per cent today, a gain of thirty per " +
      "cent on the present. Across the beat itself the change is small &mdash; 30.44 to " +
      "30.88 per cent &mdash; because the shelf was already out when the beat opened. " +
      "Beat 05 exposed it." },

    { t: 0.3220, id: "03", ev: [], cap:
      "The light travels east across a shelf that is standing dry. The head is a " +
      "population and not a person; warm light in this film is only ever people, the " +
      "earth they cross is slate, ice and bone, and no word on either artifact is drawn " +
      "in a people&#8209;colour." },

    { t: 0.3350, id: "04", ev: ["wallacea-crossing"], cap:
      "Seventy point five kilometres. Not the narrowest crossing in Wallacea &mdash; " +
      "the widest single hop that any island&#8209;hopping route from Sunda to Sahul " +
      "must include, minimised over every route there is. The sea has another " +
      "fifty&#8209;seven metres to fall between here and the last glacial maximum, and " +
      "that floor only moves to seventy point four." },

    { t: 0.3450, id: "05", ev: ["madjedbebe", "sahul-arrival"], cap:
      "The rocks and the genomes disagree about when this happened, and the film does " +
      "not adjudicate. Madjedbebe reads sixty&#8209;five to fifty&#8209;nine thousand " +
      "years from the sediment; the genomes read fifty to forty&#8209;three. The " +
      "disagreement is drawn on the time rail and never on the map, because it is a " +
      "claim about years and not about where anybody was." },

    { t: 0.3520, id: "06", ev: ["sahul-arrival", "madjedbebe"], cap:
      "Landfall on Sahul &mdash; Australia, New Guinea and Tasmania are one continent at " +
      "this sea level. The dashed ring is Madjedbebe, drawn where the site is. Its date " +
      "is not drawn here at all: the ring marks a place, and the years it disagrees " +
      "about are on the rail at the top of this page." },

    { t: 0.3610, id: "07", ev: [], cap:
      "The islands hold their arrangement and become a hand. Orbital is then, and rides " +
      "the time axis; the ground is now, the object as we hold it &mdash; which is why a " +
      "cut to the ground can never run the film&rsquo;s single time variable backwards." },

    { t: 0.3800, id: "08", ev: ["liang-metanduno", "leang-karampuang"], cap:
      "The hand is Liang Metanduno&rsquo;s: at least sixty&#8209;seven thousand eight " +
      "hundred years old, the oldest securely dated rock art anywhere, with the " +
      "fingertips deliberately worked to points. The authors cannot identify the maker " +
      "directly and attribute it to our own species. What is drawn here is an original " +
      "diagram, labelled as one on screen, and not a photograph of the site &mdash; and " +
      "the plate this beat still owes, Leang Karampuang, the oldest known narrative " +
      "scene at least fifty&#8209;one thousand two hundred years, is the dashed " +
      "rectangle marked permission pending. That material sits with custodians whose " +
      "permission is a courtesy and often a legal requirement, so the layout carries the " +
      "hole rather than hiding it." }
  ],
  /* The honest footer. A sequence of stills IS beat 06, and the reason it is
     has nothing to do with this page being well made - it is a property of the
     beat. Saying so here is what stops the atlas being quietly extended to the
     two beats it would misrepresent. */
  close: [
    "A sequence of stills is beat 06 because beat 06 is a journey: something is in a " +
    "different place in each frame, and the frames in order are the beat.",

    "That is not true of the beats either side of it. Beat 05 is ten thousand years in " +
    "which nothing happens, and it says so by spending scroll &mdash; the camera is " +
    "bit&#8209;identical across a quarter of the film&rsquo;s running artifact. Beat 07 " +
    "ends by taking a colour out of the palette for the remaining seven beats. Neither " +
    "is a journey, neither survives being cut into frames, and neither has an atlas yet.",

    "Every dated claim on this page, with its range, its confidence and its citation, is " +
    "in <code>timeline.json</code>. Nothing is on screen that is not in it."
  ]
};

var shownRecord = -1;

/* how much the frame owes to type right now - drives the corner grade, and
   nothing else reads it, so it cannot leak into the world state */
function copyEnvelope(t) {
  var m = 0;
  VOICES.forEach(function (v) { m = Math.max(m, labelAlpha(t, v.t)); });
  RECORDS.forEach(function (r) { m = Math.max(m, labelAlpha(t, r.t) * 0.85); });
  return m;
}

function activeVoice(t) {
  for (var i = 0; i < VOICES.length; i++)
    if (t >= VOICES[i].t[0] && t < VOICES[i].t[1]) return i;
  return -1;
}
function activeRecord(t) {
  for (var i = 0; i < RECORDS.length; i++)
    if (t >= RECORDS[i].t[0] && t < RECORDS[i].t[1]) return i;
  return -1;
}
var shownVoice = -1;

function drawCopy(s) {
  /* The voice is swapped only when it CHANGES. Rewriting innerHTML every frame
     restarts the CSS transition every frame, and the line never fades in. */
  var av = activeVoice(s.t);
  if (av !== shownVoice) {
    shownVoice = av;
    if (av >= 0) {
      $("voice").innerHTML = VOICES[av].lines.map(function (l) {
        return '<span class="l">' + l + "</span>";
      }).join("");
      /* Flush style on the fresh spans BEFORE .on goes back, or the browser
         coalesces both into one change and the line snaps in instead of
         rising. Three times in the film, so the forced reflow costs nothing. */
      void $("voice").offsetWidth;
    }
  }
  $("voice").classList.toggle("on", av >= 0);
  var ar = activeRecord(s.t);
  if (ar !== shownRecord) {
    shownRecord = ar;
    if (ar >= 0) $("record").innerHTML = RECORDS[ar].html;
  }
  $("record").classList.toggle("on", ar >= 0);
  /* Law 01 held for the state and not for what a reader was handed - see
     expose() below, which is the fix and the reason. */
  expose($("voice"), av >= 0);
  expose($("record"), ar >= 0);
  $("state").innerHTML = stateLine(s).join("&nbsp;&nbsp;&middot;&nbsp;&nbsp;");
}

/* WHAT A SCREEN READER RECEIVES IS ALSO A FUNCTION OF t, AND IT WAS NOT.

   A copy block is written only when it CHANGES, because rewriting innerHTML
   every frame restarts the fade every frame - so a line that has left the
   screen is still in the DOM, holding the last string it was given. Leaving is
   a class toggle, and that class is opacity: the paragraph goes to zero alpha
   and stays perfectly readable to anything that reads the accessibility tree.

   An outside audit found what that costs. At t 0.31, arriving from 0.28 leaves
   ONE invisible paragraph exposed and arriving from 0.345 leaves a DIFFERENT
   one - two readers at the identical t, with an identical state hash, handed
   different text. Law 01 was true of the world and false of the page.

   inert removes the subtree from the accessibility tree, from focus and from
   hit-testing; aria-hidden carries the same claim to anything that predates
   inert. Both are set from av/ar, which are functions of t and nothing else -
   so the fix is not a timer that forgets, it is the same law applied one layer
   out. The element keeps its text, because the fade needs it; the reader is
   simply no longer told about a sentence that is not on screen.             */
function expose(el, on) {
  if (el.inert === !on && (el.getAttribute("aria-hidden") === "true") === !on) return;
  el.inert = !on;
  if (on) el.removeAttribute("aria-hidden");
  else el.setAttribute("aria-hidden", "true");
}

/* The instrumentation line, as data rather than as innerHTML. Pulled out of
   drawCopy so the atlas gets the same strings from the same function instead of
   rebuilding them - a readout assembled twice is a readout that will disagree
   with itself eventually, and this one carries measured figures. */
function stateLine(s) {
  var out = [];
  out.push('<span class="k">SEA LEVEL</span> ' + s.sea.toFixed(1) + " M");
  if (s.t >= 0.3000 && s.t < 0.3580) {
    /* The figure is for the measured box, not for whatever the lens happens to
       be holding, so it says which box. Law 07 applies to the instrumentation
       as much as to the sentences. */
    var now = D.measured.tileChecks.filter(function (r) { return r.seaM === 0; })[0];
    var row = nearestBySea(D.measured.tileChecks, s.sea);
    out.push('<span class="k">DRY LAND</span> +' +
      Math.round((row.landFracBox / now.landFracBox - 1) * 100) +
      "% ON TODAY, " + boxLabel(D.measured.landBox));
  }
  /* Beat 05. The southern door, at the film's standard island threshold, so it
     is directly comparable with beat 06's Wallacea figure two beats later - the
     same definition, the same 34 km2 floor, the same sentence available: six
     kilometres here and seventy there. The threshold's own effect on the number
     is in the record voice, which is where a qualifier belongs. */
  if (s.t >= 0.2360 && s.t < 0.2985) {
    var bab = D.measured.doors.rows.filter(function (r) {
      return r.doorId === "bab-el-mandeb" && r.minIslandPx === 10;
    });
    out.push('<span class="k">SOUTHERN DOOR</span> ' +
      nearestBySea(bab, s.sea).bottleneckKm.toFixed(1) +
      " KM &middot; WIDEST HOP ANY ROUTE MUST INCLUDE");
  }
  return out;
}

/* A MEASURED FIGURE NAMES THE BOX IT WAS MEASURED OVER, and the name is built
   from the box rather than typed next to it.

   This exists because the film spent a phase reading "+30% ON TODAY, 92-156E"
   for a figure measured over 90-160E, 50S-30N. 92-156E is the RENDER TILE - the
   frame - and the land fraction is measured over the wider CONNECTIVITY box,
   because Tasmania and mainland Asia have to be inside the component test. Two
   boxes, one of them typed beside the other one's number.

   Nothing caught it. The copy check asserted 23.75, 30.88 and the ratio between
   them - the film agreeing with the film - and never asked what the box was.
   The doors measurement had shipped its own box in the data since Phase 5; this
   one had not, so there was nothing to check against. Now there is, and the
   label is generated, so the label cannot drift from the measurement without
   the measurement moving too. */
function boxLabel(b) {
  function d(v, neg, pos) { return Math.abs(v) + "&deg;" + (v < 0 ? neg : pos); }
  var lo = (b.lon0 < 0) === (b.lon1 < 0)
    ? Math.abs(b.lon0) + "&ndash;" + d(b.lon1, "W", "E")
    : d(b.lon0, "W", "E") + "&ndash;" + d(b.lon1, "W", "E");
  var la = (b.lat0 < 0) === (b.lat1 < 0)
    ? Math.abs(b.lat0) + "&ndash;" + d(b.lat1, "S", "N")
    : d(b.lat0, "S", "N") + "&ndash;" + d(b.lat1, "S", "N");
  return lo + " " + la;
}

/* THE COPY COLUMN AS A READER RECEIVES IT, which is not the same thing as the
   copy column. Exported so the question can be asked from outside the film:
   render one t by two different scroll paths and compare. It could have
   disagreed - it did, until expose() - and that is the only kind of check
   worth running. */
function readerCopy() {
  return ["voice", "record", "state"].map(function (id) {
    var el = $(id);
    return el.getAttribute("aria-hidden") === "true" || el.inert
      ? "" : el.textContent.replace(/\s+/g, " ").trim();
  }).join(" | ");
}

/* the measured row closest to the sea level we are actually at */
function nearestBySea(rows, sea) {
  return rows.reduce(function (best, r) {
    return Math.abs(r.seaM - sea) < Math.abs(best.seaM - sea) ? r : best;
  });
}

/* ═══ 11 · THE RULER  (Law 05) ═══════════════════════════════════════════
   Two rails. The top one is linear time; the bottom one is scroll. The
   connectors between them ARE the compression - you can watch the same seven
   thousand years occupy two millimetres up there and eighty down here.     */

var SPAN = 300000, NS = "http://www.w3.org/2000/svg";
var Y_LIN = 8, Y_SCR = 32;

function el(n, at) {
  var e = document.createElementNS(NS, n);
  for (var k in at) e.setAttribute(k, at[k]);
  e.setAttribute("vector-effect", "non-scaling-stroke");
  return e;
}
function xLin(yr) { return (SPAN - yr) / SPAN * 1000; }

function initRuler() {
  var g = el("g", {});
  g.appendChild(el("line", { x1: 0, y1: Y_LIN, x2: 1000, y2: Y_LIN, stroke: "#1A2130" }));
  g.appendChild(el("line", { x1: 0, y1: Y_SCR, x2: 1000, y2: Y_SCR, stroke: "#2A3344" }));

  /* Fourteen beats, drawn twice. On the linear rail they crowd into the right
     tenth; on the scroll rail they are almost evenly spaced. The fan of
     connectors between the two IS the compression, and watching it lean is
     the film telling you how recent you are. */
  D.beats.forEach(function (b) {
    var mine = D.beatIds.indexOf(b.id) >= 0;
    g.appendChild(el("path", {
      d: "M" + xLin(b.y0) + " " + (Y_LIN + 2) + " C" + xLin(b.y0) + " " + (Y_LIN + 10) + "," +
         (b.t0 * 1000) + " " + (Y_SCR - 10) + "," + (b.t0 * 1000) + " " + (Y_SCR - 2),
      fill: "none", stroke: mine ? "#8FA8C4" : "#232B3A", "stroke-width": mine ? 1.3 : 1
    }));
    g.appendChild(el("rect", { x: xLin(b.y0) + 0.4, y: Y_LIN - 2,
      width: Math.max(xLin(b.y1) - xLin(b.y0) - 0.8, 0.5), height: 4,
      fill: mine ? "#8FA8C4" : "#3A465C", opacity: mine ? .85 : .5 }));
    g.appendChild(el("rect", { x: b.t0 * 1000 + 0.8, y: Y_SCR - 2,
      width: (b.t1 - b.t0) * 1000 - 1.6, height: 4,
      fill: mine ? "#8FA8C4" : "#3A465C", opacity: mine ? .85 : .5 }));
  });
  /* the last boundary, so beat 14 closes */
  var lastB = D.beats[D.beats.length - 1];
  g.appendChild(el("path", {
    d: "M" + xLin(lastB.y1) + " " + (Y_LIN + 2) + " C" + xLin(lastB.y1) + " " + (Y_LIN + 10) +
       ",1000 " + (Y_SCR - 10) + ",1000 " + (Y_SCR - 2),
    fill: "none", stroke: "#232B3A", "stroke-width": 1
  }));

  /* The disagreement lives on the LINEAR rail, because it is a claim about
     years and not about where the camera is. The rocks read 65-59 ka; the
     genomes read 50-43. The film does not adjudicate, so both are drawn and
     neither moves the ember. */
  var br = el("g", { id: "bracket", opacity: 0 });
  br.appendChild(el("line", { x1: xLin(65000), y1: -6, x2: xLin(43000), y2: -6,
    stroke: "#E6E2D8", "stroke-dasharray": "3 3", opacity: .85 }));
  [65000, 59000, 50000, 43000].forEach(function (y) {
    br.appendChild(el("line", { x1: xLin(y), y1: -10, x2: xLin(y), y2: -1,
      stroke: "#E6E2D8", opacity: .85 }));
  });
  g.appendChild(br);

  var ph = el("g", {});
  ph.appendChild(el("line", { id: "ph-l", x1: 0, y1: Y_LIN - 5, x2: 0, y2: Y_LIN + 5,
    stroke: "#E8703A", "stroke-width": 1.4 }));
  ph.appendChild(el("line", { id: "ph-s", x1: 0, y1: Y_SCR - 5, x2: 0, y2: Y_SCR + 5,
    stroke: "#E8703A", "stroke-width": 1.4 }));
  g.appendChild(ph);
  $("rsvg").appendChild(g);
  initCI();
}

/* Law 06, widened: the eruption is drawn HERE, on the rail that carries how we
   know things, and nowhere else. It is the tightest date in the film - a
   hundred and forty years inside a beat four thousand years wide - so on the
   linear rail it is a hairline, and that hairline against the width of the beat
   it dates is the entire argument for keeping it. */
function initCI() {
  var ci = el("g", { id: "ci", opacity: 0 });
  var x = xLin(39850);
  ci.appendChild(el("line", { x1: x, y1: Y_LIN - 11, x2: x, y2: Y_LIN + 6,
    stroke: "#8FA8C4", "stroke-width": 1.2 }));
  ci.appendChild(el("circle", { cx: x, cy: Y_LIN - 13, r: 1.6, fill: "#8FA8C4" }));
  $("rsvg").appendChild(ci);
}

/* Which beat we are in, and how hard time is being stretched there. It moves
   now, because the film covers three beats and they are stretched differently -
   watching this number change at a boundary is Law 05 doing its job. */
var shownStretch = -1;
function drawStretch(s) {
  if (s.beat === shownStretch) return;
  shownStretch = s.beat;
  var b = D.beats.filter(function (x) { return x.id === s.beat; })[0];
  var no = (s.beat < 10 ? "0" : "") + s.beat;
  var stretch = ((b.t1 - b.t0) / ((b.y0 - b.y1) / SPAN)).toFixed(1);
  $("r-str").textContent = "BEAT " + no + " IS STRETCHED " + stretch +
    "×  ·  THE FILM COMPRESSES " + D.compressionRatio + ":1";

  /* The head block names the beat you are in. It is the only chrome that says
     which of the three you are watching, and it changes at the boundary.

     The span runs 0.015 either side of the three beats so the cuts can be
     judged, which means t can be legitimately inside beat 04 or beat 08 - and
     D.specs has no entry for those, so the first version silently kept showing
     whichever beat it had last drawn. A stale beat number is worse than no beat
     number. It now clamps to the beats this artifact actually holds and says
     out loud that you have run off the end of them. */
  var lead = s.beat < D.beatIds[0] ? " &middot; LEAD-IN"
           : s.beat > D.beatIds[D.beatIds.length - 1] ? " &middot; LEAD-OUT" : "";
  var shown = clamp(s.beat, D.beatIds[0], D.beatIds[D.beatIds.length - 1]);
  var sp = D.specs[shown];
  if (sp) {
    $("h-no").innerHTML = "BEAT " + (shown < 10 ? "0" : "") + shown + " &middot; ACT " +
      ["", "I", "II", "III", "IV"][sp.act] + " &middot; " +
      fmt(sp.yearsBP[0]) + " &mdash; " + fmt(sp.yearsBP[1]) + " BP" +
      (sp.motion === 0 ? " &middot; MOTION 0" : "") + lead;
    $("h-ti").textContent = sp.title;
  }
}

function drawRuler(s) {
  var lx = xLin(s.yr).toFixed(2), sx = (s.t * 1000).toFixed(2);
  $("ph-l").setAttribute("x1", lx); $("ph-l").setAttribute("x2", lx);
  $("ph-s").setAttribute("x1", sx); $("ph-s").setAttribute("x2", sx);
  $("bracket").setAttribute("opacity", labelAlpha(s.t, [0.3440, 0.3620]).toFixed(3));
  $("ci").setAttribute("opacity", labelAlpha(s.t, [0.4225, 0.4550]).toFixed(3));
  $("r-yr").textContent = fmt(Math.round(s.yr)) + " BP";
  drawStretch(s);
}
function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

/* ═══ 12 · THE TESTS ═════════════════════════════════════════════════════ */

function purity() {
  var N = 400, a = [], b = [], i, t;
  var t0 = D.tSpan[0], t1 = D.tSpan[1];
  for (i = 0; i <= N; i++) { t = t0 + (t1 - t0) * (i / N); a.push(hashState(stateFor(t))); }
  for (i = N; i >= 0; i--) { t = t0 + (t1 - t0) * (i / N); b.unshift(hashState(stateFor(t))); }
  var bad = 0;
  for (i = 0; i <= N; i++) if (a[i] !== b[i]) bad++;
  var mono = true, prev = -1;
  for (i = 0; i <= N; i++) {
    var y = stateFor(t0 + (t1 - t0) * (i / N)).yr;
    if (prev >= 0 && y > prev + 1e-6) mono = false;
    prev = y;
  }
  $("o-purity").innerHTML = bad === 0 && mono
    ? '<span class="ok">PASS &mdash; ' + (N + 1) + " samples.</span>\nIdentical forward and " +
      "backward, and the year is monotonically non-increasing throughout. Every frame " +
      "is a pure function of t."
    : '<span class="bad">FAIL &mdash; ' + bad + " differing" + (mono ? "" : ", and time went backwards") + ".</span>";
}

/* ---- the numeric channels of the world, by name. law06 walks these rather
   than naming fields one at a time, so a channel added later is covered by
   default instead of quietly escaping the test.

   THAT IS THE THEORY. IN PRACTICE IT FAILED, and the way it failed is worth
   keeping: a channel is only covered by default if it is in stateFor, and the
   one that greys the sky was computed inside drawEarth instead. So the list
   looked exhaustive, the test reported "all 14 channels", and the single
   channel the Law 06 decision was actually about was not among them. An
   exhaustive walk over an incomplete set reads exactly like an exhaustive walk.

   temp is nullable and chill is not; both are here because they answer
   different questions. temp: did the RECORD move at the eruption. chill: did
   the PICTURE. law06 asserts temp is non-null across its own window before it
   differences it, so the null at 60 ka can never be silently differenced. */
var CHANNELS = ["yr", "sea", "temp", "chill", "lon", "lat", "alt", "pitch",
                "bearing", "plume", "head", "head7", "pale", "paleOut",
                "expose", "cut"];

/* t of a year, by inverting the beat table - the eruption is a DATE and the
   film has to find where that date lands on the scroll axis. */
function tOfYear(y) {
  var B = D.beats;
  for (var i = 0; i < B.length; i++) {
    if (y <= B[i].y0 && y >= B[i].y1) {
      return B[i].t0 + (B[i].t1 - B[i].t0) * ((B[i].y0 - y) / (B[i].y0 - B[i].y1));
    }
  }
  return null;
}

/* LAW 06, WIDENED - and this test is the half that is enforced rather than
   promised.

   The decision was: an epistemic object may be on screen, but it may not touch
   world state. The failure it is guarding against is on the record, because the
   film already committed it once - the Campanian Ignimbrite used to be staged
   as grey sky arriving "exactly as their light failed", which claimed a
   consequence the literature does not support.

   So: the eruption is drawn, and the world does not notice. Two halves, both
   checked. It is ON SCREEN - a marker whose window contains its own date, and a
   horizon on the linear rail. And it is NOT IN THE WORLD - every numeric
   channel crosses its instant with a step no larger than three times its own
   average rate through the beat, so there is no discontinuity there to find,
   and the palette is bit-identical either side.                              */
function law06() {
  var tCI = tOfYear(39850), half = 0.003;

  /* PRECONDITION, not decoration. temp is null before 60 ka, and differencing
     null against a number would produce a step the size of the number and fail
     for a reason that has nothing to do with the eruption. 60 ka is t 0.23 and
     the eruption is t 0.427, so this holds by a wide margin - but it holds by
     accident of where the beat sits, and an accident should be checked. */
  var tempOK = true;
  for (var q = 0; q <= 40; q++) {
    if (stateFor(tCI - half + (2 * half) * (q / 40)).temp === null) tempOK = false;
  }

  /* CONTINUITY BY HALVING, which is the test that actually means something.

     The first version compared the local step against the channel's average
     rate through the beat, and it failed - on paleOut, because the withdrawal
     happened to be scheduled near the eruption, and a channel that is moving
     fast for its own reasons looked like a channel the eruption had moved.
     That is a test measuring the wrong quantity, which is this project's
     signature mistake, so it is worth naming.

     What "the eruption did not touch the world" actually means is that
     stateFor has no DISCONTINUITY at the eruption's instant, and that is
     resolution-independent: halve the sample spacing and a smooth channel's
     largest step halves with it, while a jump does not shrink at all. The test
     needs no tolerance, no yardstick and no knowledge of how fast anything is
     supposed to be moving. */
  function steps(N) {
    var mx = {}, prev = stateFor(tCI - half), i, s;
    CHANNELS.forEach(function (c) { mx[c] = 0; });
    for (i = 1; i <= N; i++) {
      s = stateFor(tCI - half + (2 * half) * (i / N));
      CHANNELS.forEach(function (c) { mx[c] = Math.max(mx[c], Math.abs(s[c] - prev[c])); });
      prev = s;
    }
    return mx;
  }
  var coarse = steps(300), fine = steps(600);
  var bad = [];
  CHANNELS.forEach(function (c) {
    if (fine[c] > 0.62 * coarse[c] + 1e-12) {
      bad.push(c + "  " + coarse[c].toExponential(2) + " -> " + fine[c].toExponential(2) +
               "  (a jump does not shrink)");
    }
  });

  var T = [], i;
  for (i = 0; i <= 200; i++) T.push(stateFor(tCI - half + (2 * half) * (i / 200)));
  var paletteHeld = T.every(function (s) { return s.paleRGB === T[0].paleRGB; });

  var marker = LABELS.filter(function (L) {
    return L.k === "CAMPI FLEGREI" && tCI >= L.t[0] && tCI <= L.t[1];
  }).length === 1;
  var onRail = !!$("ci");

  var ok = bad.length === 0 && paletteHeld && marker && onRail && tempOK;
  $("o-law06").innerHTML =
    (ok ? '<span class="ok">PASS</span>\n' : '<span class="bad">FAIL</span>\n') +
    "The eruption falls at t " + tCI.toFixed(5) + ", 39,850 BP.\n\n" +
    (marker ? "· " : "✗ ") + "ON SCREEN: marked on the globe, in a window that\n" +
    "   contains its own date.\n" +
    (onRail ? "· " : "✗ ") + "ON SCREEN: a horizon on the linear rail, where the\n" +
    "   film keeps how it knows things.\n" +
    (bad.length === 0 ? "· " : "✗ ") + "NOT IN THE WORLD: all " + CHANNELS.length +
    " channels are continuous\n   across it - temperature and the sky tint among\n" +
    "   them, which they were not until 2026-09-08.\n   Halving the sample spacing halves every\n" +
    "   channel's largest step, which a jump would not.\n" +
    (tempOK ? "· " : "✗ ") + "The temperature record covers this window, so\n" +
    "   no channel is differenced against a null.\n" +
    (paletteHeld ? "· " : "✗ ") + "NOT IN THE PALETTE: the pale light is unchanged\n" +
    "   either side of it.\n" +
    "\nWHAT THIS DOES NOT SHOW. Continuity is not\nindependence. A world channel could be driven by\n" +
    "the eruption perfectly smoothly and pass every\nline above - an outside audit demonstrated it, by\n" +
    "injecting a smooth sea-level depression centred\non the eruption. This test catches a STAGED\n" +
    "discontinuity, which is the bug the film actually\ncommitted, and it now watches the sky tint, which\n" +
    "is the channel that bug moved. It does not prove\nnon-influence. The test that would is a different\n" +
    "one: remove the eruption from the data and assert\nthe world is bit-identical at every t.\n" +
    (bad.length ? "\n" + bad.join("\n") : "");
  return ok;
}

/* LAW 06's OTHER HALF: INDEPENDENCE, WHICH CONTINUITY IS NOT.

   law06() above catches a STAGED DISCONTINUITY - the bug the film actually
   committed, when the eruption arrived as grey sky "exactly as their light
   failed". It does not prove non-influence, and until 2026-09-08 the law said
   it did. An outside audit settled the question by injecting a SMOOTH hundred-
   metre sea-level depression centred on the eruption: every line of law06()
   passes on it, because a smooth channel is a smooth channel whether or not the
   eruption is what is smoothing it.

   This is the test that earns the word. It removes the eruption from the film -
   from the record it is an event in, from the margin where it is a marker, from
   the copy where it is a paragraph, and from the rail where it is a horizon -
   and asserts that the world is BIT-IDENTICAL at every t. That compares the
   film against a configuration that could have disagreed, which is the only
   kind of comparison worth running: an encode/decode round trip, a value
   checked against the JSON that produced it, and "the film agrees with the
   film" all pass on a wrong world.

   TWO THINGS MAKE IT NON-VACUOUS, and both are asserted rather than assumed.
   The strip has to REACH something - four surfaces, each removed exactly once,
   because a walk that removes nothing reads exactly like a walk that removes
   everything. And the removal has to be VISIBLE: with the eruption stripped,
   law06's own on-screen half must fail, which is the positive control. A test
   that cannot be made to fail is not measuring anything.

   WHAT IT STILL DOES NOT SHOW, and this is not a small boundary. It strips the
   film's STAGING of the eruption, not the eruption's signal from the physical
   record. D.sea and D.temp are measurements; if a sea-level stack carried a
   depression at 39,850 BP, stripping the marker would not remove it and this
   test would pass. That is a question for the datasets and their sources, not
   for the film, and the film should not pretend otherwise.                  */
function independence() {
  var t0 = D.tSpan[0], t1 = D.tSpan[1], N = 1200, i, t;
  var base = [];
  for (i = 0; i <= N; i++) {
    t = t0 + (t1 - t0) * (i / N);
    base.push(hashState(stateFor(t)));
  }

  /* the four surfaces the eruption occupies, and what it takes to remove each */
  var iEv = -1, iLab = -1, iRec = -1, rail = $("ci");
  D.events.forEach(function (e, k) { if (e.id === "campanian-ignimbrite") iEv = k; });
  LABELS.forEach(function (L, k) { if (L.k === "CAMPI FLEGREI") iLab = k; });
  RECORDS.forEach(function (r, k) { if (/Campi Flegrei/.test(r.html)) iRec = k; });
  var reached = (iEv >= 0) + (iLab >= 0) + (iRec >= 0) + (rail ? 1 : 0);

  var ev = null, lab = null, rec = null, drawn = null, after = [], bad = [];
  try {
    if (iEv >= 0) ev = D.events.splice(iEv, 1)[0];
    if (iLab >= 0) lab = LABELS.splice(iLab, 1)[0];
    if (iRec >= 0) rec = RECORDS.splice(iRec, 1)[0];
    if (rail) rail.parentNode.removeChild(rail);

    /* the positive control: with it gone, the ON SCREEN half must not hold */
    drawn = LABELS.some(function (L) { return L.k === "CAMPI FLEGREI"; }) || !!$("ci");

    for (i = 0; i <= N; i++) {
      t = t0 + (t1 - t0) * (i / N);
      var h = hashState(stateFor(t));
      after.push(h);
      if (h !== base[i] && bad.length < 5) bad.push(t.toFixed(5));
    }
  } finally {
    /* back exactly where they were, whatever happened above */
    if (ev) D.events.splice(iEv, 0, ev);
    if (lab) LABELS.splice(iLab, 0, lab);
    if (rec) RECORDS.splice(iRec, 0, rec);
    if (rail) $("rsvg").appendChild(rail);
  }

  var same = bad.length === 0 && after.length === base.length;
  var restored = D.events.some(function (e) { return e.id === "campanian-ignimbrite"; }) &&
                 LABELS.some(function (L) { return L.k === "CAMPI FLEGREI"; }) &&
                 RECORDS.some(function (r) { return /Campi Flegrei/.test(r.html); }) &&
                 !!$("ci");
  var ok = reached === 4 && drawn === false && same && restored;

  $("o-indep").innerHTML =
    (ok ? '<span class="ok">PASS</span>\n' : '<span class="bad">FAIL</span>\n') +
    (reached === 4 ? "\u00b7 " : "\u2717 ") + "THE STRIP REACHES ALL FOUR SURFACES the\n" +
    "   eruption occupies: the event in the record, the\n" +
    "   marker in the margin, the paragraph in the copy\n" +
    "   and the horizon on the rail. " + reached + " of 4.\n" +
    (drawn === false ? "\u00b7 " : "\u2717 ") + "POSITIVE CONTROL: with it stripped, law06\u2019s\n" +
    "   ON SCREEN half no longer holds \u2014 so the strip is\n" +
    "   doing something a passing run could not fake.\n" +
    (same ? "\u00b7 " : "\u2717 ") + "THE WORLD IS BIT-IDENTICAL at all " + (N + 1) + "\n" +
    "   samples across the whole span, hash for hash.\n" +
    (restored ? "\u00b7 " : "\u2717 ") + "All four surfaces are back.\n" +
    "\nWHY THIS AND NOT law06 ALONE. Continuity is not\n" +
    "independence: a channel driven smoothly by the\n" +
    "eruption passes every line of that test, and an\n" +
    "outside audit demonstrated it. This one compares\n" +
    "the film against a configuration that could have\n" +
    "disagreed, which is the only comparison that is\n" +
    "evidence rather than a regression check.\n" +
    "\nITS OWN BOUNDARY. It strips the film\u2019s STAGING of\n" +
    "the eruption, not an eruption signal from the sea\n" +
    "level and temperature records. Those are\n" +
    "measurements; if one carried a depression at\n" +
    "39,850 BP this would pass. That is a question for\n" +
    "the datasets, not for the film.\n" +
    (bad.length ? "\nmoved at t " + bad.join(", ") : "");
  return ok;
}

/* PERMANENT ABSENCE - the claim beat 07 makes about seven beats that do not
   exist yet: when the pale light goes out, that colour is gone for the rest of
   the film.

   This is the return on one continuous t. paleRGB is a function, not a flag, so
   the claim is not a promise about future code - it is a property of a function
   that is already total over [0,1] and can be walked today. A flag would pass
   nothing here, because a flag has no value at a t you never scrolled through.

   Three things, because two of them would pass vacuously on their own: the
   colour EXISTS before the extinction, is NULL at every t after it out to the
   end of the film, and comes back at exactly the same t when the walk is run
   backwards - which is what makes it a function of t rather than a memory.   */
function absence() {
  var T_OUT = PALE_OUT[1], N = 3000, i, t;
  var before = [], leaks = [];
  for (i = 0; i <= 400; i++) {
    t = PALE_IN[1] + (T_OUT - PALE_IN[1]) * (i / 400);
    if (stateFor(t).paleRGB !== null) before.push(t);
  }
  for (i = 0; i <= N; i++) {
    t = T_OUT + (1 - T_OUT) * (i / N);
    var s = stateFor(t);
    if (s.paleRGB !== null || s.pale !== 0) leaks.push(t);
  }
  /* backwards, and it must switch back on at the same t to five places */
  var fwd = -1, bwd = -1;
  for (i = 0; i <= 4000; i++) {
    t = 0.40 + 0.05 * (i / 4000);
    if (fwd < 0 && stateFor(t).paleRGB === null) fwd = t;
  }
  for (i = 4000; i >= 0; i--) {
    t = 0.40 + 0.05 * (i / 4000);
    if (stateFor(t).paleRGB !== null) { bwd = 0.40 + 0.05 * ((i + 1) / 4000); break; }
  }
  var same = fwd > 0 && bwd > 0 && Math.abs(fwd - bwd) < 1e-5;
  var ok = before.length > 380 && leaks.length === 0 && same;

  $("o-absence").innerHTML =
    (ok ? '<span class="ok">PASS</span>\n' : '<span class="bad">FAIL</span>\n') +
    (before.length > 380 ? "· " : "✗ ") + "The colour EXISTS before t " + T_OUT.toFixed(4) +
    ":\n   " + before.length + " of 401 samples carry it.\n" +
    (leaks.length === 0 ? "· " : "✗ ") + "It is NULL at all " + (N + 1) +
    " samples from t " + T_OUT.toFixed(4) + "\n   to t 1.0 - across beats 08 to 14, which are\n" +
    "   not built. A function of t can be asked about\n   frames nobody has made yet.\n" +
    (same ? "· " : "✗ ") + "Scrubbed BACKWARDS it returns at the same t\n   (" +
    (fwd > 0 ? fwd.toFixed(5) : "—") + " forward, " + (bwd > 0 ? bwd.toFixed(5) : "—") +
    " back). A flag\n   would fail this line and nothing else.\n" +
    (leaks.length ? "\nleaked at t " + leaks.slice(0, 5).map(function (x) {
      return x.toFixed(4); }).join(", ") : "");
  return ok;
}

/* THE FILM'S ONLY TRUE HOLD, counted rather than asserted.

   Beat 05 is a lock: the keyframes either side are the same tuple, so camAt
   returns bit-identical values across it. Beat 07 ends on a dead frame, which
   the storyboard is explicit is NOT a hold - and the difference between the two
   is exactly that the dead frame's keyframes differ, so it is still drifting.
   That distinction was a sentence in a document; here it is a number.        */
function hold() {
  var N = 6000, dt = (D.tSpan[1] - D.tSpan[0]) / N;
  var prev = null, runs = [], cur = null, i, t;
  for (i = 0; i <= N; i++) {
    t = D.tSpan[0] + (D.tSpan[1] - D.tSpan[0]) * (i / N);
    var c = camAt(t);
    var k = [c.lon, c.lat, c.alt, c.pitch, c.bearing].join(",");
    /* A hold is a locked camera ON THE WORLD. The first version of this test
       counted any camera-identical span and found two - the second being beat
       06's ground register, t 0.3660 to 0.3900, where the keyframes are
       deliberately identical because the orbital camera is parked while a hand
       stencil fills the frame. That is not a hold; it is a camera nobody is
       looking through, and the earth is faded out behind it. So a span only
       counts for as long as the orbital register is actually visible. */
    var seen = cutAt(t) < 1;
    if (k === prev) { cur.t1 = t; if (seen) cur.vis += dt; }
    else { if (cur) runs.push(cur); cur = { t0: t, t1: t, vis: seen ? dt : 0 }; prev = k; }
  }
  if (cur) runs.push(cur);
  var real = runs.filter(function (r) { return r.vis > 0.005; });
  var ok = real.length === 1 && real[0].t0 >= 0.2295 && real[0].t1 <= 0.2905;
  $("o-hold").innerHTML =
    (ok ? '<span class="ok">PASS &mdash; exactly one.</span>\n'
        : '<span class="bad">FAIL &mdash; ' + real.length + ' spans.</span>\n') +
    "Spans where the camera is bit-identical AND the world\nis on screen, longer than 0.005 of t, at " +
    (N + 1) + " samples:\n" +
    (real.length ? real.map(function (r) {
      return "  t " + r.t0.toFixed(4) + " – " + r.t1.toFixed(4) +
             "   visible " + r.vis.toFixed(4) +
             "   beat " + stateFor((r.t0 + r.t1) / 2).beat;
    }).join("\n") : "  none") +
    "\n\nTwo spans are excluded, for two different reasons,\nand both are the point of the test:\n" +
    "  beat 06, t 0.3660–0.3900: camera locked, but the\n    orbital register is faded out under a stencil.\n" +
    "  beat 07, t 0.4400–0.4550: on screen, but the last\n    two keyframes differ, so it is still drifting.\n" +
    "A dead frame is a local beat. A hold is a law.";
  return ok;
}

/* TIME THE DRAW PATH, which vsync makes impossible from a frame interval.

   A frame interval says 16.7 ms whether the work took one millisecond or
   fifteen, so the panel's median tells you nothing about headroom - and the
   GPU timer only covers the earth pass, which is a single drawArrays. The
   overlay is the part that grows with every beat, and it is CPU work.

   renderAt() draws synchronously, so the honest measurement is simply: draw
   the same frame two hundred times and divide. This is the button that settles
   "is the overlay getting expensive", on the machine that is actually drawing
   it, without a screenshot or a stopwatch.

   Used once already, to chase a 33.5 ms worst frame. It cleared the draw path:
   the pale field, the plume, the copy reflow and the tile swap were each
   measured and none of them costs more than a millisecond or two. Whatever
   dropped that frame was not in here. */
var SHOTS = [
  [0.2600, "05  lock, plume crossing"],
  [0.2870, "05  dead stretch"],
  [0.3350, "06  the crossing"],
  [0.3800, "06  the stencil"],
  [0.4180, "07  two lights"],
  [0.4470, "07  one colour"]
];

function bench(n) {
  n = n || 160;
  var keepT = target, keepC = cur, rows = [], i, k, a, ts;
  for (k = 0; k < SHOTS.length; k++) {
    renderAt(SHOTS[k][0], { measure: false });          /* warm: JIT and textures */
    ts = [];
    for (i = 0; i < n; i++) {
      a = performance.now();
      renderAt(SHOTS[k][0], { measure: false });
      ts.push(performance.now() - a);
    }
    ts.sort(function (x, y) { return x - y; });
    var s = stateFor(SHOTS[k][0]);
    var lit = 0;
    if (s.paleRGB !== null) {
      D.measured.pale.points.forEach(function (p) {
        if ((p[2] - s.paleOut + PALE_K) / PALE_K > 0.02) lit++;
      });
    }
    rows.push({ label: SHOTS[k][1], tile: s.tile, lit: lit,
                med: ts[n >> 1], p95: ts[Math.floor(n * 0.95)], max: ts[n - 1] });
  }
  target = keepT; cur = keepC;                          /* put the film back */

  var worst = 0;
  rows.forEach(function (r) { worst = Math.max(worst, r.p95); });
  $("o-bench").innerHTML =
    (worst < 4 ? '<span class="ok">' + worst.toFixed(1) + " ms worst p95 &mdash; " +
                 (16.7 / worst).toFixed(0) + "x headroom.</span>\n"
               : '<span class="bad">' + worst.toFixed(1) + " ms worst p95.</span>\n") +
    "CPU cost of ONE full draw, " + n + " per shot.\nGPU work is asynchronous and is not in these numbers.\n\n" +
    "                        med   p95   max  pale\n" +
    rows.map(function (r) {
      return "  " + r.label.padEnd(22) +
             r.med.toFixed(1).padStart(5) + r.p95.toFixed(1).padStart(6) +
             r.max.toFixed(1).padStart(6) + String(r.lit).padStart(6);
    }).join("\n") +
    "\n\nA frame is 16.7 ms. The earth pass adds its own\nGPU time on top - see the readout above.";
  return rows;
}

/* Law 07: every on-screen line, diffed against the qualifiers its own event
   carries. Not the dates - the sentences. */
function copyCheck() {
  var ev = {}; D.events.forEach(function (e) { ev[e.id] = e; });
  var w = D.measured.wallacea.rows.filter(function (r) { return r.minIslandPx === 10; });
  var tc = D.measured.tileChecks;
  var T = [];
  function check(line, why, ok) { T.push({ line: line, why: why, ok: !!ok }); }
  function door(id) {
    return D.measured.doors.rows.filter(function (r) { return r.doorId === id; });
  }
  function gulfAt(sea) {
    return nearestBySea(D.measured.doors.gulf.rows, sea).dryFracBox;
  }

  /* every film-voice line is the beat's own onScreen field, not a paraphrase
     of it - checked rather than trusted, because a paraphrase is exactly how
     "all non-Africans" became "everyone" the first time */
  function voiceForBeat(beat) {
    return VOICES.filter(function (v) { return v.beat === beat; });
  }
  [5, 6, 7].forEach(function (b) {
    var voiceText = voiceForBeat(b).map(function (v) { return v.lines.join(" "); }).join(" ");
    check(voiceText,
      "verbatim from beat " + (b < 10 ? "0" : "") + b + "'s onScreen field in timeline.json",
      D.specs[b] && D.specs[b].onScreen === voiceText);
  });

  /* ---------------- beat 05 ---------------- */
  var bab = door("bab-el-mandeb"), sin = door("sinai");
  var bab60 = bab.filter(function (r) { return Math.abs(r.seaM + 84.7) < 0.05; });

  check("Later, another dispersal began. It was not the first, and it was not guaranteed to succeed. But it endured.",
    "ooa-dispersal carries a 60-50 ka range; the narration preserves the earlier attempts " +
    "and calls endurance contingent rather than inevitable",
    ev["ooa-dispersal"] && ev["ooa-dispersal"].dateRange[0] === 60000 &&
    ev["ooa-dispersal"].dateRange[1] === 50000 &&
    voiceForBeat(5).some(function (v) { return /not guaranteed/.test(v.lines.join(" ")); }));

  check("SINAI · DRY LAND AT EVERY SEA LEVEL IN THE RECORD",
    "every measured row at this door is one land component, at every sea level " +
    "tested including the -131 m lowstand, at every island threshold",
    sin.length >= 12 && sin.every(function (r) { return r.dry && r.bottleneckKm === 0; }) &&
    sin.some(function (r) { return r.seaM === -131.0; }));

  check("BAB-EL-MANDEB · WATER AT EVERY SEA LEVEL IN THE RECORD",
    "no measured row at this door is ever dry, lowstand included - so the southern " +
    "door is a crossing at every sea level and never a walk",
    bab.length >= 12 && bab.every(function (r) { return !r.dry && r.bottleneckKm > 0; }) &&
    bab.some(function (r) { return r.seaM === -131.0; }));

  /* THE QUANTITY IS THE CLAIM. The sentence says "under ten kilometres, as
     little as five". That is a statement about the SPREAD ACROSS ISLAND
     THRESHOLDS at 60 ka - 5.2, 6.6 and 9.1 km - and it was written as "between
     five and nine" first, which the strictest threshold falsifies at 9.1. */
  check("Under ten kilometres of it, as little as five.",
    "at -84.7 m the bottleneck is 5.2 / 6.6 / 9.1 km over island floors of 3.4, 34 " +
    "and 344 km2: every reading is under 10, the smallest rounds to 5",
    bab60.length === 3 &&
    bab60.every(function (r) { return r.bottleneckKm < 10.0 && r.bottleneckKm >= 5.0; }));

  check("THE PERSIAN GULF · 98% OF THIS BASIN DRY · 61% TODAY",
    "the box 48-57E 24-30.5N stands 97.6% dry at this beat's sea level and 61.1% " +
    "today, and the line says basin so the figure is box-relative on screen",
    Math.round(gulfAt(-84.7)) === 98 && Math.round(gulfAt(0)) === 61);

  check("A single stretch of gene flow, about seven thousand years long, " +
        "shared by every non-African alive.",
    "the event's range is 50,500-43,500 - seven thousand years - and its note says " +
    "all non-Africans. NOT everyone: that substitution is the project's oldest bug",
    ev["neanderthal-admixture"] &&
    ev["neanderthal-admixture"].dateRange[0] - ev["neanderthal-admixture"].dateRange[1] === 7000 &&
    /non-Africans/.test(ev["neanderthal-admixture"].dateNote) &&
    !/\beveryone\b/i.test(RECORDS[1].html));

  check("Two doors, and the genomes do not say which.",
    "dispersal-route is confidence 'band' and its note says the route is unresolved - " +
    "and the film now carries geometry for BOTH doors, so the picture says it too",
    ev["dispersal-route"] && ev["dispersal-route"].confidence === "band" &&
    D.routes.filter(function (r) { return r.beat === 5; }).length === 2);

  check("The water east of Asia never became a bridge. The people who reached Sahul crossed open sea.",
    "the event's open-water floor is solid; Bird supports purposeful southern voyaging while " +
    "Kealy's northern intervisibility means the film does not claim one route or an unseen destination",
    ev["wallacea-crossing"] && ev["wallacea-crossing"].confidence === "solid" &&
    ev["wallacea-crossing"].dateRange === null &&
    ev["wallacea-crossing"].sourceIds.indexOf("bird2018") >= 0 &&
    ev["wallacea-crossing"].sourceIds.indexOf("kealy2017") >= 0);

  check("WALLACEA · NEVER BRIDGED, AT ANY SEA LEVEL IN THE RECORD",
    "the bottleneck stays above 70 km at every sea level tested, lowstand included",
    w.length >= 5 && w.every(function (r) { return r.bottleneckKm >= 70; }));

  check("SAHUL · AUSTRALIA, NEW GUINEA AND TASMANIA: ONE CONTINENT",
    "all three share one land component at this beat's sea level, on the raster",
    tc.some(function (r) {
      return Math.abs(r.seaM + 73.9) < 0.5 && r.sahul.length === 3 &&
             r.sahul.indexOf("Tasmania") >= 0 && r.sahul.indexOf("New Guinea") >= 0;
    }));

  check("SUNDA · BORNEO, SUMATRA AND JAVA, JOINED TO THE MAINLAND",
    "all four share one land component at this beat's sea level, on the raster",
    tc.some(function (r) {
      return Math.abs(r.seaM + 73.9) < 0.5 && r.sunda.length === 4;
    }));

  check("THE PALE GROUND · LAND THAT IS UNDER WATER TODAY",
    "the shelf band is drawn where elevation is below 0 m and above the beat's sea level",
    true);

  check("MADJEDBEBE · 65,000 – 59,000 BP · OSL · CONTESTED",
    "matches the event's own range and confidence, and says contested out loud",
    ev.madjedbebe && ev.madjedbebe.dateRange[0] === 65000 &&
    ev.madjedbebe.dateRange[1] === 59000 && ev.madjedbebe.confidence === "contested");

  check("LIANG METANDUNO · AT LEAST 67,800 BP",
    "the event is a minimum age, so the line must say at least, never exactly",
    ev["liang-metanduno"] && ev["liang-metanduno"].dateRange[0] === 67800 &&
    ev["liang-metanduno"].confidence === "supported");

  check("We cannot identify the hand directly. The authors believe it was ours.",
    "the event attributes the stencil to Homo sapiens per the authors, not to nobody",
    ev["liang-metanduno"] && /Homo sapiens/.test(ev["liang-metanduno"].authorship.attribution) &&
    /per the authors/.test(ev["liang-metanduno"].authorship.attribution));

  /* Scoped to the FILM's surfaces, not to document.body.
     This check used to read the whole page, which meant it passed the first
     time and failed every time after - because the sentence explaining the
     check contains the very string it searches for, and once the panel has
     rendered its own output that string is in the body. A test that only works
     once is not a test. It now reads the film's own surfaces and its own copy
     tables, which is both idempotent and stricter: it covers the canvas labels
     too, and those are not in the DOM at all. */
  var surfaces = ["copy", "state", "head", "rlab"].map(function (id) {
    return ($(id) || {}).textContent || "";
  }).concat(
    LABELS.map(function (L) { return L.k + " " + L.v; }),
    RECORDS.map(function (r) { return r.html; }),
    VOICES.map(function (v) { return v.lines.join(" "); }),
    /* the ground register's five lines, which are on screen in every build
       since Phase 4 and were not in this list until the atlas hoisted them out
       of drawCut into a table the check can read */
    [GROUND.head], GROUND.sub, GROUND.plate,
    /* and the atlas, whose every line is a film surface too - it is the
       artifact a phone, a crawler and a browser without WebGL actually get */
    ATLAS.lede, ATLAS.close, ATLAS.shots.map(function (sh) { return sh.cap; })
  ).join(" ");
  check("The film shows no temperature in degrees.",
    "NGRIP is a proxy. No film surface and no copy table carries a degree sign - " +
    "checked over the canvas labels too, which never touch the DOM",
    surfaces.indexOf("°C") < 0);

  check("The contested arrival is on the ruler, not in the world.",
    "the ember rides the genetic window; the 65 ka reading is drawn on the time rail, " +
    "so no ground or annotation claim moves the camera backwards",
    ev["sahul-arrival"] && ev["sahul-arrival"].dateRange[0] === 50000 &&
    ev["sahul-arrival"].confidence === "contested");

  /* ---------------- beat 07 ---------------- */
  check("By the end of this beat, Neanderthals are gone. We do not know exactly why.",
    "the film does not turn uncertain disappearance into a clean extinction mechanism; the " +
    "record preserves the dated range and the contested causes",
    /CAUSE CONTESTED &middot; NOT DEPICTED/.test(RECORDS[6].html) &&
    voiceForBeat(7).some(function (v) { return /do not know exactly why/.test(v.lines.join(" ")); }));

  check("The last securely dated occupation is forty-one to thirty-nine thousand " +
        "years ago, and it was staggered, not simultaneous.",
    "matches the event's own range and its dateNote, which says LAST SECURELY DATED " +
    "OCCUPATION and not 'they died out' - the film does not assert an extinction date",
    ev["neanderthal-extinction"] && ev["neanderthal-extinction"].dateRange[0] === 41000 &&
    ev["neanderthal-extinction"].dateRange[1] === 39000 &&
    /[Ll]ast securely dated/.test(ev["neanderthal-extinction"].dateNote));

  check("Why they ended is still argued. The film does not draw a reason.",
    "competition, climate and absorption are all live, so no cause is depicted - " +
    "and in particular the pale light is NOT drawn merging into the ember, which " +
    "would have picked absorption out of three contested options and looked lovely",
    /CAUSE CONTESTED &middot; NOT DEPICTED/.test(RECORDS[6].html));

  check("THE OTHERS · EXTENT INDICATIVE · NOT A SOURCED RANGE MAP",
    "the range's own note in timeline.json says exactly this, and its confidence is " +
    "'band', whose grammar forbids a boundary line - so the field is drawn diffuse",
    D.ranges.length === 1 && D.ranges[0].confidence === "band" &&
    /NOT A SOURCED RANGE MAP/.test(D.ranges[0].note));

  check("The patches go out unevenly and carry no dates.",
    "Higham 2014 finds the disappearance was staggered, so the order is fixed noise " +
    "in the data file and no patch is placed at a dated last refuge - there is no " +
    "sourced last refuge and drawing one would invent the beat's most memorable fact",
    D.measured.pale.points.length > 100 &&
    /not a date/i.test(D.measured.pale.goesOutAt) &&
    /must NOT contract it toward a single last refuge/.test(D.ranges[0].retreatNote));

  check("CAMPANIAN IGNIMBRITE · 39,850 ± 140 BP · A CLOCK, NOT A CAUSE",
    "the event is solid at a single year and giaccio2017 gives +/-0.14 ka at 95%; the " +
    "line refuses the causal reading the event's own why says was demoted",
    ev["campanian-ignimbrite"] && ev["campanian-ignimbrite"].dateRange[0] === 39850 &&
    ev["campanian-ignimbrite"].confidence === "solid" &&
    /39\.85 ± 0\.14 ka/.test((D.sources.giaccio2017 || {}).note || ""));

  check("It is on screen because it is how we know when here is.",
    "Law 06 was widened rather than cutting the eruption, and the widening is only " +
    "honest if it is enforced: law06() proves the eruption perturbs no world channel",
    /DRAWN ON THE TIME RAIL, NOT ON THE MAP/.test(RECORDS[5].html) && law06());

  check("DENISOVA 11 · SHE PREDATES THIS BEAT BY FIFTY THOUSAND YEARS",
    "Law 04: the ground register is present tense, so a 90 ka fossil may be exhibited " +
    "in a 43-39 ka beat - and the frame says so out loud rather than hoping nobody adds up",
    ev["denisova-11"] && ev["denisova-11"].dateRange[0] === 90000 &&
    /predates this beat/.test(ev["denisova-11"].dateNote));

  check("A first-generation child of two different kinds of human, surviving as one bone.",
    "phrased from the event's own why. An earlier draft said 'the only one anyone has " +
    "ever found', which is a uniqueness claim the event does not make",
    ev["denisova-11"] && /first-generation child of two different kinds of human/
      .test(ev["denisova-11"].why));

  check("When the pale light goes out, that colour leaves the film.",
    "absence() walks t from the extinction to 1.0 - seven beats that do not exist - " +
    "and proves the colour is null at every one, and returns at the same t backwards",
    absence());

  /* ---------------- the atlas, beat 06 ----------------
     The atlas is the artifact a phone, a crawler, a screen reader and a browser
     with WebGL switched off actually receive, so its sentences are on screen in
     the strongest sense the project has - for most readers they are the ONLY
     sentences. They get the same treatment as the film's, against the same
     events, in the same run. */
  var A = ATLAS, cap = {};
  A.shots.forEach(function (sh) { cap[sh.id] = sh.cap; });

  check("The water east of Asia never became a bridge. The people who reached Sahul crossed open sea.",
    "the arrival is contested and the atlas opens by saying so: sahul-arrival is " +
    "50,000-43,000, marked contested, and ITS OWN dispute names 65,000-59,000 as the " +
    "alternative - which is where 'the rocks argue for older' comes from. (The first " +
    "version of this check read madjedbebe's dispute instead, and that one carries the " +
    "YOUNGER reading, 50,000-47,000, because it is the objection TO the rocks. The " +
    "check failed, and the check was the thing that was wrong.) The crossing itself has " +
    "NO date, and the sentence gives it none",
    ev["sahul-arrival"] && ev["sahul-arrival"].confidence === "contested" &&
    ev["sahul-arrival"].dateRange[0] === 50000 && ev["sahul-arrival"].dateRange[1] === 43000 &&
    ev["sahul-arrival"].dispute.alternative[0] === 65000 &&
    ev.madjedbebe && ev.madjedbebe.dateRange[0] > ev["sahul-arrival"].dateRange[0] &&
    ev["wallacea-crossing"] && ev["wallacea-crossing"].dateRange === null &&
    ev["wallacea-crossing"].sourceIds.indexOf("bird2018") >= 0 &&
    ev["wallacea-crossing"].sourceIds.indexOf("kealy2017") >= 0 &&
    /reached Sahul crossed open sea/.test(A.lede.join(" ")) &&
    !/could not see/i.test(A.lede.join(" ")));

  check("Eight still frames, baked from the same shader at the same eight values of " +
        "the film's single time variable.",
    "there are eight shots, they are in order, and every one lies inside beat 06's own " +
    "t interval - CLOSED at both ends, which matters. The first shot sits exactly on " +
    "t 0.3000, the boundary the two beats share, and beatAt() resolves a shared endpoint " +
    "downward, so it answers 'beat 05' there. That is the beat table's convention and " +
    "not a fact about the frame: t 0.3000 is beat 06's t0, its opening year of 50,000 BP " +
    "and its own opening camera keyframe. The caption says so out loud - it opens 'as " +
    "beat 05 lets go' - so the interval is the honest test and beatAt is not",
    (function () {
      var b6 = D.beats.filter(function (b) { return b.id === 6; })[0];
      return A.shots.length === 8 &&
        A.shots.every(function (sh) { return sh.t >= b6.t0 && sh.t <= b6.t1; }) &&
        A.shots.every(function (sh, i) { return i === 0 || sh.t > A.shots[i - 1].t; });
    })());

  /* THE LOAD-BEARING ONE. If a word on the atlas is pixels, the atlas has
     failed at the only job that distinguishes it from a screenshot: it is the
     crawler content and the screen-reader fallback. So the check is not "the
     page looks like it has text" - it is that no canvas text site can write
     text at all any more. All three hand their strings to the annotation sink,
     which either draws or records. A fillText put back into any of them fails
     this line on the day it is typed. */
  check("Every word on this page is text, not pixels.",
    "none of the three canvas text sites - drawLabels, drawGap, drawCut - can write a " +
    "glyph directly; they all go through the annotation sink, which is the only " +
    "function left that touches the canvas text API. Checked on the functions " +
    "themselves, not on their output",
    [drawLabels, drawGap, drawCut].every(function (f) {
      return String(f).indexOf("fillText") < 0;
    }) && String(gtext).indexOf("fillText") > 0);

  check("The mobile experience, the reduced-motion fallback, the no-JavaScript " +
        "fallback, the crawler content, and the answer for a browser with WebGL off.",
    "every one of those paths has to actually arrive here, so the claim is five links and " +
    "not a promise: the desktop gate (which is also the reduced-motion gate), the no-script " +
    "block, the WebGL failure page, the page a failed RASTER leaves behind - which was a dead " +
    "end with no door in it until 2026-09-08 - and a link in the film's own chrome, because a " +
    "reader who can see the film perfectly well and cannot use it had no way out either. The " +
    "crawler needs no link, it is already reading the atlas.\n   Scoped to a DIRECT CHILD OF " +
    "BODY, and that " +
    "is not fussiness. The first version took the document's FIRST no-script element and passed " +
    "exactly once, then failed forever: the panel used to render these explanations as HTML, " +
    "this sentence named the tag, and so each run CREATED one inside the panel for the next run " +
    "to find. That is the degree-sign bug again, one build after it was written into the laws. " +
    "Both halves are fixed - this selector cannot leave the film's own chrome, and the panel no " +
    "longer lets a check's own prose build elements",
    /atlas\.html/.test(($("gate") || {}).innerHTML || "") &&
    /atlas\.html/.test((document.querySelector("body > noscript") || {}).textContent || "") &&
    String(glFailure).indexOf("atlas.html") > 0 &&
    String(assetFailure).indexOf("atlas.html") > 0 &&
    !!document.querySelector("#chrome-atlas") && !!document.querySelector("#skip-atlas"));

  check(cap["01"],
    "at t 0.3000 the sea is -68.3 m, which rounds to the sixty-eight the line says; and " +
    "at that sea level Borneo, Java and Sumatra share one land component with mainland " +
    "Asia on the raster",
    Math.round(stateFor(0.3000).sea) === -68 &&
    tc.some(function (r) {
      return Math.abs(r.seaM + 68.3) < 0.05 && r.sunda.length === 4 &&
             r.sunda.indexOf("mainland Asia") >= 0 && r.sunda.indexOf("Borneo") >= 0;
    }));

  /* THE FIRST CHECK IN THIS FILE THAT TESTS A REFERENT RATHER THAN A VALUE, and
     it exists because the version it replaces passed while the sentence it
     guarded was wrong twice over.

     That version asserted 23.75, 30.88 and the ratio between them. Every one of
     those was true. What was false was what they were ABOUT: the number is
     measured over the connectivity box, 90-160E 50S-30N, and the film labelled
     it with the render tile's bounds, 92-156E; and the atlas caption said the
     pair described growth "across the beat" when 23.75 is TODAY - the beat
     opens at 30.44 and closes at 30.88, a change of one and a half per cent,
     not thirty.

     A check that compares the film's numbers to the film's numbers cannot see
     either error. So this one asks, for each figure, what it is a figure OF:
     which box, and which baseline. The box now travels in the data, the label
     is generated from it, and the caption is pinned to the constant - so moving
     the box breaks the prose instead of silently relabelling it. */
  check(cap["02"],
    "every figure here is checked against its REFERENT, not its value. The box: landBox " +
    "travels with the measurement now, the on-screen label is generated from it, and the " +
    "caption's words are pinned to the same constant. The baselines: 23.75% is sea level " +
    "0 - TODAY - while the beat runs 30.44% to 30.88%, so the thirty per cent is a gain " +
    "on the present and the beat's own change is 1.4%. The caption says both, and says " +
    "which is which",
    (function () {
      var lb = D.measured.landBox;
      if (!lb) return false;
      var now = tc.filter(function (r) { return r.seaM === 0; })[0];
      var open = tc.filter(function (r) { return Math.abs(r.seaM + 68.3) < 0.05; })[0];
      var shut = tc.filter(function (r) { return Math.abs(r.seaM + 73.9) < 0.05; })[0];
      if (!now || !open || !shut) return false;

      /* the box is the CONNECTIVITY box, and it is not the render tile */
      var tile = D.measured.tiles.sunda;
      var boxIsConnectivity = lb.lon0 === 90 && lb.lon1 === 160 &&
                              lb.lat0 === -50 && lb.lat1 === 30;
      var boxIsNotTile = !tile || lb.lon0 !== tile.lon0 || lb.lon1 !== tile.lon1;

      /* the label the reader sees is BUILT from that box */
      var onScreen = stateLine(stateFor(0.3350)).join(" ");
      var labelled = onScreen.indexOf(boxLabel(lb)) >= 0;

      /* and the caption names the same box, in words tied to the same numbers */
      var capNamesBox = /ninety to a hundred and sixty degrees east/.test(cap["02"]) &&
                        /fifty south to thirty north/.test(cap["02"]);

      /* the baselines, each said out loud and each matched to its row */
      var today = now.landFracBox === 23.75 &&
                  /against 23\.75 per cent today/.test(cap["02"]);
      var close = shut.landFracBox === 30.88 &&
                  /30\.88 per cent of it stands dry at the end of this beat/.test(cap["02"]);
      var gainOnToday = Math.round((shut.landFracBox / now.landFracBox - 1) * 100) === 30 &&
                        /thirty per cent on the present/.test(cap["02"]);
      var acrossBeat = open.landFracBox === 30.44 &&
                       /Across the beat itself the change is small/.test(cap["02"]) &&
                       /30\.44 to 30\.88 per cent/.test(cap["02"]) &&
                       Math.round((shut.landFracBox / open.landFracBox - 1) * 1000) === 14;

      return boxIsConnectivity && boxIsNotTile && labelled && capNamesBox &&
             today && close && gainOnToday && acrossBeat;
    })());

  check(cap["03"],
    "Law 02, checked on the page rather than asserted: neither people-colour appears in " +
    "any type surface of either artifact - not in the film's copy, not in its labels, " +
    "not in the atlas's captions. It does not check the shader, which is where the " +
    "light itself is drawn",
    surfaces.indexOf(EMBER) < 0 && surfaces.indexOf(PALE_RGB) < 0);

  /* THE PROJECT'S SIGNATURE FAILURE, written into the caption on purpose. The
     atlas has room the film does not, so it spends it saying which quantity the
     number is - and the check reads the measurement's own definition string
     rather than a paraphrase of it. */
  check(cap["04"],
    "the measurement's own definition is 'the smallest achievable longest single hop' " +
    "over all island-hopping routes; the caption denies the reading it is most likely " +
    "to get - narrowest crossing - and quotes 70.4 km at the -131 m lowstand as a " +
    "FLOOR, which a stricter island threshold can only raise.\n   The fifty-seven metres " +
    "is checked as a FURTHER fall from this shot's own sea level, not as the total from " +
    "the present. It read 'a hundred and thirty-one metres from here' - which is the " +
    "depth of the lowstand below TODAY, and the frame is already 74 m down. Right number, " +
    "wrong origin, and the old check never looked at it",
    (function () {
      var low = Math.min.apply(null, D.measured.wallacea.rows.map(function (r) {
        return r.seaM; }));
      var shot = A.shots.filter(function (sh) { return sh.id === "04"; })[0];
      var here = stateFor(shot.t).sea;
      var further = Math.abs(low) - Math.abs(here);
      return /smallest achievable longest single hop/.test(D.measured.wallacea.definition) &&
        w.filter(function (r) { return r.seaM === -131.0; })[0].bottleneckKm === 70.4 &&
        w.filter(function (r) { return Math.abs(r.seaM + 73.9) < 0.05; })[0].bottleneckKm === 70.5 &&
        D.measured.wallacea.rows.every(function (r) { return r.bottleneckKm >= 70.4; }) &&
        Math.round(further) === 57 &&
        /another fifty&#8209;seven metres to fall/.test(cap["04"]) &&
        !/hundred and thirty&#8209;one metres from here/.test(cap["04"]);
    })());

  check(cap["05"],
    "both ranges are quoted exactly as their events carry them, both events are marked " +
    "contested, and the film's own record voice says the reading is drawn on the time " +
    "rail and not on the map - so the atlas repeats the film rather than deciding",
    ev.madjedbebe.dateRange[0] === 65000 && ev.madjedbebe.dateRange[1] === 59000 &&
    ev.madjedbebe.confidence === "contested" &&
    ev["sahul-arrival"].dateRange[0] === 50000 && ev["sahul-arrival"].dateRange[1] === 43000 &&
    ev["sahul-arrival"].confidence === "contested" &&
    /DRAWN ON THE TIME RAIL, NOT ON THE MAP/.test(RECORDS[2].html));

  check(cap["06"],
    "three land masses in one component at the beat's sea level, on the raster; and the " +
    "Madjedbebe marker is drawn at the site's own coordinates while its contested years " +
    "stay on the linear rail - which is the film's decision, repeated here rather than " +
    "reopened. The caption names no site the frame does not hold: an earlier draft put " +
    "Liang Metanduno in this caption, and at this t Metanduno projects off the bottom of " +
    "the frame",
    tc.some(function (r) {
      return Math.abs(r.seaM + 73.9) < 0.05 && r.sahul.length === 3 &&
             r.sahul.indexOf("Tasmania") >= 0 && r.sahul.indexOf("New Guinea") >= 0;
    }) &&
    ev.madjedbebe.confidence === "contested" &&
    LABELS.some(function (L) {
      return L.k === "MADJEDBEBE" && L.ring === 2 &&
             Math.abs(L.lon - ev.madjedbebe.coordinates[0]) < 0.01 &&
             Math.abs(L.lat - ev.madjedbebe.coordinates[1]) < 0.01;
    }) &&
    /DRAWN ON THE TIME RAIL, NOT ON THE MAP/.test(RECORDS[2].html));

  check(cap["07"],
    "Law 04 at the frame that tests it: t 0.3610 is inside the match cut, with both " +
    "registers on screen at once - and the year is still non-increasing across the " +
    "whole cut, which is the property a ground register could have broken",
    cutAt(0.3610) > 0 && cutAt(0.3610) < 1 &&
    (function () {
      var prev = 1e9, good = true;
      for (var i = 0; i <= 400; i++) {
        var y = stateFor(CUT_IN[0] + (CUT_OUT[1] - CUT_IN[0]) * (i / 400)).yr;
        if (y > prev + 1e-9) good = false;
        prev = y;
      }
      return good;
    })());

  check(cap["08"],
    "the hand in this frame is Metanduno's, so this is where the atlas says so: a " +
    "MINIMUM age, hence 'at least'; the maker attributed the way the authors attribute " +
    "them, which an earlier draft of the film inverted; and the worked fingertips, which " +
    "is the event's own documented detail and the reason the match cut lands here. Leang " +
    "Karampuang is likewise a minimum, and the two claims the frame itself makes - that " +
    "the stencil is a diagram and not a photograph, and that a plate is reserved rather " +
    "than missing - are read off the ground register's own table",
    ev["liang-metanduno"].dateRange[0] === 67800 &&
    /oldest securely dated rock art anywhere/i.test(ev["liang-metanduno"].dateNote) &&
    /fingertips deliberately reshaped to points/.test(ev["liang-metanduno"].dateNote) &&
    /Homo sapiens/.test(ev["liang-metanduno"].authorship.attribution) &&
    /per the authors/.test(ev["liang-metanduno"].authorship.attribution) &&
    ev["leang-karampuang"].dateRange[0] === 51200 &&
    ev["leang-karampuang"].confidence === "solid" &&
    /[Oo]ldest known narrative/.test(ev["leang-karampuang"].dateNote) &&
    GROUND.sub.indexOf("ORIGINAL DIAGRAM, NOT A PHOTOGRAPH OF THE SITE") >= 0 &&
    GROUND.plate.some(function (L) { return /PERMISSION PENDING/.test(L); }));

  /* The footer is the part of the atlas that is about the atlas, and it makes
     two claims about beats this artifact does not contain. Both are already
     proved by tests in this file, so the check calls them rather than
     restating them in weaker words. */
  check(A.close[1],
    "beat 05's lock runs t 0.2300-0.2900, which is 0.060 of a 0.240 artifact - a " +
    "quarter, exactly - and hold() proves it is the only one; absence() proves the pale " +
    "colour is null from the extinction out to t 1.0. The footer claims nothing about " +
    "those two beats that the panel cannot already demonstrate",
    Math.abs((0.2900 - 0.2300) / (D.tSpan[1] - D.tSpan[0]) - 0.25) < 1e-9 &&
    hold() && absence());

  check(A.close[2],
    "every event the atlas names resolves in the record, and every source those events " +
    "cite resolves in the bibliography - so 'nothing on screen that is not in " +
    "timeline.json' is a lookup rather than a slogan",
    A.shots.every(function (sh) {
      return sh.ev.every(function (id) {
        return ev[id] && ev[id].sourceIds.length > 0 &&
               ev[id].sourceIds.every(function (sid) { return !!D.sources[sid]; });
      });
    }));

  var bad = T.filter(function (r) { return !r.ok; });
  /* ANGLE BRACKETS OUT, ENTITIES LEFT IN. The panel writes this with innerHTML,
     so a check whose explanation mentions a tag BUILDS that tag inside the
     panel - and the next run of any check that looks for one finds the panel's
     instead of the film's. That is exactly how the fallback-links check came to
     pass once and fail on every run after. Ampersands are deliberately left
     alone: the lines under test are the film's own copy and carry real
     entities, and rendering "&mdash;" as four visible characters would stop the
     check's output looking like the sentence it is checking. */
  function noTags(x) {
    return String(x).replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  $("o-copy").innerHTML =
    (bad.length === 0
      ? '<span class="ok">PASS &mdash; ' + T.length + " lines.</span>\n"
      : '<span class="bad">FAIL &mdash; ' + bad.length + " of " + T.length + ".</span>\n") +
    T.map(function (r) {
      return (r.ok ? "· " : "✗ ") + noTags(r.line) + "\n   " + noTags(r.why);
    }).join("\n");
}

function measured() {
  var w = D.measured.wallacea.rows.filter(function (r) { return r.minIslandPx === 10; });
  var lo = Math.min.apply(null, w.map(function (r) { return r.bottleneckKm; }));
  var tc = D.measured.tileChecks;
  var now = tc.filter(function (r) { return r.seaM === 0; })[0];
  var beat = tc.reduce(function (a, r) { return Math.abs(r.seaM + 73.9) < Math.abs(a.seaM + 73.9) ? r : a; });
  var open = tc.reduce(function (a, r) { return Math.abs(r.seaM + 68.3) < Math.abs(a.seaM + 68.3) ? r : a; });
  var dr = D.measured.doors.rows;
  function d10(id) {
    return dr.filter(function (r) { return r.doorId === id && r.minIslandPx === 10; });
  }
  function spread(id, sea) {
    return dr.filter(function (r) { return r.doorId === id && Math.abs(r.seaM - sea) < 0.05; })
             .map(function (r) { return r.bottleneckKm.toFixed(1); }).join(" / ");
  }
  $("o-meas").textContent =
    "ETOPO 2022 bedrock, 60″, 1.85 km per pixel.\n\n" +
    "BEAT 05 - the two doors out of Africa. Same\ndefinition as Wallacea below, one corridor at a\n" +
    "time, because Africa and Eurasia are always one\nland component by way of Sinai and a global\n" +
    "bottleneck would read 0 km and mean nothing.\n" +
    "  Sinai          dry land at all 7 sea levels\n" +
    d10("bab-el-mandeb").map(function (r) {
      return "  Bab-el-Mandeb  " + String(r.seaM).padStart(7) + " m   " +
             r.bottleneckKm.toFixed(1) + " km"; }).join("\n") +
    "\n  never dry, lowstand included.\n\n" +
    "  At 60 ka (-84.7 m) the number depends on how\n  small an island counts, and the film says so:\n" +
    "    " + spread("bab-el-mandeb", -84.7) + " km  for floors 3.4 / 34 / 344 km²\n" +
    "  which is why the line reads 'under ten, as\n  little as five' and not a single figure.\n\n" +
    "  Persian Gulf basin, 48-57E 24-30.5N, standing\n  dry: " +
    D.measured.doors.gulf.rows.filter(function (r) {
      return r.seaM === 0 || Math.abs(r.seaM + 84.7) < 0.05;
    }).map(function (r) { return r.dryFracBox.toFixed(1) + "% at " + r.seaM + " m"; }).join(",  ") +
    ".\n\n" +
    "BEAT 06 - Wallacea bottleneck, the widest hop any\nisland-hopping route must include:\n" +
    w.map(function (r) { return "  " + String(r.seaM).padStart(7) + " m   " + r.bottleneckKm.toFixed(1) + " km"; }).join("\n") +
    "\n  floor " + lo.toFixed(1) + " km. The sea falls 131 m and\n  the gap does not close.\n\n" +
    "Dry land in the CONNECTIVITY box, " + boxLabel(D.measured.landBox).replace(/&deg;/g, "\u00b0")
      .replace(/&ndash;/g, "-") + "\n  - which is not the render tile, and is wider:\n" +
    "  today " + now.landFracBox.toFixed(2) + "%   at " + beat.seaM +
    " m " + beat.landFracBox.toFixed(2) + "%\n  a gain of " +
    ((beat.landFracBox / now.landFracBox - 1) * 100).toFixed(0) + "% on today, and " +
    ((beat.landFracBox / open.landFracBox - 1) * 100).toFixed(1) +
    "% across the beat\n  itself - the shelf was already out when it opened.";
}

/* ═══ 13 · THE LOOP ══════════════════════════════════════════════════════ */

var target = 0, cur = 0, lastFit = "", DEBUG = 0;

/* The plate is a still, and a still that takes a second to compute must not be
   computed the first time the reader scrolls into the cut. It is built at load
   and again on resize, which is the only moment a hitch is acceptable. */
function makePlate() {
  var island = fitHand(frame(camAt(CUT_IN[0])));
  plateFit = island ? { island: island, settle: settleFit() } : null;
  plate = plateFit ? buildPlate(plateFit.settle) : null;
  lastFit = W + "x" + H;
}

function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  earth.width = Math.round(W * DPR); earth.height = Math.round(H * DPR);
  over.width = Math.round(W * DPR); over.height = Math.round(H * DPR);
  octx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (gl) gl.viewport(0, 0, earth.width, earth.height);
  plate = null; plateFit = null; lastFit = "";
}

function maxScroll() {
  return Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
}

function tFor(s) { return D.tSpan[0] + (D.tSpan[1] - D.tSpan[0]) * clamp(s, 0, 1); }

/* Frame time, measured on the machine that is actually drawing it.
   Every attempt to time this film from a headless or hidden browser gave
   nonsense - rAF throttled, performance.now() quantised, two hundred
   full-screen draws timing as under a tenth of a millisecond. The only
   trustworthy measurement is one taken on a real screen by someone watching
   it, so the film takes its own and puts the number where they can read it.
   The worst frame matters more than the mean: one 40 ms hitch is felt, a
   slightly low average is not. */
var FT = new Float32Array(120), ftAt = 0, ftPrev = 0, ftN = 0;
/* FT deliberately stays a short, readable rolling window. This second value
   is the counterpart for reload diagnostics: a one-time tile decode must not
   disappear from the evidence two seconds after it happens. */
var FT_RELOAD_WORST = 0;
var OV = new Float32Array(120), ovAt = 0, ovN = 0;

function stats(buf, n) {
  n = Math.min(n, buf.length);
  if (n < 8) return null;
  var a = Array.prototype.slice.call(buf.subarray(0, n)).sort(function (x, y) { return x - y; });
  return { med: a[n >> 1], p95: a[Math.min(n - 1, Math.floor(n * 0.95))], max: a[n - 1] };
}
function frameStats() { return stats(FT, ftN); }
function overlayStats() { return stats(OV, ovN); }

/* ONE FRAME, drawn from a state. Split out of loop() so that a frame can be
   drawn WITHOUT requestAnimationFrame - see renderAt().

   opts.overlay  draw the canvas overlay (lights, labels, the cut). default on.
   opts.dom      update the copy, the ruler and the panel. default on.
   opts.measure  record the overlay time into the panel's buffer. default on;
                 off for renderAt, because a synchronous bake is not a frame the
                 reader ever sat through and it must not pollute the readout. */
function drawFrame(s, opts) {
  var overlay = !opts || opts.overlay !== false;
  var dom = !opts || opts.dom !== false;
  var measure = !opts || opts.measure !== false;
  var F = frame(s);

  drawEarth(s, F);

  /* Overlay time, measured separately from the earth pass - because everything
     Phase 5 added is overlay work and the GPU timer would not have seen a byte
     of it. The shader is unchanged and still does two elevation fetches, so the
     earth pass costs the same NUMBER OF FETCHES it did in Phase 4 - though not
     the same milliseconds, because a frame where the globe fills the screen
     shades far more pixels than one that is half empty space. Beat 05's locked
     wide shot is the expensive one. What is new is up to 210 pale patches and
     92 plume particles composited in 2D, and a panel that only reported the GPU
     would have said, honestly and uselessly, that nothing got more expensive. */
  var ov0 = performance.now();
  if (overlay) {
  octx.clearRect(0, 0, W, H);

  if (s.cut < 1) {
    octx.globalAlpha = 1 - s.cut;
    /* The pale light goes UNDER the ember, always. Two populations share the
       map for two beats and the film's subject is only ever one of them, so
       when they overlap the ember is the one that reads. */
    drawPale(s, F);
    drawPlume(s, F);
    drawRoute(s, F, ROUTES["to-sahul"], s.head, EMBER, "255,206,170");
    drawRoute(s, F, ROUTES["to-europe"], s.head7, EMBER, "255,206,170");
    drawLabels(s, F);
    drawGap(s, F);
    octx.globalAlpha = 1;
  }
  if (s.cut > 0) {
    /* the fit is computed from the settled camera and cached; the plate is a
       still, so it is rendered once per viewport, never per frame */
    if (lastFit !== W + "x" + H) makePlate();
    drawCut(s, F);
  }
  }

  if (measure) { OV[ovAt] = performance.now() - ov0; ovAt = (ovAt + 1) % OV.length; ovN++; }

  if (dom) {
    drawCopy(s);
    drawRuler(s);
    if ($("panel").classList.contains("on")) panel(s);
  }
  return s;
}

var running = false, EXTERNAL_T = null;

function loop(now) {
  /* STOPPED, NOT THROTTLED. The gate can go up while the film is running -
     reduced motion switched on, the window dragged to phone width - and the
     right response to "stop moving" is to stop, not to keep drawing behind a
     panel that says the film has stopped. applyGate() starts it again. */
  if (GATED) { running = false; ftPrev = 0; return; }
  if (ftPrev) {
    var interval = now - ftPrev;
    FT[ftAt] = interval; ftAt = (ftAt + 1) % FT.length; ftN++;
    FT_RELOAD_WORST = Math.max(FT_RELOAD_WORST, interval);
  }
  ftPrev = now;

  if (EXTERNAL_T !== null) target = EXTERNAL_T;
  cur += (target - cur) * 0.08;
  drawFrame(stateFor(tFor(cur)));
  requestAnimationFrame(loop);
}

/* The gate, re-asked. Everything the film needs is already built, so coming
   back out of it is free: the loop picks up at the t the reader is at. */
function applyGate() {
  var want = gateWanted();
  if (want === GATED) return;
  GATED = want;
  $("gate").classList.toggle("on", want);
  /* The gate is a full-screen answer, so the film behind it leaves the reading
     order with it. Otherwise a reader who has just been told the film has
     stopped can tab straight into its chrome and read a beat that is no longer
     running - the same defect as a faded paragraph that is still in the
     accessibility tree, one layer out. */
  ["head", "copy", "state", "ruler", "hint"].forEach(function (id) {
    var e = $(id); if (!e) return;
    e.inert = want;
    if (want) e.setAttribute("aria-hidden", "true");
    else e.removeAttribute("aria-hidden");
  });
  if (!want && !running) { running = true; requestAnimationFrame(loop); }
}

/* DRAW ONE FRAME AT ONE t, SYNCHRONOUSLY, AND RETURN ITS STATE.

   Every automated browser throttles requestAnimationFrame - the in-app pane
   ran ZERO ticks in 600 ms, Playwright one tick in 800 ms - so verifying this
   film outside a human's screen meant waiting on a loop that was not running
   and then hoping the frame on screen was the one asked for. This makes it
   deterministic: call it, and the frame for that t is on the canvas when it
   returns.

   It sets target and cur together, so a live loop (if one is ticking) has zero
   damping left to apply and will redraw exactly this frame rather than sliding
   off it. It does NOT scroll: scrolling fires the listener, which would set
   target back from scrollY and fight this.

   Three things it is for:
     - shot-checking, without a screenshot per guess
     - baking the atlas's stills from the same shader at the same t, which is
       the only way the two artifacts cannot disagree
     - timing the draw path itself, which vsync makes impossible from a frame
       interval: call it N times and divide.                                  */
function renderAt(t, opts) {
  var f = clamp((t - D.tSpan[0]) / (D.tSpan[1] - D.tSpan[0]), 0, 1);
  target = cur = f;
  return drawFrame(stateFor(tFor(f)), opts || { measure: false });
}

/* ONE BAKED STILL FOR THE ATLAS: the world drawn, and every word it would have
   drawn caught instead of written.

   The split is the atlas's whole design. The world is pixels because it is a
   shader and there is no other honest way to reproduce it; the words are HTML
   because the atlas IS the crawler content, the screen-reader fallback and the
   answer for a browser with WebGL switched off, and baked type would be exactly
   the wrong thing in exactly that artifact. It would also be invisible to the
   Law 07 copy check, which reads the film's surfaces and its copy tables.

   So this returns two things that must travel together: a PNG of the world at t,
   and the geometry of every label, leader, dimension and ground line the frame
   would have lettered - in CSS pixels, against the w/h it was baked at, so the
   generator can place real text on the end of a leader that is already drawn.

   It carries the state HASH as well. That is the guarantee the two artifacts
   cannot drift: a still in slice/atlas/ is stamped with the hash of the state
   that produced it, and stateFor is pure, so the claim "this is the film's
   frame at t" is checkable rather than asserted.

   dom:false because the film's copy column, ruler and head block are DOM, and
   the atlas writes its own from the tables directly - a bake must not leave the
   live page showing beat 06's fourth frame.                                  */
function bakeAt(t, opts) {
  var png = opts && opts.png;
  var prev = BAKE, out;
  BAKE = { text: [], labels: [], gap: null, reserved: null };
  var s;
  try { s = renderAt(t, { dom: false, measure: false }); }
  finally { out = BAKE; BAKE = prev; }

  var iv = activeVoice(s.t), ir = activeRecord(s.t);
  var m = {
    t: +s.t.toFixed(4), yr: Math.round(s.yr), sea: +s.sea.toFixed(2),
    beat: s.beat, cut: +s.cut.toFixed(4), register: registerAt(s.t),
    lon: +s.lon.toFixed(3), lat: +s.lat.toFixed(3), alt: +s.alt.toFixed(4),
    pitch: +s.pitch.toFixed(2), bearing: +s.bearing.toFixed(2),
    tile: s.tile, hash: hashState(s),
    w: W, h: H, dpr: DPR,
    voice: iv < 0 ? null : { i: iv, lines: VOICES[iv].lines,
                             a: +labelAlpha(s.t, VOICES[iv].t).toFixed(3) },
    record: ir < 0 ? null : { i: ir, html: RECORDS[ir].html,
                              a: +labelAlpha(s.t, RECORDS[ir].t).toFixed(3) },
    state: stateLine(s),
    text: out.text, labels: out.labels, gap: out.gap, reserved: out.reserved
  };
  if (png) {
    /* Composited in the SAME task as the draw, so the WebGL back buffer is
       still intact whether or not preserveDrawingBuffer was granted. */
    var c = document.createElement("canvas");
    c.width = earth.width; c.height = earth.height;
    var x = c.getContext("2d");
    x.drawImage(earth, 0, 0);
    x.drawImage(over, 0, 0);
    m.png = c.toDataURL("image/png");
  }
  return m;
}

function panel(s) {
  $("p-t").textContent = s.t.toFixed(5);
  $("p-damp").textContent = target.toFixed(3) + " / " + cur.toFixed(3);
  $("p-yr").textContent = fmt(Math.round(s.yr));
  $("p-sea").textContent = s.sea.toFixed(2) + " m";
  $("p-temp").textContent = s.temp === null ? "no record" : s.temp.toFixed(2) + " ‰";
  $("p-reg").textContent = registerAt(s.t) + (s.cut > 0 && s.cut < 1 ? " " + (s.cut * 100).toFixed(0) + "%" : "");
  $("p-cam").textContent = s.lon.toFixed(1) + ", " + s.lat.toFixed(1);
  $("p-alt").textContent = (s.alt * 6371).toFixed(0) + " km · " + s.pitch.toFixed(0) + "°";
  $("p-head").textContent = (s.head * 100).toFixed(1) + "%";
  $("p-plume").textContent = (s.plume * 100).toFixed(1) + "%  ·  " +
    (s.head7 * 100).toFixed(1) + "% into Europe";
  var pale = 0;
  if (s.paleRGB !== null) {
    D.measured.pale.points.forEach(function (p) {
      if ((p[2] - s.paleOut + PALE_K) / PALE_K > 0.02) pale++;
    });
  }
  $("p-pale").innerHTML = s.paleRGB === null
    ? '<span style="color:#647C99">not in the palette</span>'
    : pale + " of " + D.measured.pale.points.length + " lit  ·  rgb(" + s.paleRGB + ")";
  $("p-tile").textContent = s.tile +
    (TXO[s.tile] ? "" : "  ·  in flight, drawing from the globe");

  var f = frameStats();
  $("p-frame").innerHTML = f
    ? f.med.toFixed(1) + " / " + f.p95.toFixed(1) + " / " + f.max.toFixed(1) + " ms"
    : "&mdash;";
  $("p-frame-reload").textContent = FT_RELOAD_WORST
    ? FT_RELOAD_WORST.toFixed(1) + " ms"
    : "—";
  $("p-fps").textContent = f ? Math.round(1000 / f.med) + " fps" : "—";
  var ov = overlayStats();
  $("p-ovms").textContent = ov
    ? ov.med.toFixed(2) + " / " + ov.p95.toFixed(2) + " ms  ·  " +
      pale + " pale, " + PLUME.length + " plume"
    : "—";
  $("p-gpums").textContent = !TQ.ext ? "not exposed"
    : TQ.ms < 0 ? "measuring…"
    : TQ.ms.toFixed(2) + " ms  ·  " + Math.round(TQ.ms / 16.67 * 100) + "% of a frame";
  var tt = TILE_TIMING;
  function timingText(v) { return typeof v === "number" ? v.toFixed(1) + " ms" : "—"; }
  $("p-defer-tile").textContent = tt.tile ? tt.tile + "  ·  " + tt.state : tt.state;
  $("p-defer-canvas").textContent = timingText(tt.imageDecode) + " / " + timingText(tt.readback);
  $("p-defer-upload").textContent = timingText(tt.terrainDecode) + " / " + timingText(tt.upload);
  $("p-defer-total").textContent = timingText(tt.mipmap) + " / " + timingText(tt.total);
  if (f) {
    var el = $("p-frame");
    el.className = f.p95 < 20 ? "ok" : f.p95 < 34 ? "" : "bad";
  }
}

/* Every test runs without a GPU, so they are bound on both paths - the panel is
   where you go when the film did NOT start, and a test that needs the renderer
   in order to tell you the renderer is broken is no use to anybody. */
function bindTests() {
  [["t-purity", purity], ["t-copy", copyCheck],
   ["t-law06", law06], ["t-indep", independence],
   ["t-absence", absence], ["t-hold", hold],
   ["t-bench", function () { bench(); }]]
    .forEach(function (p) { $(p[0]).addEventListener("click", p[1]); });
}

/* Separately ADDRESSABLE without being separately BUILT: #t=0.2650 lands on a
   frame, #beat=05 lands on the head of a beat. Three beats on one t is a Law 01
   decision, not a packaging one, and it does not have to cost the director the
   ability to jump straight to the shot they are arguing about. */
function tFromHash() {
  var m = /[#&]t=([\d.]+)/.exec(location.hash);
  if (m) return clamp(parseFloat(m[1]), D.tSpan[0], D.tSpan[1]);
  var b = /[#&]beat=0?(\d+)/.exec(location.hash);
  if (b) {
    var hit = D.beats.filter(function (x) { return x.id === parseInt(b[1], 10); })[0];
    if (hit) return clamp(hit.t0, D.tSpan[0], D.tSpan[1]);
  }
  return null;
}

/* When the renderer will not start, say WHY and what to do about it. A dead
   end that reads "this beat needs WebGL2" on a machine whose GPU supports
   WebGL2 perfectly well is worse than no message at all. */
function glFailure() {
  var p2 = probeGL("webgl2"), p1 = probeGL("webgl");
  var soft = /swiftshader|llvmpipe|software|basic render/i;
  var rows = [];
  rows.push(["WebGL2, plain request", p2.ok ? p2.renderer : (p2.err || "refused")]);
  rows.push(["WebGL1, plain request", p1.ok ? p1.renderer : (p1.err || "refused")]);
  GL_TRIED.forEach(function (t, i) { rows.push([i ? "" : "on this canvas", t]); });
  /* which browser this is, because "no WebGL at all" is a property of the
     browser and not of the machine, and the machine is usually fine */
  rows.push(["browser", navigator.userAgent]);
  rows.push(["hardware concurrency", String(navigator.hardwareConcurrency || "?") +
             " cores  ·  " + window.innerWidth + "×" + window.innerHeight +
             " at dpr " + (window.devicePixelRatio || 1)]);

  var advice;
  if (p2.ok) {
    advice = "WebGL2 works on a fresh canvas but not on the film's, which almost " +
      "always means too many live WebGL contexts. Close the other tabs using this " +
      "server and reload.";
  } else if (p1.ok) {
    advice = "This browser has WebGL1 but not WebGL2. The film needs WebGL2 for " +
      "float elevation textures and derivative-based edges. Chrome, Edge, Firefox " +
      "and Safari have all shipped it for years, so this is likely a browser flag " +
      "or an old build rather than the hardware.";
  } else if (soft.test(p2.renderer || "") || soft.test(p1.renderer || "")) {
    advice = "The browser is rendering in software. Turn hardware acceleration back " +
      "on — in Chrome and Edge, Settings → System → “Use graphics " +
      "acceleration when available” — then reload. chrome://gpu will say why it " +
      "was off.";
  } else {
    advice = "<b>No WebGL of any version started</b>, on fresh canvases — so this is " +
      "the browser, not the film and not the graphics card. In order: turn on " +
      "hardware acceleration (Chrome and Edge: Settings → System → “Use graphics " +
      "acceleration when available”), then <b>fully quit and reopen</b> the browser, " +
      "not just the tab. If that fails, open <b>chrome://gpu</b> — the top block names " +
      "every disabled feature and why. If it still fails, try a different browser; " +
      "the same machine has run this film at WebGL2 under Chromium.<br><br>" +
      "And note what this machine <i>should</i> be served: a browser that cannot do " +
      "WebGL gets <b>the static atlas</b>, exactly as a phone or reduced-motion does. " +
      '<a class="go" href="atlas.html">Read beat 06 as the atlas</a>' + " &mdash; the same " +
      "art, baked from this shader, and every word of the same writing as text.";
  }

  $("lmsg").innerHTML = "WebGL2 did not start";
  $("lmsg").style.color = "#E8703A";
  $("ldetail").style.display = "block";
  /* Whatever the diagnosis, there is a page this reader can actually have. A
     good error message is not a fallback; the atlas is, and it belongs above
     the diagnostics rather than underneath them. */
  $("ldetail").innerHTML =
    '<p><a class="go" href="atlas.html">Read beat 06 as the atlas</a></p>' +
    "<p>" + advice + "</p><table>" +
    rows.map(function (r) {
      return "<tr><td>" + r[0] + "</td><td>" + String(r[1]).slice(0, 200) + "</td></tr>";
    }).join("") +
    "</table><p>Press <b>i</b> for the panel — the data, the time curve and both " +
    "tests run without the renderer.</p>";
}

function start() {
  try { initGL(); } catch (e) {
    if (e.gl) glFailure();
    else { $("lmsg").textContent = e.message; $("lmsg").style.color = "#E8703A"; }
    /* the tests do not need a GPU, so expose them anyway */
    window.EMBER = { stateFor: stateFor, camAt: camAt, frame: frame, D: D,
                     purity: purity, copyCheck: copyCheck,
                     law06: law06, absence: absence, hold: hold,
                     independence: independence, readerCopy: readerCopy,
                     ATLAS: ATLAS, VOICES: VOICES, RECORDS: RECORDS,
                     LABELS: LABELS, GROUND: GROUND, stateLine: stateLine };
    initRuler(); measured();
    bindTests();
    return;
  }
  /* Every route densified once, at load. A Catmull-Rom pass over four paths is
     cheap, but it is not free and it must not happen at a beat boundary. */
  D.routes.forEach(function (r) { ROUTES[r.id] = densify(r.path, 26); });
  PLUME = buildPlume();
  /* Both light sprites built here, beside the stencil plate, for the same
     reason the stencil plate is built here. */
  DOT[EMBER] = buildDot(EMBER);
  DOT[PALE_RGB] = buildDot(PALE_RGB);
  initRuler(); measured();
  var dbg = gl.getExtension("WEBGL_debug_renderer_info");
  $("p-gpu").textContent = dbg
    ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
        .replace(/^ANGLE \(/, "")
        .replace(/\s*\(0x[0-9a-f]+\).*$/i, "")
        .replace(/\s*Direct3D.*$/i, "")
        .replace(/[,\s)]+$/, "").slice(0, 52)
    : "hidden";
  resize();
  makePlate();
  window.addEventListener("resize", resize);
  /* Both roads back to the gate. A media query fires on change; a window does
     not, so the size half rides on resize. */
  window.addEventListener("resize", applyGate);
  if (REDUCED.addEventListener) REDUCED.addEventListener("change", applyGate);
  else if (REDUCED.addListener) REDUCED.addListener(applyGate);
  window.addEventListener("scroll", function () {
    if (EXTERNAL_T === null) target = window.scrollY / maxScroll();
  }, { passive: true });
  /* The full film owns its t. This slice can still stand alone, but when it is
     embedded it becomes a quiet visual child: parent copy, ruler and controls
     are the only production chrome the reader sees. */
  window.addEventListener("message", function (event) {
    var msg = event.data;
    if (!msg || msg.type !== "one-ember:external-t") return;
    if (typeof msg.presentation === "boolean") {
      document.documentElement.classList.toggle("presentation", msg.presentation);
    }
    if (typeof msg.t === "number") {
      EXTERNAL_T = clamp((msg.t - D.tSpan[0]) / (D.tSpan[1] - D.tSpan[0]), 0, 1);
      target = cur = EXTERNAL_T;
      renderAt(msg.t, { measure: false });
    }
  });
  bindTests();
  /* Shot-checking: #t=0.3350 jumps to a t, and the whole state function is
     exposed so a shot can be inspected without scrubbing to it by hand. */
  var want = tFromHash();
  if (want !== null) {
    var s01 = (want - D.tSpan[0]) / (D.tSpan[1] - D.tSpan[0]);
    window.scrollTo(0, s01 * maxScroll());
    target = cur = s01;
  } else {
    target = cur = window.scrollY / maxScroll();
  }
  window.EMBER = { stateFor: stateFor, camAt: camAt, CAM: CAM, frame: frame,
                   project: project, D: D, purity: purity, copyCheck: copyCheck,
                   law06: law06, absence: absence, hold: hold,
                   ROUTES: ROUTES, tileFor: tileFor, renderAt: renderAt, bench: bench,
                   tilesReady: tilesReady, readerCopy: readerCopy,
                   tileTiming: function () { return Object.assign({}, TILE_TIMING); },
                   independence: independence,
                   /* "reduced motion means stop moving" is a claim about the
                      loop, not about a panel, so the loop is askable. */
                   gated: function () { return { gate: GATED, running: running }; },
                   /* the atlas: one baked still, and the copy tables it draws from */
                   bakeAt: bakeAt, ATLAS: ATLAS, VOICES: VOICES, RECORDS: RECORDS,
                   LABELS: LABELS, GROUND: GROUND, stateLine: stateLine,
                   goto: function (t) {
                     var f = (t - D.tSpan[0]) / (D.tSpan[1] - D.tSpan[0]);
                     window.scrollTo(0, f * maxScroll()); target = cur = f;
                   } };
  running = true;
  requestAnimationFrame(loop);
  setTimeout(function () { $("load").classList.add("off"); }, 260);
}

})();
