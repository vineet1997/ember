/* The master shell owns one deep-time t. It keeps exactly one WebGL child alive. */
(function () { "use strict";
  var D, N, frame, active = null, pending = null, loadedSrc = "", ready = false, target = 0, cur = 0;
  var $ = function (id) { return document.getElementById(id); };
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, f) { return a + (b - a) * f; }
  function stateFor(t) { t = clamp(t, 0, 1); var beat = D.beats[D.beats.length - 1];
    for (var i = 0; i < D.beats.length - 1; i++) if (t < D.beats[i].t1) { beat = D.beats[i]; break; }
    var local = clamp((t - beat.t0) / (beat.t1 - beat.t0), 0, 1);
    return {t:t,beat:beat,localT:local,yearBP:lerp(beat.yearsBP[0],beat.yearsBP[1],local)}; }
  function childT(s) { return s.beat.id >= 5 && s.beat.id <= 7 ? s.t : s.localT; }
  function post(s) { if (frame && frame.contentWindow) frame.contentWindow.postMessage({type:"one-ember:external-t",active:true,t:childT(s),presentation:true}, location.origin); }
  function source(s) { return new URL(s.beat.src, location.href).href; }
  function segment(s) { var narration=N.beats[s.beat.id-1], a=narration.segments, n=a.length;
    if (!n || s.localT < .10 || s.localT > .82) return "";
    return a[Math.min(n-1,Math.floor((s.localT-.10)/(.72/n)))]; }
  function year(y) { return y >= 1000 ? (y/1000).toFixed(y%1000?1:0)+" KA" : Math.round(y)+" BP"; }
  function paint(s) { $("act").textContent="Beat "+String(s.beat.id).padStart(2,"0")+" · "+year(s.beat.yearsBP[0])+" — "+year(s.beat.yearsBP[1]); $("title").textContent=s.beat.title;
    var text=segment(s); $("subtitle").textContent=text; $("subtitle").classList.toggle("on",!!text); }
  function stage(s) { $("act").textContent="Beat "+String(s.beat.id).padStart(2,"0")+" · "+year(s.beat.yearsBP[0])+" — "+year(s.beat.yearsBP[1]); $("title").textContent=s.beat.title;
    $("subtitle").textContent=""; $("subtitle").classList.remove("on"); }
  function childReady(id) { var w=frame.contentWindow; return w && (id===12 ? w.UNROLL : w["EMBER"+id]); }
  function settle() { var s=stateFor(cur);
    if (!pending) return;
    if (s.beat.id !== pending) return request(s);
    if (!childReady(pending)) return setTimeout(settle,60);
    active=pending; pending=null; loadedSrc=source(s); post(s); paint(s);
  }
  function request(s) { pending=s.beat.id; stage(s); frame.src=s.beat.src; frame.title="Beat "+pending+": "+s.beat.title; settle(); }
  function apply(t) { var s=stateFor(t), src=source(s); $("progress").style.width=(s.t*100).toFixed(3)+"%";
    if (active === s.beat.id && !pending) { post(s); paint(s); return s; }
    if (src === loadedSrc && !pending) { active=s.beat.id; post(s); paint(s); return s; }
    if (pending !== s.beat.id) request(s);
    return s;
  }
  function renderAt(t) { cur=target=clamp(t,0,1);return apply(cur); }
  function advance(t) { t=clamp(t,0,1); cur=Math.abs(t-cur)>.08 ? t : cur+(t-cur)*.14; return apply(cur); }
  function tick(){if(ready){target=clamp(scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight),0,1);advance(target)}requestAnimationFrame(tick)}
  function installInput(){var input=$("input"),touchY=null;
    function focus(){input.focus({preventScroll:true})}
    function move(y){scrollBy(0,y)}
    input.addEventListener("pointerdown",focus);
    input.addEventListener("wheel",function(e){e.preventDefault();move(e.deltaY)},{passive:false});
    input.addEventListener("touchstart",function(e){touchY=e.touches[0].clientY},{passive:true});
    input.addEventListener("touchmove",function(e){var y=e.touches[0].clientY;if(touchY!==null){e.preventDefault();move(touchY-y);touchY=y}},{passive:false});
    addEventListener("keydown",function(e){var d=0;if(e.key==="End"){e.preventDefault();scrollTo(0,document.documentElement.scrollHeight);return}if(e.key==="Home"){e.preventDefault();scrollTo(0,0);return}if(e.key==="PageDown"||e.key===" ")d=innerHeight*.82;else if(e.key==="PageUp")d=-innerHeight*.82;else if(e.key==="ArrowDown")d=80;else if(e.key==="ArrowUp")d=-80;if(d){e.preventDefault();move(d)}},true);
    focus();
  }
  function buildRuler(){$("ticks").innerHTML=D.beats.map(function(b){return '<span class="tick" style="left:'+(b.t0*100).toFixed(3)+'%"><i>'+year(b.yearsBP[0])+'</i></span>';}).join("")+'<span class="tick hot" style="left:100%"><i style="transform:translateX(-100%)">now</i></span>';}
  function wait(){if(!childReady(D.beats[0].id))return setTimeout(wait,60);ready=true;loadedSrc=source(stateFor(0));renderAt(0);frame.classList.add("on");$("bar").style.width="100%";$("status").textContent="ready · one renderer";$("load").classList.add("off")}
  function purity(){var f=[],b=[],i;for(i=0;i<=400;i++)f.push(JSON.stringify(stateFor(i/400)));for(i=400;i>=0;i--)b.unshift(JSON.stringify(stateFor(i/400)));return f.every(function(v,n){return v===b[n]})}
  Promise.all([fetch("data/film.json").then(function(r){return r.json()}),fetch("../story/narration.json").then(function(r){return r.json()})]).then(function(x){D=x[0];N=x[1];buildRuler();installInput();frame=document.createElement("iframe");frame.setAttribute("aria-label","One Ember visual scene");frame.setAttribute("tabindex","-1");$("stack").appendChild(frame);frame.src=D.beats[0].src;frame.title="Beat 1: "+D.beats[0].title;active=1;window.FILM={D:D,stateFor:stateFor,renderAt:renderAt,advance:advance,purity:purity,get active(){return active},get pending(){return pending},get ready(){return ready}};wait();requestAnimationFrame(tick)}).catch(function(e){$("status").textContent=String(e.message||e)});
}());
