/* Public child-to-parent first-frame contract for the master film.
   A handle alone is not a usable frame: the child also waits for its technical
   loader to leave and for two animation frames after the renderer is live. */
(function () { "use strict";
  var sent = false, scheduled = false;
  function contract() {
    if (window.UNROLL) return {beat:12,covers:[12],handle:"UNROLL"};
    if (window.EMBER_CONFIG && window["EMBER"+window.EMBER_CONFIG.id]) return {beat:window.EMBER_CONFIG.id,covers:[window.EMBER_CONFIG.id],handle:"EMBER"+window.EMBER_CONFIG.id};
    if (window.EMBER) return {beat:5,covers:[5,6,7],handle:"EMBER"};
    return null;
  }
  function loaderHidden() { var loader=document.getElementById("load"),style;
    if (!loader) return true; style=getComputedStyle(loader);
    return loader.classList.contains("off") || style.display === "none" || style.visibility === "hidden" || Number(style.opacity) < .01; }
  function drawable() { return Array.prototype.some.call(document.querySelectorAll("canvas"),function(canvas){return canvas.width > 0 && canvas.height > 0;}); }
  function report() { scheduled=false; var c=contract();
    if (sent || !c || !loaderHidden() || !drawable()) return setTimeout(check,25);
    sent=true; var detail={type:"one-ember:child-ready",beat:c.beat,covers:c.covers,handle:c.handle,firstFrameAt:Math.round(performance.now()*10)/10,loaderHidden:true};
    window.ONE_EMBER_FRAME_READY=detail; window.dispatchEvent(new CustomEvent("one-ember:child-ready",{detail:detail}));
    if (window.parent !== window) window.parent.postMessage(detail,location.origin); }
  function check() { if (sent || scheduled) return;
    if (!contract() || !loaderHidden() || !drawable()) return setTimeout(check,25);
    scheduled=true; requestAnimationFrame(function(){requestAnimationFrame(report);}); }
  check();
}());
