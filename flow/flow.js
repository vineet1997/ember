/* ONE EMBER · 08–12 INTEGRATION SHELL
   The shell is deliberately small: it owns the project's global t and sends
   each scene its derived local t. The scenes remain the only renderers. */
(function () { "use strict";
  var D, N, stack = document.getElementById("stack"), frames = {}, target = 0, cur = 0,
      ready = false, active = null;
  var $ = function (id) { return document.getElementById(id); };
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, f) { return a + (b - a) * f; }
  function progressForT(t) { return (t - D.range[0]) / (D.range[1] - D.range[0]); }
  function tForProgress(p) { return lerp(D.range[0], D.range[1], clamp(p, 0, 1)); }
  function stateFor(t) {
    t = clamp(t, D.range[0], D.range[1]);
    var beat = D.beats[D.beats.length - 1];
    for (var i = 0; i < D.beats.length - 1; i++) {
      if (t < D.beats[i].t1) { beat = D.beats[i]; break; }
    }
    var local = clamp((t - beat.t0) / (beat.t1 - beat.t0), 0, 1);
    return { t: t, beat: beat, localT: local,
             yearBP: lerp(beat.yearsBP[0], beat.yearsBP[1], local) };
  }
  function post(frame, isActive, localT) {
    if (frame.contentWindow) frame.contentWindow.postMessage({
      type: "one-ember:external-t", active: isActive, t: localT, presentation: true
    }, location.origin);
  }
  function apply(t) {
    var s = stateFor(t), id = s.beat.id;
    D.beats.forEach(function (beat) {
      var frame = frames[beat.id], isActive = beat.id === id;
      frame.classList.toggle("on", isActive);
      frame.setAttribute("aria-hidden", String(!isActive));
      post(frame, isActive, isActive ? s.localT : 0);
    });
    active = id;
    paintFilmUI(s);
    $("p-t").textContent = s.t.toFixed(4);
    $("p-beat").textContent = String(id).padStart(2, "0") + " · " + s.beat.title;
    $("p-local").textContent = s.localT.toFixed(4);
    $("p-year").textContent = Math.round(s.yearBP).toLocaleString();
    return s;
  }
  function localCopy(s) {
    var beat = N.beats[s.beat.id - 1], windows = {
      8: [[.08, .56]], 9: [[.10, .55]], 10: [[.05, .27], [.84, .98]],
      11: [[.07, .36], [.70, .96]], 12: [[.08, .52]]
    }[s.beat.id] || [];
    for (var i = 0; i < windows.length; i++) if (s.localT >= windows[i][0] && s.localT < windows[i][1]) return beat.segments[i];
    return "";
  }
  function yearLabel(year) { var ka = year / 1000; return (ka % 1 ? ka.toFixed(1) : ka.toFixed(0)) + " KA"; }
  function paintFilmUI(s) {
    $("act").textContent = "Beat " + String(s.beat.id).padStart(2, "0") + " · " + yearLabel(s.beat.yearsBP[0]) + " — " + yearLabel(s.beat.yearsBP[1]) + " BP";
    $("title").textContent = s.beat.title;
    var subtitle = localCopy(s), el = $("subtitle");
    if (el.textContent !== subtitle) el.textContent = subtitle;
    el.classList.toggle("on", !!subtitle);
  }
  function buildRuler() {
    $("ticks").innerHTML = D.beats.map(function (beat) {
      var left = (progressForT(beat.t0) * 100).toFixed(3);
      return '<span class="tick" style="left:' + left + '%"><i>' + yearLabel(beat.yearsBP[0]) + '</i></span>';
    }).join("") + '<span class="tick hot" style="left:100%"><i style="transform:translateX(-100%)">' + yearLabel(D.beats[D.beats.length - 1].yearsBP[1]) + '</i></span>';
  }
  function renderAt(t) { cur = target = clamp(t, D.range[0], D.range[1]); return apply(cur); }
  function tick() {
    if (ready) { target = tForProgress(scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)); cur += (target - cur) * .14; apply(cur); }
    requestAnimationFrame(tick);
  }
  function waitForChildren() {
    var count = D.beats.filter(function (beat) {
      var w = frames[beat.id].contentWindow;
      return w && (beat.id === 12 ? w.UNROLL : w["EMBER" + beat.id]);
    }).length;
    $("bar").style.width = (count / D.beats.length * 100).toFixed(0) + "%";
    $("status").textContent = "ready " + count + " of " + D.beats.length;
    if (count !== D.beats.length) return setTimeout(waitForChildren, 60);
    ready = true; renderAt(D.range[0]);
    $("load").classList.add("off");
  }
  function purity() {
    var forward = [], backward = [], i, n = 400;
    for (i = 0; i <= n; i++) forward.push(JSON.stringify(stateFor(tForProgress(i / n))));
    for (i = n; i >= 0; i--) backward.unshift(JSON.stringify(stateFor(tForProgress(i / n))));
    return forward.every(function (v, index) { return v === backward[index]; });
  }
  Promise.all([fetch("data/run08-12.json").then(function (r) { return r.json(); }),
               fetch("../story/narration.json").then(function (r) { return r.json(); })]).then(function (data) {
    D = data[0]; N = data[1]; buildRuler();
    D.beats.forEach(function (beat) {
      var frame = document.createElement("iframe");
      frame.src = beat.src; frame.title = "Beat " + beat.id + ": " + beat.title;
      frame.dataset.beat = beat.id; frame.setAttribute("aria-hidden", "true");
      frames[beat.id] = frame; stack.appendChild(frame);
    });
    if (location.hash.indexOf("debug") >= 0) { document.documentElement.classList.add("debug"); window.addEventListener("keydown", function (e) { if (e.key.toLowerCase() === "i") $("panel").classList.toggle("on"); }); }
    window.FLOW = { D: D, stateFor: stateFor, renderAt: renderAt, progressForT: progressForT,
                    tForProgress: tForProgress, purity: purity, get active() { return active; }, get ready() { return ready; } };
    waitForChildren(); requestAnimationFrame(tick);
  }).catch(function (e) { $("status").textContent = String(e.message || e); });
}());
