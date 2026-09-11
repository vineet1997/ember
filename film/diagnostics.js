/* Local-only transition evidence.  It is inert unless ?diagnostics=1 is set. */
(function () { "use strict";
  var enabled = new URLSearchParams(location.search).get("diagnostics") === "1";
  var events = [], started = performance.now(), surface, qualityTier = "unselected";
  function capability() {
    var canvas = document.createElement("canvas"), gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return {viewport:[innerWidth,innerHeight],dpr:devicePixelRatio || 1,webgl:!!gl,
      saveData:!!(navigator.connection && navigator.connection.saveData),
      reducedMotion:matchMedia("(prefers-reduced-motion: reduce)").matches,
      qualityTier:qualityTier};
  }
  function draw() { if (!surface) return; surface.textContent=JSON.stringify({capability:capability(),events:events},null,2); }
  function record(type, detail) {
    if (!enabled) return;
    events.push({at:Math.round((performance.now()-started)*10)/10,type:type,detail:detail || {}});
    if (events.length > 300) events.shift();
    draw();
  }
  function childResources(frame) {
    try { var entries=frame.contentWindow.performance.getEntriesByType("resource");
      return {count:entries.length,transferBytes:entries.reduce(function(n,e){return n+(e.transferSize || 0);},0),
        lastEnd:Math.round(entries.reduce(function(n,e){return Math.max(n,e.responseEnd || 0);},0)*10)/10};
    } catch (_) { return {unavailable:true}; }
  }
  function installSurface() {
    if (!enabled) return;
    surface=document.createElement("pre"); surface.id="transition-diagnostics";
    surface.setAttribute("aria-label","Local transition diagnostics");
    document.body.appendChild(surface); draw();
  }
  window.EMBER_DIAGNOSTICS={enabled:enabled,record:record,childResources:childResources,
    setQualityTier:function(name){qualityTier=name;draw();},
    snapshot:function(){return {capability:capability(),events:events.slice()};}};
  addEventListener("error",function(e){record("window-error",{message:e.message,source:e.filename,line:e.lineno});});
  addEventListener("unhandledrejection",function(e){record("unhandled-rejection",{message:String(e.reason)});});
  installSurface(); record("diagnostics-started");
}());
