/* ===========================================================================
   ONE EMBER  ·  THE UNROLL  ·  Law 03's second verb, orbital <-> atlas

   THE PROBLEM, AND WHY IT DEFEATED THE SPIKE.

   Law 03 has three registers and two transitions. The match cut - orbital to
   ground - has shipped since Phase 4 and works because it is a SCALE change:
   there is a shape in both frames and the eye holds it. The unroll is not a
   scale change. It is a change of SPACE, from a globe to a flat map, and the
   Phase 3 spike cut between them hard and it read as a glitch. There was
   nothing to match on, because a point on the globe and the same point on the
   map are not the same point.

   The film needs it anyway, and the reason is measured rather than felt: beat
   12 lights six places that never heard of each other, and from an
   Africa-centred globe only two of them are on screen. Six of six need a map.
   countCentres() below is that measurement, live, at whatever k you are at.

   THE ANSWER: DON'T CUT. MORPH THE SURFACE, AND KEEP ONE RENDERER.

   The obvious build is a mesh - subdivide a lat/lon grid, lerp the vertices
   from sphere to plane. It works, and it costs the film its architecture: a
   second earth renderer that has to agree with the first one, a depth buffer,
   and a silhouette that is now tessellated instead of exact. Two renderers for
   one earth is the shape of every bug this project has had.

   So instead, the morph is chosen so that the fragment shader survives it. Put
   the anchor - the point the map is centred on - at the origin, and write the
   surface implicitly:

                        b·|q|²  +  2·q_z  =  0

   At b = 1 that is the unit sphere through the origin. At b = 0 it is the
   plane z = 0. In between it is a sphere of radius r = 1/b, centred at
   (0,0,-r) - so EVERY INTERMEDIATE STATE IS A SPHERE, growing, with the anchor
   pinned. The globe does not melt into a map; it inflates until it is flat,
   which is a thing a cartographer would recognise and a thing the eye reads as
   one continuous surface.

   Three consequences, and they are the whole reason this design was chosen:

     1. The renderer is still a fragment shader inverse-projecting a raster.
        No geometry, no mesh, no depth buffer. Substituting the ray into the
        equation above gives a quadratic in t whose leading coefficient IS b -
        so the flat case is not a special case, it is the linear root, and one
        stable quadratic formula covers the whole morph.
     2. The map is plate carrée at b = 0, which is the projection the elevation
        rasters are already in. The atlas register therefore adds no second
        distortion - it is the data drawn in its own coordinates.
     3. The seam and the poles fall out. Longitude ±180 is one point on the
        sphere and two edges on the map, so the globe OPENS at the antimeridian
        as it flattens; the pole is one point on the sphere and a full-width
        edge on the map, so it unzips. Both are true things about flat maps and
        the film gets to show them rather than hide them.

   WHAT IS DELIBERATELY NOT BUILT HERE. The camera is this slice's own - a
   pitch, a bearing and a height above the anchor - and it is NOT yet the
   film's sine-rule camera from frame(). Reconciling them is the join to beat
   11 and it is the next piece of work, not this one. What this slice has to
   answer first is whether the transition reads, and whether one surface
   definition can serve the shader and the overlay at the same time.
   =========================================================================== */
(function () {
"use strict";

var RAD = Math.PI / 180, DEG = 180 / Math.PI;
var $ = function (id) { return document.getElementById(id); };
function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function ss(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
function lerp(a, b, f) { return a + (b - a) * f; }

var D12 = null;              /* the beat's own record - see the loader */
var earth = $("earth"), over = $("over"), octx = over.getContext("2d");
var W = 0, H = 0, DPR = 1, gl = null, prog = null, U = {}, TEXG = null;

window.addEventListener("keydown", function (e) {
  if (e.key === "i" || e.key === "I") $("panel").classList.toggle("on");
});

/* ═══ 1 · THE SURFACE ════════════════════════════════════════════════════

   surf(lon, lat, b) -> a point in ANCHOR SPACE, where the anchor is the
   origin, +z points back at the camera, +y is north and +x is east.

   This is the film's invariant 2 one level down: ONE DEFINITION, TWO
   CONSUMERS. The GLSL copy in section 3 inverse-maps a pixel to a lon/lat and
   this one forward-maps a lon/lat to a pixel, exactly as the film's shader and
   project() do for the sphere. agreementTest() in section 6 reads pixels back
   off the GPU and diffs them against this, because two pieces of code for one
   surface is the exact shape of the bug that makes an ember slide off its
   coastline.

   Derivation. The surface is the sphere of radius r = 1/b centred at
   C = (0,0,-r). A point at map coordinates X = lon-lon0 (radians) and
   Y = lat (radians) sits at spherical angles (bY, bX) on it:

       q = C + r·( cos(bY)·sin(bX),  sin(bY),  cos(bY)·cos(bX) )

   which is written below in the forms that survive b -> 0, where r blows up
   and every term is a huge number times a tiny one:

       q.x = cos(bY) · X · sinc(bX)
       q.y = Y · sinc(bY)
       q.z = -[ b·Y²·hav(bY)  +  cos(bY)·b·X²·hav(bX) ]

   with sinc(u) = sin(u)/u and hav(u) = (1-cos u)/u², both -> a finite limit.
   At b = 1 this is exactly the unit sphere shifted to the anchor; at b = 0 it
   is exactly (X, Y, 0), the plate carrée. sphereTest() asserts the first of
   those against the film's own xyz(), because "exactly" is a claim.        */

var LON0 = 10;               /* the map's centre meridian. Africa-and-Eurasia
                                centred, which is also the frame beat 11 leaves
                                the camera on. */

function sinc(u) { var a = Math.abs(u); return a < 1e-4 ? 1 - u * u / 6 : Math.sin(u) / u; }
function hav(u) { var a = Math.abs(u); return a < 1e-4 ? 0.5 - u * u / 24 : (1 - Math.cos(u)) / (u * u); }
function wrapLon(d) { while (d > 180) d -= 360; while (d < -180) d += 360; return d; }

function surf(lon, lat, b) {
  var X = wrapLon(lon - LON0) * RAD, Y = lat * RAD;
  var cY = Math.cos(b * Y);
  return [cY * X * sinc(b * X),
          Y * sinc(b * Y),
          -(b * Y * Y * hav(b * Y) + cY * b * X * X * hav(b * X))];
}

/* The outward normal, which is what a horizon test needs. On the sphere of
   radius r centred at (0,0,-r) the unit normal at q is (q - C)/r = b·q + z. At
   b = 0 that is z-hat, and a plane has no horizon - which is the right answer
   and falls out rather than being special-cased. */
function surfNormal(q, b) {
  var n = [b * q[0], b * q[1], b * q[2] + 1];
  var l = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
}

/* ═══ 2 · THE CAMERA ═════════════════════════════════════════════════════

   This slice's own, and deliberately simpler than the film's: the camera looks
   at the anchor from a height h, pitched back by `pitch` from straight down
   and swung by `bearing`. Look-at is the anchor at every k, which is what
   makes the morph read as one move instead of two - the thing at the centre of
   the frame never changes, and everything else opens out around it.

   h is keyframed and it CLIMBS, which is not a workaround: "the camera pulls
   back and the globe flattens" is the storyboard's own description, and the
   arithmetic agrees. At b = 0 the map is 2π wide in these units, so a 26°
   lens has to stand about 13 earth radii off to hold it. That is the shot. */

var FOV = 26, TAN_HALF = Math.tan(FOV / 2 * RAD);

/* t -> the whole move. Five keyframes: hold on the globe, unroll, hold on the
   atlas. Lerped, and every channel is a pure function of t (Law 01). */
/* h IS SET BY ARITHMETIC, NOT BY EYE, at both ends.

   To hold the whole globe the frame has to be at least 2 wide at the globe's
   distance: 2·(1+h)·tan(FOV/2) >= 2, so h >= 3.33. To hold the whole atlas it
   has to be 2π wide: 2·h·tan(FOV/2) >= 2π, so h >= 13.6. Those two numbers ARE
   the move - "the camera pulls back and the globe flattens" is not a metaphor,
   it is a factor of four in altitude, and the storyboard wrote it down before
   anyone measured it. */
/* The fifth channel is a LENS SHIFT, not a pan: the camera slides along its
   own up-axis while the view direction stays put, which is what a rise-and-fall
   lens does and what an architectural photographer uses to keep verticals
   straight. It exists because placement law 1 says copy lives in the left
   column and nothing is ever written across the middle of the frame - and a
   world map centred in a 16:10 frame lands exactly on the film voice. Shifting
   the map up is the photographic answer; moving the sentence would be the
   caption answer. */
var KEYS = [
  /*  t      k     h     pitch  bearing  shift */
  [0.000, 0.000,  3.60, 16,  0,   0.00],
  [0.180, 0.000,  3.60, 16,  0,   0.00],  /* the whole globe, held: the entry */
  [0.300, 0.060,  4.30, 13,  0,   0.00],  /* it begins as a pull-back */
  [0.620, 0.640,  7.60,  6,  0,  -0.10],
  [0.840, 1.000,  9.60,  0,  0,  -0.30],  /* flat on, square: the atlas */
  [1.000, 1.000,  9.60,  0,  0,  -0.30]
];

function camAt(t) {
  var K = KEYS, i;
  if (t <= K[0][0]) return key(K[0]);
  for (i = 1; i < K.length; i++) {
    if (t <= K[i][0]) {
      var a = K[i - 1], b = K[i], f = ss((t - a[0]) / (b[0] - a[0]));
      return { k: lerp(a[1], b[1], f), h: lerp(a[2], b[2], f),
               pitch: lerp(a[3], b[3], f), bearing: lerp(a[4], b[4], f),
               shift: lerp(a[5], b[5], f) };
    }
  }
  return key(K[K.length - 1]);
}
function key(r) { return { k: r[1], h: r[2], pitch: r[3], bearing: r[4],
                           shift: r[5] }; }

/* The camera frame in anchor space. The anchor's normal is z-hat by
   construction, north is y-hat and east is x-hat, so this is short. */
function frame(c) {
  var p = c.pitch * RAD, br = c.bearing * RAD;
  /* back off along a direction `pitch` degrees from the anchor normal */
  var back = [Math.sin(p) * Math.sin(br), Math.sin(p) * Math.cos(br), Math.cos(p)];
  var pos = [back[0] * c.h, back[1] * c.h, back[2] * c.h];
  var fwd = [-back[0], -back[1], -back[2]];
  /* up is north, projected out of the view direction */
  var north = [0, 1, 0];
  var d = north[0] * fwd[0] + north[1] * fwd[1] + north[2] * fwd[2];
  var up = [north[0] - fwd[0] * d, north[1] - fwd[1] * d, north[2] - fwd[2] * d];
  var l = Math.hypot(up[0], up[1], up[2]) || 1;
  up = [up[0] / l, up[1] / l, up[2] / l];
  /* cross(FWD, UP), not cross(up, fwd) - and the difference is a mirrored
     world. The film writes cross(up, fwd) and is right to, because ITS world
     has x through (0E,0N) and z pointing east. Anchor space is the other
     chirality: x is east, y is north, z points back at the camera. Copying the
     film's line put east on the left of frame, and the first shot out of the
     renderer was a mirror-image Africa that read convincingly enough as
     somewhere else entirely. Two frames of the same earth, one of them
     reflected, and nothing in the arithmetic complains. */
  var right = [fwd[1] * up[2] - fwd[2] * up[1],
               fwd[2] * up[0] - fwd[0] * up[2],
               fwd[0] * up[1] - fwd[1] * up[0]];
  /* the lens shift: slide along up, leave fwd alone. One half-frame of shift
     is h*tanHalf at the anchor's distance. */
  var sh = (c.shift || 0) * c.h * TAN_HALF;
  pos = [pos[0] + up[0] * sh, pos[1] + up[1] * sh, pos[2] + up[2] * sh];
  return { pos: pos, fwd: fwd, up: up, right: right, h: c.h, shift: c.shift || 0 };
}

/* project a lon/lat to screen pixels; null if the surface hides it or it is
   off the lens. The horizon test is the sphere's own - a point is visible when
   its normal leans toward the camera by more than the grazing angle - and it
   relaxes to "always" as the surface flattens, which is correct: a plane seen
   from above has no horizon. */
function project(F, lon, lat, b) {
  var q = surf(lon, lat, b);
  var r = [q[0] - F.pos[0], q[1] - F.pos[1], q[2] - F.pos[2]];
  if (b > 1e-4) {
    var n = surfNormal(q, b), R = 1 / b;
    var C = [0, 0, -R];
    var vc = [F.pos[0] - C[0], F.pos[1] - C[1], F.pos[2] - C[2]];
    var dc = Math.hypot(vc[0], vc[1], vc[2]);
    var cosLim = R / dc;
    var dotN = (n[0] * vc[0] + n[1] * vc[1] + n[2] * vc[2]) / dc;
    if (dotN < cosLim) return null;                       /* over the horizon */
  }
  var cz = r[0] * F.fwd[0] + r[1] * F.fwd[1] + r[2] * F.fwd[2];
  if (cz <= 1e-6) return null;
  var sx = r[0] * F.right[0] + r[1] * F.right[1] + r[2] * F.right[2];
  var sy = r[0] * F.up[0] + r[1] * F.up[1] + r[2] * F.up[2];
  return [W / 2 + (sx / cz / TAN_HALF) * (H / 2),
          H / 2 - (sy / cz / TAN_HALF) * (H / 2)];
}

/* ═══ 3 · THE RENDERER ═══════════════════════════════════════════════════

   The film's fragment shader, with exactly one thing changed: where it
   intersected the unit sphere and read lon/lat off the hit point, this
   intersects the morphing surface and reads lon/lat off the same. Everything
   after that line - the elevation fetch, the smoothed field, the relief, the
   two Law 08 edges - is the shipped Phase 4 code and is not touched, which is
   the point of choosing a morph the shader could survive.

   THE INTERSECTION. Substituting the ray O + tD into b|q|² + 2q_z = 0:

       b·t²  +  2t(b(O·D) + D_z)  +  (b|O|² + 2·O_z)  =  0

   The leading coefficient IS the bend, so at b = 0 this is not a degenerate
   quadratic needing a branch, it is a linear equation with the right root. The
   stable form (Numerical Recipes' q = -(β + sgn(β)√disc), roots q/α and γ/q)
   is used because the near root is γ/q, which stays finite as α -> 0.       */

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
"uniform vec2 uRes, uGlobalSize;\n" +
"uniform sampler2D uGlobal;\n" +
"uniform float uScale, uOffset;\n" +
"uniform int uFloatElev, uDebug;\n" +
"uniform float uSea, uTanHalf, uChill, uB, uLon0, uEdge, uCopy;\n" +
"uniform vec3 uCam, uFwd, uUp, uRight;\n" +
"const float PI = 3.141592653589793;\n" +
"\n" +
"float dec(vec3 c){\n" +
"  return uFloatElev == 1 ? c.r : (c.r*255.0*256.0 + c.g*255.0)*uScale + uOffset;\n" +
"}\n" +
"\n" +
"// ---- the surface, inverted. See the JS surf() for the forward map. ------\n" +
"// Returns t of the near hit, or -1.0 for a miss. Never branches on a\n" +
"// per-pixel value in a way that reaches a texture fetch: invariant 3.\n" +
"float hit(vec3 O, vec3 D){\n" +
"  float al = uB;\n" +
"  float be = uB*dot(O,D) + D.z;\n" +
"  float ga = uB*dot(O,O) + 2.0*O.z;\n" +
"  float disc = be*be - al*ga;\n" +
"  if (disc < 0.0) return -1.0;\n" +
"  float s = sqrt(disc);\n" +
"  float q = -(be + (be < 0.0 ? -s : s));\n" +
"  // near root. q is bounded away from zero for any camera outside the\n" +
"  // surface, and ga/q is the root that stays finite as the bend goes to zero.\n" +
"  float t = (abs(q) > 1e-12) ? ga/q : -1.0;\n" +
"  return t;\n" +
"}\n" +
"\n" +
"// hit point -> lon/lat. n is the unit normal of the sphere of radius 1/uB,\n" +
"// and the map coordinate is its angle DIVIDED BY the bend - which is a 0/0 as\n" +
"// the surface flattens, so the small-bend limit is written out. The branch is\n" +
"// on a uniform, and the threshold is chosen so the two sides differ by far\n" +
"// less than a pixel: at uB = 1e-3 the error is ~6e-4 degrees.\n" +
"vec2 lonlat(vec3 q){\n" +
"  vec3 n = vec3(uB*q.x, uB*q.y, uB*q.z + 1.0);\n" +
"  float X, Y;\n" +
"  if (uB > 1.0e-3) {\n" +
"    X = atan(n.x, n.z) / uB;\n" +
"    Y = asin(clamp(n.y, -1.0, 1.0)) / uB;\n" +
"  } else {\n" +
"    X = q.x; Y = q.y;\n" +
"  }\n" +
"  return vec2(uLon0 + X*180.0/PI, Y*180.0/PI);\n" +
"}\n" +
"\n" +
"void main(){\n" +
"  vec2 ndc = (gl_FragCoord.xy - uRes*0.5) / (uRes.y*0.5);\n" +
"  vec3 dir = normalize(uFwd + uRight*ndc.x*uTanHalf + uUp*ndc.y*uTanHalf);\n" +
"\n" +
"  vec3 sky = mix(vec3(0.055,0.083,0.125), vec3(0.012,0.019,0.032), 0.55);\n" +
"  sky = mix(sky, vec3(0.016,0.024,0.039), uChill*0.5);\n" +
"\n" +
"  float t = hit(uCam, dir);\n" +
"  if (t <= 0.0){ frag = vec4(sky, 1.0); return; }\n" +
"  vec3 q = uCam + dir*t;\n" +
"  vec2 ll = lonlat(q);\n" +
"\n" +
"  // THE MAP HAS AN EDGE, and as the globe flattens the edge is where the\n" +
"  // antimeridian opens and the poles unzip. Outside it there is no earth -\n" +
"  // not black earth, NO earth - so it is sky, and the boundary is softened by\n" +
"  // a pixel so the seam is a line and not a staircase.\n" +
"  vec2 llw = vec2(ll.x - uLon0, ll.y);\n" +
"  float ex = 180.0 - abs(llw.x);\n" +
"  float ey =  90.0 - abs(llw.y);\n" +
"  float edge = min(ex, ey);\n" +
"  if (edge < 0.0){ frag = vec4(sky, 1.0); return; }\n" +
"\n" +
"  vec2 g = vec2(ll.x/360.0 + 0.5, 0.5 - ll.y/180.0);\n" +
"  vec2 ax = dFdx(g)*uGlobalSize, ay = dFdy(g)*uGlobalSize;\n" +
"  float lg = 0.5*log2(max(max(dot(ax,ax), dot(ay,ay)), 1.0));\n" +
"  float e  = dec(textureLod(uGlobal, g, lg).rgb);\n" +
"  float eS = dec(textureLod(uGlobal, g, lg + 1.25).rgb);\n" +
"\n" +
"  // DEGREES OF MAP PER PIXEL. Both of the things below are wrong without\n" +
"  // it, and both were wrong in the first draft, because the film\u2019s\n" +
"  // constants were tuned on a shot 0.01 degrees per pixel wide and this\n" +
"  // register runs at 0.45 - a factor of forty.\n" +
"  float res = max(length(vec2(dFdx(ll.x), dFdy(ll.x))),\n" +
"                  length(vec2(dFdx(ll.y), dFdy(ll.y))));\n" +
"\n" +
"  // RELIEF, scaled to the footprint. A slope is metres per PIXEL here,\n" +
"  // not metres per kilometre, so the same constant that gives a beat-06\n" +
"  // close shot its hillsides turns a world map into a black rectangle.\n" +
"  float rs = 0.055 * clamp(0.0106/max(res, 1e-6), 0.02, 1.0);\n" +
"  vec3 nrm = normalize(vec3(-dFdx(eS)*rs, dFdy(eS)*rs, 1.0));\n" +
"  float lam = clamp(dot(nrm, normalize(vec3(-0.55,0.62,0.56))), 0.0, 1.0);\n" +
"\n" +
"  float above = e - uSea;\n" +
"  float aboveS = eS - uSea;\n" +
"  vec3 col;\n" +
"  if (above > 0.0){\n" +
"    float h = clamp(e/3800.0, 0.0, 1.0);\n" +
"    vec3 old = mix(vec3(0.190,0.216,0.252), vec3(0.400,0.415,0.432), h);\n" +
"    vec3 shelf = mix(vec3(0.352,0.368,0.382), vec3(0.286,0.304,0.322),\n" +
"                     clamp(-e/110.0, 0.0, 1.0));\n" +
"    col = mix(old, shelf, step(e, 0.0));\n" +
"    col *= 0.70 + 0.46*lam;\n" +
"  } else {\n" +
"    float dep = clamp(-above/2600.0, 0.0, 1.0);\n" +
"    col = mix(vec3(0.052,0.082,0.130), vec3(0.014,0.024,0.044), dep);\n" +
"    col = mix(col, vec3(0.072,0.108,0.155), 1.0-smoothstep(0.0,190.0,-above));\n" +
"  }\n" +
"\n" +
"  float gAbove = length(vec2(dFdx(aboveS), dFdy(aboveS)));\n" +
"  float live = (1.0 - smoothstep(0.40, 1.15, abs(aboveS)/max(gAbove, 1e-5)))\n" +
"             * smoothstep(0.6, 2.4, gAbove)\n" +
"             // AND BELOW A RESOLUTION THERE IS NO COASTLINE TO DRAW. Law 08\n" +
"             // says an edge is a pixel and not a metre; the other end of\n" +
"             // that argument is that when one pixel spans degrees of map\n" +
"             // there is no edge, there is a smear, and drawing it anyway\n" +
"             // lit the whole grazing limb of the morphing globe white.\n" +
"             * (1.0 - smoothstep(1.5, 4.0, res));\n" +
"  col = mix(col, vec3(0.86,0.89,0.93), live*0.92);\n" +
"\n" +
"  // the map's own edge, drawn as an edge because Law 08 applies to the\n" +
"  // artifact as much as to the world: the cut a flat map makes is a real\n" +
"  // fact about it and the film says so rather than trimming it silently.\n" +
"  float seam = (1.0 - smoothstep(0.0, uEdge, edge)) * (1.0 - uB);\n" +
"  col = mix(col, vec3(0.30,0.36,0.45), seam*0.85);\n" +
"\n" +
"  // THE DEBUG VIEW IS A MEASURING INSTRUMENT, not a picture, so it is\n" +
"  // written to be read rather than looked at: one channel-triple carries\n" +
"  // ONE number at 24 bits, which is 1.4e-5 of a degree, and the test runs\n" +
"  // the pass twice - once for longitude, once for latitude. A packed\n" +
"  // fract() encoding was tried first and is unreadable: it wraps, so a\n" +
"  // pixel near a wrap is ambiguous by a whole cell and the test failed on\n" +
"  // its own encoding rather than on the surface.\n" +
"  // ---- the graduated filter, ported from the film unchanged. The\n" +
"  // frame\u2019s edges come down so the chrome can live there, and the lower\n" +
"  // left comes down further WHILE there is a sentence in it. Placement\n" +
"  // law 2: no plate, no box, no blur behind a word - but the frame may\n" +
"  // be graded, and the grade leaves when the sentence does. That is the\n" +
"  // difference between photography and a caption, and it is also why the\n" +
"  // atlas does not need to be shrunk to make room for its own line. ----\n" +
"  vec2 uv = gl_FragCoord.xy / uRes;\n" +
"  col *= mix(0.30, 1.0, smoothstep(0.0, 0.20, uv.y));\n" +
"  col *= mix(0.52, 1.0, smoothstep(1.0, 0.90, uv.y));\n" +
"  float band = smoothstep(0.46, 0.04, uv.x)\n" +
"             * (0.55 + 0.45*smoothstep(0.85, 0.12, uv.y));\n" +
"  col *= mix(1.0, 0.34, clamp(band, 0.0, 1.0)*uCopy);\n" +
"\n" +
"  if (uDebug > 0) {\n" +
"    // llw.x, NOT ll.x. The map coordinate is bounded by +/-180 because\n" +
"    // the edge test above already threw away everything outside it;\n" +
"    // the WORLD longitude is uLon0 + that and runs to 190 for a map\n" +
"    // centred at 10E. Encoding the world longitude clamped, and the\n" +
"    // clamp read as an eleven-pixel drift at the seam - a failure\n" +
"    // entirely inside the instrument.\n" +
"    float v = uDebug == 1 ? (llw.x + 180.0)/360.0 : (llw.y + 90.0)/180.0;\n" +
"    v = clamp(v, 0.0, 1.0);\n" +
"    float r = floor(v*255.0);\n" +
"    float g = floor((v*255.0 - r)*255.0);\n" +
"    float bl = floor(((v*255.0 - r)*255.0 - g)*255.0);\n" +
"    col = vec3(r, g, bl)/255.0;\n" +
"  }\n" +
"  frag = vec4(col, 1.0);\n" +
"}\n";

function shader(type, src) {
  var s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s));
  return s;
}

var FLOAT_ELEV = false, META = { scale: 0.30518, offset: -12000 };

function decodePNG(img) {
  var c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  var x = c.getContext("2d");
  x.drawImage(img, 0, 0);
  var d = x.getImageData(0, 0, img.width, img.height).data;
  var n = img.width * img.height, out = new Float32Array(n);
  for (var i = 0, j = 0; i < n; i++, j += 4)
    out[i] = (d[j] * 256 + d[j + 1]) * META.scale + META.offset;
  return out;
}

function initGL() {
  gl = earth.getContext("webgl2", { antialias: true, alpha: false, depth: false,
                                    preserveDrawingBuffer: true });
  if (!gl) { var e = new Error("WebGL2 did not start."); e.gl = true; throw e; }
  prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  gl.bindVertexArray(gl.createVertexArray());
  ["uRes", "uGlobal", "uGlobalSize", "uScale", "uOffset", "uFloatElev", "uDebug",
   "uSea", "uTanHalf", "uChill", "uB", "uLon0", "uEdge", "uCopy",
   "uCam", "uFwd", "uUp", "uRight"]
    .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

  FLOAT_ELEV = !!gl.getExtension("EXT_color_buffer_float");
  var tx = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tx);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  if (FLOAT_ELEV) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, TEXG.width, TEXG.height, 0,
                  gl.RED, gl.FLOAT, decodePNG(TEXG));
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, gl.RGB, gl.UNSIGNED_BYTE, TEXG);
  }
  var mip = FLOAT_ELEV;
  if (mip) { try { gl.generateMipmap(gl.TEXTURE_2D); } catch (x) { mip = false; } }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER,
                   mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  /* REPEAT in longitude: the map wraps even though the atlas cuts it. */
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(U.uGlobal, 0);
  gl.uniform2f(U.uGlobalSize, TEXG.width, TEXG.height);
  gl.uniform1i(U.uFloatElev, FLOAT_ELEV ? 1 : 0);
  gl.uniform1f(U.uScale, META.scale);
  gl.uniform1f(U.uOffset, META.offset);
  gl.uniform1f(U.uTanHalf, TAN_HALF);
  gl.uniform1f(U.uLon0, LON0);
}

var DEBUG = 0;

/* The copy envelope, matching the film's: it rises with the sentence and falls
   with it, so the grade is present exactly while the words are. */
function copyEnvelope(t) {
  var a = VOICE.t[0], b = VOICE.t[1];
  return ss((t - a) / 0.055) * (1 - ss((t - (b - 0.055)) / 0.055));
}

function drawEarth(s, F) {
  gl.uniform2f(U.uRes, earth.width, earth.height);
  gl.uniform1f(U.uSea, s.sea);
  gl.uniform1f(U.uChill, s.chill);
  gl.uniform1f(U.uB, s.b);
  /* the seam's width in DEGREES OF MAP, scaled so it stays about a pixel:
     the map is 360 wide and the frame holds roughly 2*h*tanHalf of it */
  gl.uniform1f(U.uEdge, Math.max(0.05, 360 / Math.max(1, W) * 1.5));
  gl.uniform1i(U.uDebug, DEBUG);
  /* how much the frame owes to type right now. Nothing else reads it, so it
     cannot leak into the world state. */
  gl.uniform1f(U.uCopy, copyEnvelope(s.t));
  gl.uniform3fv(U.uCam, F.pos);
  gl.uniform3fv(U.uFwd, F.fwd);
  gl.uniform3fv(U.uUp, F.up);
  gl.uniform3fv(U.uRight, F.right);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

/* ═══ 4 · THE SIX CENTRES  (Law 02: people are the only warm light) ═══════

   THREE OF THESE ARE SOURCED AND THREE ARE NOT, and the difference is on
   screen rather than in a comment. china-rice-millet, kuk-swamp and
   mesoamerica-maize carry coordinates in timeline.json; the Fertile Crescent,
   the Andes and the Sahel are named in the storyboard's frame but have no
   event with coordinates behind them yet, so they are drawn DASHED and
   labelled INDICATIVE, the same grammar beat 07 uses for the pale extent.

   That is the honest state of beat 12's data and this slice must not paper
   over it: the transition is what is being tested here, not the beat. Finish
   the dataset - Larson et al. 2014 is already in the bibliography and maps the
   accepted centres - and these become solid.                               */
/* THE CENTRES COME FROM THE RECORD, and the first version of this file is the
   argument for why. It carried them as a literal array, and within one build it
   had invented an unsourced Fertile Crescent that was ALREADY in the record with
   coordinates and a citation - under beat 11, because at 11.5 ka that is where
   it falls - and had drawn the Sahel inside a beat the evidence puts it after.

   Both are Law 07 one level out: a surface the check cannot see is a surface
   that drifts, and a table in a draw call is exactly that surface. So the slice
   reads unroll/data/beat12.json, which unroll/build_unroll.py extracts from
   timeline.json and REFUSES to write if a centre has no coordinates, cites a
   source that does not resolve, or does not exist by the time the beat closes.

   The array is filled by the loader. Nothing here authors a place. */
var CENTRES = [];
var EMBER = "232,112,58", ICE = "143,168,196", ICED = "100,124,153";

/* Beat 12's one line, verbatim from timeline.json's beat 12 onScreen field.
   Declared here rather than beside the loop because the shader's graduated
   filter reads its window: the grade and the sentence are one decision. */
/* Beat 12's one line, and the slice does not carry a copy of it: it is read
   from the beat's own onScreen field at load, the way the film's copy check
   asserts for beats 05-07. A paraphrase is exactly how "all non-Africans"
   became "everyone" the first time. */
var VOICE = { t: [0.62, 1.01], line: "" };

/* Law 03's justification, measured live. A centre counts as IN FRAME when it
   projects inside the viewport - so this is a statement about THIS shot, not
   about the projection in the abstract, and it is the number the storyboard
   quotes: 2 of 6 from a globe, 6 of 6 from the atlas. */
function countCentres(F, b) {
  var n = 0;
  CENTRES.forEach(function (c) {
    var p = project(F, c.lon, c.lat, b);
    if (p && p[0] >= 0 && p[0] <= W && p[1] >= 0 && p[1] <= H) n++;
  });
  return n;
}

function drawCentres(s, F) {
  octx.textBaseline = "middle";
  CENTRES.forEach(function (c) {
    var a = ss((s.t - c.tIn) / 0.06);
    if (a <= 0.01) return;
    var p = project(F, c.lon, c.lat, s.b);
    if (!p) return;
    octx.save();
    /* the film's own grammar for confidence: solid line for solid, dashed for
       anything the literature is still refining. It is read off the event
       rather than chosen here. */
    if (c.confidence !== "solid") octx.setLineDash([3, 3]);
    octx.strokeStyle = "rgba(" + EMBER + "," + (a * 0.9).toFixed(3) + ")";
    octx.lineWidth = 1.1;
    octx.beginPath(); octx.arc(p[0], p[1], 7.5, 0, 6.2832); octx.stroke();
    octx.restore();
    octx.fillStyle = "rgba(" + EMBER + "," + (a * 0.95).toFixed(3) + ")";
    octx.beginPath(); octx.arc(p[0], p[1], 2.0, 0, 6.2832); octx.fill();
  });
}

/* ONE BY ONE, WHICH IS THE BEAT'S WHOLE SHAPE - and the ORDER is read off the
   evidence, oldest centre first, while the RHYTHM stays the director's. The
   beat is a montage and not a timeline: 8-5 ka is not when each of these
   happened, it is when all of them are true at once, which is precisely what
   the atlas register is for. Order from the record, spacing from the film. */
function placeCentres() {
  CENTRES.forEach(function (c) { c.tIn = 0.05 + c.order * 0.052; });
}

/* ═══ 5 · STATE  (Law 01) ════════════════════════════════════════════════ */

function stateFor(t) {
  var c = camAt(t);
  return { t: t, k: c.k, b: 1 - c.k, h: c.h, pitch: c.pitch, bearing: c.bearing,
           shift: c.shift,
           /* beat 12 is 8–5 ka: the sea is at its modern level and the sky is
              Holocene. Both constant here, and both still read off state. */
           sea: lerp(-5, 0, ss(t)), chill: 0.10,
           lit: CENTRES.filter(function (x) { return t > x.tIn; }).length };
}
function hashState(s) {
  return [s.t.toFixed(5), s.k.toFixed(6), s.b.toFixed(6), s.h.toFixed(5),
          s.pitch.toFixed(4), s.bearing.toFixed(4), s.shift.toFixed(5),
          s.sea.toFixed(4),
          s.chill.toFixed(4), s.lit].join("|");
}

/* ═══ 6 · THE TESTS ══════════════════════════════════════════════════════ */

/* DO THE TWO CONSUMERS OF surf() AGREE?

   This is the check the whole design rests on. The shader inverse-maps a pixel
   to a lon/lat; project() forward-maps a lon/lat to a pixel. They are separate
   implementations of one surface - one in GLSL, one in JS - and the film's
   whole experience is that two implementations of one thing drift.

   The debug view writes the lon/lat it computed into the red and green
   channels. This reads those pixels BACK OFF THE GPU, converts them to
   lon/lat, forward-projects them with project(), and measures how far the
   round trip lands from where it started. It is a comparison against a
   different code path that could have disagreed - which is the only kind that
   counts.                                                                  */
/* DO THE TWO CONSUMERS OF THE SURFACE AGREE?

   This is the check the whole design rests on. The shader inverse-maps a pixel
   to a lon/lat; project() forward-maps a lon/lat to a pixel. They are separate
   implementations of one surface, one in GLSL and one in JS, and every bug this
   project has had is two implementations of one thing drifting apart.

   IT IS A ROUND TRIP IN PIXELS, and the first two versions were not, which is
   why they failed on their own arithmetic rather than on the film:

     1. project() a place  ->  a CONTINUOUS pixel position p
     2. read the shader's own answer at the pixel CONTAINING p  ->  a lon/lat L
     3. project() L        ->  p2
     4. the error is |p2 - the centre of that pixel|

   Step 4 is the whole point. Comparing L against the place we started from
   measures the distance from a continuous position to a pixel centre, which is
   up to half a pixel by construction and has nothing to do with whether the two
   definitions agree - at k = 1 that showed up as EVERY probe being wrong by
   exactly 0.2249 degrees, which is one number, which is never a drift. Going
   back through project() puts both sides on the same pixel centre and leaves
   only the disagreement.

   The bar is half a pixel, because below that the two definitions cannot be
   SEEN to disagree, and being seen is the entire claim: a light that sits off
   its coastline is what this is guarding against.                            */
function agreementTest() {
  var rows = [], worst = null, tested = 0, edges = 0, hidden = 0, detail = [];

  /* a spread of places, not just the six centres: the seam and the poles are
     where a surface definition goes wrong first, and the six centres all sit in
     the comfortable middle of the map. */
  var PROBES = [];
  CENTRES.forEach(function (c) { PROBES.push([c.lon, c.lat, c.label]); });
  [[-175, 0, "WEST OF THE SEAM"], [175, 0, "EAST OF THE SEAM"],
   [LON0, 84, "UNDER THE NORTH POLE"], [LON0, -84, "UNDER THE SOUTH POLE"],
   [LON0 + 90, 45, "A QUARTER TURN EAST"], [LON0 - 90, -45, "A QUARTER TURN WEST"],
   [LON0 + 150, 60, "THE FAR NORTH-EAST"], [LON0 - 150, -60, "THE FAR SOUTH-WEST"]]
    .forEach(function (p) { PROBES.push(p); });

  var b4 = new Uint8Array(4);
  function sampleAt(p) {
    /* the pixel CONTAINING p, and where its centre is. GL indexes from the
       bottom-left in device pixels; project() answers in CSS pixels from the
       top-left. */
    var X = Math.floor(p[0] * DPR), Yt = Math.floor(p[1] * DPR);
    if (X < 0 || Yt < 0 || X >= earth.width || Yt >= earth.height) return null;
    return { X: X, Ygl: earth.height - 1 - Yt,
             centre: [(X + 0.5) / DPR, (Yt + 0.5) / DPR] };
  }
  function read24(sm) {
    gl.readPixels(sm.X, sm.Ygl, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b4);
    return (b4[0] + b4[1] / 255 + b4[2] / 65025) / 255;
  }

  [0.0, 0.25, 0.5, 0.75, 1.0].forEach(function (kk) {
    var t = tOfK(kk), s = stateFor(t), F = frame(s);
    var mx = 0, n = 0, ed = 0, hid = 0;

    var sm = PROBES.map(function (p) {
      var q = project(F, p[0], p[1], s.b);
      return q ? sampleAt(q) : null;
    });
    DEBUG = 1; drawEarth(s, F);
    var gotLon = sm.map(function (m) { return m ? read24(m) : null; });
    var skyR = sm.map(function () { return b4[0]; });   /* overwritten below */
    DEBUG = 2; drawEarth(s, F);
    var gotLat = sm.map(function (m) { return m ? read24(m) : null; });
    DEBUG = 0;

    PROBES.forEach(function (p, i) {
      if (!sm[i]) { hid++; hidden++; return; }
      /* a MAP coordinate, so lon0 + it is the world longitude and
         project() wraps it straight back to the same number */
      var lo = LON0 + (gotLon[i] * 360 - 180), la = gotLat[i] * 180 - 90;

      /* THE SHADER HAS THREE ANSWERS, NOT TWO, and conflating them made the
         first version unreadable. It can say "earth, and it is here"; it can
         say "no earth at all" - sky, past the map's edge or past the horizon;
         and it can be wrong. Only the third is a drift. A probe deliberately
         placed a degree inside the seam WILL land within a pixel of the edge,
         and which side of it a floored pixel falls on is not a fact about the
         surface. Sky decodes to a latitude below -88, which no probe is at. */
      if (la < -88) {
        ed++; edges++;
        var inset = Math.min(180 - Math.abs(wrapLon(p[0] - LON0)), 90 - Math.abs(p[1]));
        if (inset > 8) detail.push("k " + kk.toFixed(2) + "  " + p[2] +
          ": the shader says NO EARTH " + inset.toFixed(0) + "\u00b0 inside the map");
        return;
      }

      /* back through project(): both sides now name the same pixel centre */
      var p2 = project(F, lo, la, s.b);
      if (!p2) { ed++; edges++; return; }
      var d = Math.hypot(p2[0] - sm[i].centre[0], p2[1] - sm[i].centre[1]);
      n++; tested++;
      if (d > mx) mx = d;
      if (!worst || d > worst.px) worst = { px: d, k: kk, name: p[2] };
    });
    rows.push("  k " + kk.toFixed(2) + "   " + n + " on the map, worst " +
              mx.toFixed(3) + " px" +
              (ed ? "   " + ed + " at an edge" : "") +
              (hid ? "   " + hid + " over the horizon" : ""));
  });

  var ok = tested >= 30 && worst && worst.px < 0.5 && detail.length === 0;
  $("o-agree").innerHTML =
    (ok ? '<span class="ok">PASS</span>\n' : '<span class="bad">FAIL</span>\n') +
    "A ROUND TRIP IN PIXELS. project() a place to a\npixel; read the shader\u2019s own lon/lat back off the\n" +
    "GPU at that pixel at 24 bits; project() THAT and\nmeasure how far it lands from the pixel\u2019s centre.\n\n" +
    "Going back through project() is not decoration.\nComparing the shader\u2019s answer against the place we\n" +
    "started from measures the distance from a\ncontinuous position to a pixel centre - half a\n" +
    "pixel by construction, nothing to do with the\nsurface. It showed up as every probe at k = 1\n" +
    "being wrong by exactly 0.2249\u00b0: one number, which\nis never a drift.\n\n" +
    rows.join("\n") + "\n\n" +
    tested + " probes on the map over five values of k, plus\n" + edges +
    " at the map\u2019s edge and " + hidden + " the surface itself\nhides. Both are counted, not scored.\n\n" +
    "worst " + (worst ? worst.px.toFixed(4) + " px, " + worst.name +
                " at k " + worst.k.toFixed(2) : "\u2014") +
    "\nThe bar is half a pixel.\n" +
    (detail.length ? "\n" + detail.join("\n") + "\n" : "") +
    (ok ? "\nOne surface, two languages, no daylight between\nthem."
        : "\nThe two definitions have drifted, and that is the\nbug this slice exists to make impossible.");
  return ok;
}

/* k -> t, by inverting the keyframe table */
function tOfK(k) {
  var lo = 0, hi = 1, i;
  for (i = 0; i < 60; i++) {
    var m = (lo + hi) / 2;
    if (camAt(m).k < k) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

/* AT k=0 THE MORPH MUST BE THE FILM'S GLOBE, EXACTLY.

   Not nearly. Beat 12 is entered from beat 11, which is a globe, and if surf()
   at k=0 is a sphere to five decimal places instead of exactly then the unroll
   opens with a pop - the one thing the Phase 3 spike already failed on.

   The comparison is against the FILM'S OWN xyz(), copied here rather than
   imported so this slice stands alone, and it is a different formula: xyz
   builds the sphere from cos/sin directly, surf builds it from sinc and hav
   and a bend of exactly 1. They could disagree. */
function xyzFilm(lon, lat) {
  var cl = Math.cos(lat * RAD);
  return [cl * Math.cos(lon * RAD), Math.sin(lat * RAD), cl * Math.sin(lon * RAD)];
}
function sphereTest() {
  var worst = 0, n = 0, wl = null;
  for (var i = 0; i <= 72; i++) {
    for (var j = 0; j <= 36; j++) {
      var lon = -180 + 360 * (i / 72), lat = -90 + 180 * (j / 36);
      var q = surf(lon, lat, 1);
      /* anchor space at b=1: the unit sphere shifted so (LON0,0) is at +z, and
         with longitude measured from LON0 about the y axis. Undo both to get
         back to the film's world frame. */
      var P = [q[0], q[1], q[2] + 1];
      var X = wrapLon(lon - LON0) * RAD;
      var want = [Math.cos(lat * RAD) * Math.sin(X),
                  Math.sin(lat * RAD),
                  Math.cos(lat * RAD) * Math.cos(X)];
      var d = Math.hypot(P[0] - want[0], P[1] - want[1], P[2] - want[2]);
      /* and the film's own xyz, rotated into this frame, must be the same point */
      var f = xyzFilm(wrapLon(lon - LON0), lat);          /* (x,y,z) film order */
      var d2 = Math.hypot(P[0] - f[2], P[1] - f[1], P[2] - f[0]);
      var e = Math.max(d, d2);
      n++;
      if (e > worst) { worst = e; wl = [lon, lat]; }
    }
  }
  var ok = worst < 1e-12;
  $("o-sphere").innerHTML =
    (ok ? '<span class="ok">PASS</span>\n' : '<span class="bad">FAIL</span>\n') +
    "At k = 0 the morph is the unit sphere, checked at\n" + n +
    " points against TWO other formulas: the\nclosed-form sphere, and the film's own xyz().\n\n" +
    "worst separation " + worst.toExponential(2) + " earth radii" +
    (wl ? "\n   at " + wl[0].toFixed(0) + "°, " + wl[1].toFixed(0) + "°" : "") + "\n\n" +
    (ok ? "Exactly the sphere, not nearly. Entering the\nunroll from a globe beat costs nothing."
        : "NOT the sphere. The unroll would open with a pop,\nwhich is the failure the Phase 3 spike already had.");
  return ok;
}

function purity() {
  var N = 400, a = [], b = [], i;
  for (i = 0; i <= N; i++) a.push(hashState(stateFor(i / N)));
  for (i = N; i >= 0; i--) b.unshift(hashState(stateFor(i / N)));
  var bad = 0, mono = true, prev = -1;
  for (i = 0; i <= N; i++) {
    if (a[i] !== b[i]) bad++;
    var kk = stateFor(i / N).k;
    if (prev >= 0 && kk < prev - 1e-12) mono = false;
    prev = kk;
  }
  $("o-purity").innerHTML = (bad === 0 && mono)
    ? '<span class="ok">PASS &mdash; ' + (N + 1) + " samples.</span>\nIdentical forward and backward, " +
      "and k never runs\nbackwards. The unroll is a function of t, so it\ncan be scrubbed - which is the " +
      "only reason a\ntransition this long can be directed at all."
    : '<span class="bad">FAIL &mdash; ' + bad + " differing" + (mono ? "" : ", and k went backwards") + ".</span>";
  return bad === 0 && mono;
}

/* LAW 03's JUSTIFICATION, RE-DERIVED HERE RATHER THAN QUOTED.

   The storyboard says: from an Africa-centred globe only 2 of 6 agricultural
   centres are visible; the atlas shows 6 of 6. That is the entire argument for
   the atlas register existing, so this slice measures it rather than repeating
   it - and measures it on ITS OWN camera and ITS OWN surface, which could have
   produced a different answer.                                             */
function sixTest() {
  var rows = [];
  [0, 0.25, 0.5, 0.75, 1].forEach(function (kk) {
    var t = tOfK(kk), s = stateFor(t), F = frame(s);
    rows.push([kk, countCentres(F, s.b)]);
  });
  var globe = rows[0][1], atlas = rows[rows.length - 1][1];
  var ok = globe <= 2 && atlas === CENTRES.length && CENTRES.length >= 6;
  $("o-six").innerHTML =
    (ok ? '<span class="ok">PASS</span>\n' : '<span class="bad">FAIL</span>\n') +
    "Centres inside the frame, counted by projecting\nthem through this slice's own camera:\n\n" +
    rows.map(function (r) {
      return "  k " + r[0].toFixed(2) + "    " + r[1] + " of " + CENTRES.length +
             (r[0] === 0 ? "   the globe" : r[0] === 1 ? "   the atlas" : "");
    }).join("\n") +
    "\n\nThe globe holds " + globe + ". The atlas holds " + atlas + ".\n" +
    "That gap is the whole reason Law 03 has an atlas\nregister and a second verb to reach it - and it is\n" +
    "re-derived here rather than quoted from the\nstoryboard, on a different camera and a different\nsurface.\n\n" +
    "The line says AT LEAST SIX and the record now\ncarries " + CENTRES.length +
    ", every one with coordinates, dates\nand a citation. Nothing on this page is drawn from\na table.";
  return ok;
}

/* LAW 07 FOR THIS SLICE: nothing on screen that is not in the record.

   The film's copy check diffs every on-screen line against the qualifiers its
   own event carries. This is the same discipline for a beat whose content is
   PLACES rather than sentences, and it exists because the first version of this
   file failed it three times over in one build: it invented a Fertile Crescent
   that was already in the record under beat 11, it drew a Sahel the evidence
   puts after the beat closes, and it folded two independent centres 500 km
   apart into one dot in a beat whose entire subject is independence.

   None of those is a rendering bug and none of them would have shown up in a
   frame. They are all the same bug: a surface the check cannot see.          */
function recordTest() {
  var bad = [], y1 = D12.beat.yearsBP[1];
  CENTRES.forEach(function (c) {
    if (!c.id) bad.push("a centre with no id is on screen");
    if (typeof c.lon !== "number" || typeof c.lat !== "number")
      bad.push(c.id + " has no coordinates");
    if (!c.sourceIds || !c.sourceIds.length)
      bad.push(c.id + " cites nothing");
    (c.sourceIds || []).forEach(function (s) {
      if (!D12.sources[s]) bad.push(c.id + " cites " + s + ", which does not resolve");
    });
    /* a floor, not a window: the film may not light a centre before it exists.
       Beat 12's own centres mostly PREDATE the beat, which is what the beat is
       about - 8-5 ka is when they are all true at once, not when each
       happened - so the only failure is one that begins after the beat ends. */
    if (!c.inherited && c.beganBP < y1)
      bad.push(c.id + " begins " + c.beganBP + " BP and the beat closes at " + y1);
    if (c.beat !== D12.beat.id && !c.inherited)
      bad.push(c.id + " belongs to beat " + c.beat + " and says nothing about why");
  });
  /* the film voice is the beat's own onScreen field, verbatim, never a
     paraphrase - which is how "all non-Africans" became "everyone" once */
  var voiceOK = VOICE.line === D12.beat.onScreen && VOICE.line.length > 0;
  if (!voiceOK) bad.push("the film voice is not the beat's own onScreen field");

  var q = (D12.openQuestions || []);
  var ok = bad.length === 0;
  $("o-record").innerHTML =
    (ok ? '<span class="ok">PASS &mdash; ' + CENTRES.length + " centres.</span>\n"
        : '<span class="bad">FAIL &mdash; ' + bad.length + ".</span>\n") +
    "Every place on screen resolves to an event in\ntimeline.json with its own coordinates, dates and\n" +
    "citations, and the film voice is the beat's own\nonScreen field verbatim rather than a paraphrase.\n\n" +
    CENTRES.map(function (c) {
      return "\u00b7 " + c.label + "\n   " + c.dateRange[0] + "\u2013" + c.dateRange[1] +
             " BP  \u00b7  " + c.confidence + "  \u00b7  " + c.sourceIds.join(", ") +
             (c.inherited ? "\n   inherited from beat " + c.beat : "");
    }).join("\n") +
    (bad.length ? "\n\n" + bad.map(function (x) { return "\u2717 " + x; }).join("\n") : "") +
    (q.length ? "\n\nOPEN, AND IT TRAVELS WITH THE DATA:\n" +
      q.map(function (x) { return "  " + x.question; }).join("\n") : "");
  return ok;
}

/* ═══ 7 · THE LOOP ═══════════════════════════════════════════════════════ */

var target = 0, cur = 0, driving = "scrub";

function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  earth.width = Math.round(W * DPR); earth.height = Math.round(H * DPR);
  over.width = Math.round(W * DPR); over.height = Math.round(H * DPR);
  octx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (gl) gl.viewport(0, 0, earth.width, earth.height);
}

var shownVoice = false;

function drawFrame(s) {
  var F = frame(s);
  drawEarth(s, F);
  octx.clearRect(0, 0, W, H);
  drawCentres(s, F);

  var on = s.t >= VOICE.t[0] && s.t < VOICE.t[1];
  if (on !== shownVoice) {
    shownVoice = on;
    if (on) $("voice").textContent = VOICE.line;
  }
  $("voice").classList.toggle("on", on);
  $("voice").inert = !on;

  $("state").innerHTML =
    '<span class="k">REGISTER</span> ' +
    (s.k < 0.02 ? "ORBITAL" : s.k > 0.98 ? "ATLAS" : "UNROLLING " + (s.k * 100).toFixed(0) + "%") +
    "&nbsp;&nbsp;&middot;&nbsp;&nbsp;" +
    '<span class="k">CENTRES LIT</span> ' + s.lit + " OF " + CENTRES.length;

  if ($("panel").classList.contains("on")) {
    $("p-k").textContent = s.k.toFixed(4) + " · " + s.b.toFixed(4);
    $("p-r").textContent = s.b < 1e-4 ? "flat" : (1 / s.b).toFixed(2);
    $("p-h").textContent = s.h.toFixed(2) + " earth radii";
    $("p-pb").textContent = s.pitch.toFixed(1) + "° · " + s.bearing.toFixed(0) + "°";
    $("p-lon0").textContent = LON0 + "°E";
    $("p-vis").textContent = countCentres(F, s.b) + " of " + CENTRES.length;
  }
  return s;
}

function loop() {
  cur += (target - cur) * 0.10;
  drawFrame(stateFor(cur));
  requestAnimationFrame(loop);
}

/* draw one frame synchronously, for the tests and for anything automated -
   every automated browser throttles rAF to uselessness, which the film learned
   the expensive way */
function renderAt(t) {
  target = cur = t;
  $("k").value = camAt(t).k;
  return drawFrame(stateFor(t));
}

function start() {
  initGL();
  resize();
  window.addEventListener("resize", resize);
  $("k").addEventListener("input", function () {
    target = tOfK(parseFloat($("k").value));
    $("kv").textContent = "k " + parseFloat($("k").value).toFixed(4);
  });
  window.addEventListener("keydown", function (e) {
    if (e.key === "d" || e.key === "D") DEBUG = (DEBUG + 1) % 2;
  });
  [["t-agree", agreementTest], ["t-sphere", sphereTest],
   ["t-purity", purity], ["t-six", sixTest], ["t-record", recordTest]]
    .forEach(function (p) { $(p[0]).addEventListener("click", p[1]); });

  var m = /[#&]k=([\d.]+)/.exec(location.hash);
  if (m) { target = cur = tOfK(clamp(parseFloat(m[1]), 0, 1)); }
  var mt = /[#&]t=([\d.]+)/.exec(location.hash);
  if (mt) { target = cur = clamp(parseFloat(mt[1]), 0, 1); }
  $("k").value = camAt(cur).k;
  $("kv").textContent = "k " + camAt(cur).k.toFixed(4);

  window.UNROLL = { surf: surf, project: project, frame: frame, camAt: camAt,
                    stateFor: stateFor, hashState: hashState, renderAt: renderAt,
                    tOfK: tOfK, countCentres: countCentres, CENTRES: CENTRES,
                    agreementTest: agreementTest, sphereTest: sphereTest,
                    purity: purity, sixTest: sixTest, recordTest: recordTest,
                    D12: D12, LON0: LON0 };
  requestAnimationFrame(loop);
  setTimeout(function () { $("load").classList.add("off"); }, 260);
}

function image(src) {
  return new Promise(function (res, rej) {
    var i = new Image();
    i.onload = function () { res(i); };
    i.onerror = function () { rej(new Error("could not load " + src)); };
    i.src = src;
  });
}

$("lmsg").textContent = "the record";
Promise.all([
  fetch("data/beat12.json").then(function (r) { return r.json(); })
    .then(function (j) {
      D12 = j;
      CENTRES.length = 0;
      j.centres.forEach(function (c) { CENTRES.push(c); });
      placeCentres();
      VOICE.line = j.beat.onScreen;
      $("lbar").style.width = "35%";
      $("lmsg").textContent = "the earth, 2048 x 1024";
    }),
  image("../slice/data/bathy_global.png").then(function (i) { TEXG = i; })
]).then(function () {
  $("lbar").style.width = "100%";
  start();
}).catch(function (e) {
  $("lmsg").textContent = String(e && e.message || e);
  $("lmsg").style.color = "#E8703A";
});

})();
