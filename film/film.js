/* The master shell owns one deep-time t and commits a scene only after a frame exists. */
(function () { "use strict";
  var D, N, frame, committed, staging = null, retiring = null;
  var active = null, pending = null, ready = false, target = 0, cur = 0, failedTarget = null, childFrames = {}, lastTick = performance.now(), syncingScroll = false;
  var still, stillContext, bridge, tier;
  var diag = window.EMBER_DIAGNOSTICS || {record:function(){},childResources:function(){return {};},snapshot:function(){return {capability:{}};}};
  var $ = function (id) { return document.getElementById(id); };
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, f) { return a + (b - a) * f; }
  function stateFor(t) { t = clamp(t, 0, 1); var beat = D.beats[D.beats.length - 1];
    for (var i = 0; i < D.beats.length - 1; i++) if (t < D.beats[i].t1) { beat = D.beats[i]; break; }
    var local = clamp((t - beat.t0) / (beat.t1 - beat.t0), 0, 1);
    return {t:t,beat:beat,localT:local,yearBP:lerp(beat.yearsBP[0],beat.yearsBP[1],local)}; }
  function beatFor(id) { return D.beats.filter(function(b){return b.id===id;})[0]; }
  function childT(s) { return s.beat.id >= 5 && s.beat.id <= 7 ? s.t : s.localT; }
  function source(s) { var url=new URL(s.beat.src, location.href);url.searchParams.set("pixelRatio",resolution());return url.href; }
  function segment(s) { var narration=N.beats[s.beat.id-1], a=narration.segments, n=a.length;
    if (!n || s.localT < .10 || s.localT > .82) return "";
    return a[Math.min(n-1,Math.floor((s.localT-.10)/(.72/n)))]; }
  function year(y) { return y >= 1000 ? (y/1000).toFixed(y%1000?1:0)+" KA" : Math.round(y)+" BP"; }
  function paint(s) { $("act").textContent="Beat "+String(s.beat.id).padStart(2,"0")+" · "+year(s.beat.yearsBP[0])+" — "+year(s.beat.yearsBP[1]); $("title").textContent=s.beat.title;
    var text=segment(s); $("subtitle").textContent=text; $("subtitle").classList.toggle("on",!!text); updateRuler(s); }
  function renderer(scene, id) { var w=scene && scene.frame && scene.frame.contentWindow; return w && (id===12 ? w.UNROLL : w["EMBER"+id]); }
  function frameReady(scene, id) { return !!(scene && scene.frames && scene.frames[id]); }
  function ownState(t) { var b=beatFor(active), edge=Math.max(b.t0,b.t1-.000001); return stateFor(clamp(t,b.t0,edge)); }
  function resolution() { var budget=tier&&tier.concurrent?2500000:1050000, native=devicePixelRatio||1, fit=Math.sqrt(budget/Math.max(1,innerWidth*innerHeight)); return Math.max(.65,Math.min(2,native,fit)); }
  function renderTo(scene, s) { var w=scene && scene.frame.contentWindow, r=renderer(scene,s.beat.id); if(!w)return;
    try { if(r && r.renderAt) r.renderAt(childT(s)); } catch(e) { diag.record("child-render-error",{beat:s.beat.id,message:String(e.message||e)}); }
    w.postMessage({type:"one-ember:external-t",active:true,t:childT(s),presentation:true,pixelRatio:resolution()}, location.origin); }
  function sceneForWindow(w) { if(staging && staging.frame.contentWindow===w)return staging; if(committed && committed.frame.contentWindow===w)return committed; if(retiring && retiring.frame.contentWindow===w)return retiring; return null; }
  function capabilities() { var c=(diag.snapshot().capability||{}), memory=navigator.deviceMemory, cores=navigator.hardwareConcurrency, concurrent=!!c.webgl&&!c.saveData&&!c.reducedMotion&&innerWidth>=800&&innerHeight>=600&&(!memory||memory>=4)&&(!cores||cores>=4);
    return {concurrent:concurrent,name:concurrent?"concurrent":"serial"}; }
  /* Beats 05–07 deliberately gate their detailed globe below this viewport.
     Route before staging anything so a narrow reader gets the complete atlas,
     never a technical child-loader timeout. */
  function readableReason() { var c=diag.snapshot().capability||{};if(!c.webgl)return "no-webgl";if(innerWidth<1280||innerHeight<700)return "narrow";return ""; }
  function timeoutOverride() { var requested=Number(new URLSearchParams(location.search).get("stage-timeout")); return diag.enabled&&isFinite(requested)&&requested>0 ? requested : 0; }
  /* A hidden rich preload should be quick. A longer wait is only useful once
     we have fallen back to the one-context serial path. */
  function stageBudget(serial) { var requested=timeoutOverride(); return requested || (serial ? 30000 : 8000); }
  function installStageSurface() { var style=document.createElement("style");
    style.textContent="#stack iframe.scene{z-index:0;transition:opacity .22s ease}#stack iframe.scene.incoming{z-index:1}#still{position:fixed;inset:0;z-index:3;width:100%;height:100%;display:none;background:#04060a;pointer-events:none}#still.on{display:block}#bridge{position:fixed;inset:0;z-index:4;display:none;place-content:center;text-align:center;padding:32px;color:#8fa8c4;font:400 11px/1.6 var(--mono);letter-spacing:.1em;text-transform:uppercase;pointer-events:none}#bridge.on{display:grid}#bridge>div{padding:10px 12px;background:rgba(4,6,10,.8)}#bridge button,#bridge a{margin:10px 5px 0;padding:7px 10px;border:1px solid #647c99;background:#04060a;color:#e6e2d8;font:inherit;text-decoration:none;pointer-events:auto}#ruler{pointer-events:auto}#ruler .tick{padding:0;border:0;background:none;cursor:pointer;pointer-events:auto;transform:translateX(-50%)}#ruler .tick:first-child{transform:none}#ruler .tick:last-child{transform:translateX(-100%)}#ruler .tick:focus-visible{outline:1px solid #e6e2d8;outline-offset:4px}#ruler .tick[aria-current=true]{border-left:1px solid #e6e2d8}#destination{position:absolute;top:-5px;height:9px;border-left:1px dashed #8fa8c4;transition:left .16s linear;pointer-events:none}";
    document.head.appendChild(style); still=document.createElement("canvas"); still.id="still"; still.setAttribute("aria-hidden","true"); document.body.appendChild(still); stillContext=still.getContext("2d"); bridge=document.createElement("div"); bridge.id="bridge"; bridge.setAttribute("role","status"); document.body.appendChild(bridge); var marker=document.createElement("i");marker.id="destination";$("ruler").appendChild(marker); }
  function hideBridge() { bridge.classList.remove("on"); bridge.replaceChildren(); }
  function captureStill(scene) { try { var doc=scene.frame.contentDocument, canvases=doc&&doc.querySelectorAll("canvas"); if(!canvases||!canvases.length)return false;
      var scale=Math.min(1.25,devicePixelRatio||1), w=Math.max(1,Math.round(innerWidth*scale)), h=Math.max(1,Math.round(innerHeight*scale)); still.width=w;still.height=h;stillContext.fillStyle="#04060a";stillContext.fillRect(0,0,w,h);
      Array.prototype.forEach.call(canvases,function(canvas){stillContext.drawImage(canvas,0,0,w,h);}); still.classList.add("on"); return true;
    } catch(e) { diag.record("still-capture-error",{message:String(e.message||e)}); return false; } }
  function hideStill() { still.classList.remove("on"); still.width=1; still.height=1; }
  function bridgeMessage(message, retry) { bridge.replaceChildren(); var line=document.createElement("div");line.textContent=message;bridge.appendChild(line);
    if(retry){var button=document.createElement("button");button.type="button";button.textContent="Retry scene";button.onclick=function(){var wanted=failedTarget;hideBridge();if(wanted!==null)renderAt(wanted);};bridge.appendChild(button);}
    var link=document.createElement("a");link.href="atlas.html";link.textContent="Open readable atlas";bridge.appendChild(link);bridge.classList.add("on"); }
  function makeScene(s, incoming) { var f=document.createElement("iframe"), scene={frame:f,beat:s.beat.id,src:source(s),frames:{},createdAt:performance.now(),serial:false};
    f.className="scene"+(incoming?" incoming":""); f.setAttribute("aria-label","One Ember visual scene"); f.setAttribute("tabindex","-1"); f.title="Beat "+scene.beat+": "+s.beat.title;
    f.addEventListener("load",function(){diag.record("iframe-load",{beat:scene.beat,staged:!!incoming,resources:diag.childResources(f)});}); $("stack").appendChild(f); f.src=scene.src; return scene; }
  function rendererCount() { return $("stack").querySelectorAll("iframe").length; }
  function dispose(scene, reason) { if(!scene)return; if(scene.timer)clearTimeout(scene.timer); if(scene.serial)return;
    /* Explicitly unload a retired renderer before detaching it.  Removing an
       iframe alone can defer WebGL context reclamation long enough for a rapid
       multi-beat journey to hit Chromium's context limit. */
    try { Array.prototype.forEach.call(scene.frame.contentDocument.querySelectorAll("canvas"),function(canvas){
      var gl=canvas.getContext("webgl2")||canvas.getContext("webgl"), loss=gl&&gl.getExtension("WEBGL_lose_context");
      if(loss)loss.loseContext();
    }); scene.frame.src="about:blank"; } catch (_) {}
    if(scene.frame.parentNode)scene.frame.remove(); diag.record("dispose",{beat:scene.beat,reason:reason,lifetimeMs:Math.round(performance.now()-scene.createdAt),rendererCount:rendererCount()}); }
  function cancelStage(reason, replacement) { if(!staging)return; diag.record("cancel",{beat:staging.beat,replacedBy:replacement||null,reason:reason}); if(staging.serial){hideStill();hideBridge();}dispose(staging,reason);staging=null; }
  function transitionDone() { if(retiring){dispose(retiring,"crossfade-complete");retiring=null;} apply(cur); }
  function commitRich(stage) { if(staging!==stage || stateFor(cur).beat.id!==stage.beat)return; var s=stateFor(cur), old=committed;
    renderTo(stage,s); staging=null; if(stage.timer)clearTimeout(stage.timer); committed=stage;frame=stage.frame;active=stage.beat;pending=null;childFrames=Object.assign({},stage.frames);paint(s);frame.classList.add("on");
    retiring=old; diag.record("commit",{beat:active,requestedT:s.t,tier:tier.name,stagingMs:Math.round(performance.now()-stage.createdAt)}); setTimeout(transitionDone,230); }
  function commitSerial(stage) { if(staging!==stage || stateFor(cur).beat.id!==stage.beat)return; var s=stateFor(cur); if(stage.timer)clearTimeout(stage.timer);
    renderTo(stage,s);staging=null;committed=stage;frame=stage.frame;active=stage.beat;pending=null;childFrames=Object.assign({},stage.frames);paint(s);frame.classList.add("on");hideStill();hideBridge();diag.record("commit",{beat:active,requestedT:s.t,tier:tier.name,stagingMs:Math.round(performance.now()-stage.createdAt)}); }
  function holdCommitted() { var held=ownState(cur);cur=target=held.t;scrollTo(0,target*Math.max(1,document.documentElement.scrollHeight-innerHeight));pending=null; }
  function restoreSerial(stage) { var old=stage.previous;failedTarget=cur;if(stage.timer)clearTimeout(stage.timer);
    /* Do not let the virtual timeline immediately cancel this restoration and
       queue the failed destination again. Preserve that destination only for
       the explicit Retry control. */
    holdCommitted();staging={frame:stage.frame,beat:old.beat,src:old.src,frames:{},serial:true,restoring:true,createdAt:performance.now()}; frame=stage.frame; frame.title="Beat "+old.beat+": "+beatFor(old.beat).title; frame.src=old.src; bridgeMessage("The next scene could not be prepared. Restoring the committed scene.",false); }
  function stageTimeout(stage) { if(staging!==stage)return;diag.record("stage-timeout",{beat:stage.beat,tier:tier.name});
    /* A capability probe cannot predict temporary context pressure. Retry once
       with one live renderer and a smaller pixel budget before showing failure
       UI; the committed scene remains visible throughout the downgrade. */
    if(!stage.serial&&tier.concurrent&&!timeoutOverride()){var requested=stateFor(cur);dispose(stage,"rich-timeout");staging=null;tier={concurrent:false,name:"serial"};if(diag.setQualityTier)diag.setQualityTier(tier.name);diag.record("tier-downgrade",{beat:requested.beat.id,reason:"rich-stage-timeout",retryTier:tier.name});startStage(requested);return;}
    if(stage.serial){restoreSerial(stage);return;}failedTarget=cur;dispose(stage,"timeout");staging=null;holdCommitted();bridgeMessage("The next scene did not become ready. The committed scene remains visible.",true); }
  function startStage(s) { if(retiring){pending=s.beat.id;return;} var serial=!tier.concurrent, stage;
    if(serial){renderTo(committed,ownState(cur)); var previous={beat:active,src:committed.src}; captureStill(committed); bridgeMessage("Holding this moment while the next scene prepares.",false); committed.frame.classList.remove("on"); stage={frame:committed.frame,beat:s.beat.id,src:source(s),frames:{},createdAt:performance.now(),serial:true,previous:previous}; frame=stage.frame;frame.title="Beat "+stage.beat+": "+s.beat.title;frame.src=stage.src;
    }else stage=makeScene(s,true);
    staging=stage;pending=s.beat.id;failedTarget=null;var timeoutMs=stageBudget(serial);diag.record("stage-create",{beat:stage.beat,requestedT:s.t,tier:tier.name,concurrent:!serial,rendererCount:rendererCount(),timeoutMs:timeoutMs});stage.timer=setTimeout(function(){stageTimeout(stage);},timeoutMs); }
  function request(s) { if(staging && staging.beat===s.beat.id)return; if(staging)cancelStage("target-changed",s.beat.id); startStage(s); }
  function apply(t) { if(!ready)return stateFor(t); var s=stateFor(t);
    if(active===s.beat.id){if(staging){if(staging.serial&&!staging.restoring){restoreSerial(staging);return s;}if(!staging.serial){cancelStage("returned-to-committed",s.beat.id);pending=null;}}if(!staging){renderTo(committed,s);paint(s);return s;}}
    if(active!==null){var held=ownState(t);renderTo(committed,held);paint(held);}
    if(!staging || staging.beat!==s.beat.id)request(s); return s; }
  function maxScroll() { return Math.max(1,document.documentElement.scrollHeight-innerHeight); }
  function syncTimeline(t) { syncingScroll=true;scrollTo(0,t*maxScroll());requestAnimationFrame(function(){syncingScroll=false;}); }
  function setDestination(t, reason, sync) { var next=clamp(t,0,1);if(next===target)return;target=next;if(sync!==false)syncTimeline(target);diag.record("destination",{t:target,beat:stateFor(target).beat.id,reason:reason});updateRuler(ownState(cur)); }
  function nudge(delta, reason) { setDestination(target+clamp(delta,-1200,1200)/16000,reason); }
  function renderAt(t) { cur=target=clamp(t,0,1);syncTimeline(target);return apply(cur); }
  function tick(now){var elapsed=Math.min(.1,Math.max(.001,(now-lastTick)/1000));lastTick=now;if(ready){var distance=target-cur,step=Math.sign(distance)*Math.min(Math.abs(distance),elapsed*.18);cur=clamp(cur+step,0,1);apply(cur);}requestAnimationFrame(tick);}
  addEventListener("message",function(e){var m=e.data;if(!m||m.type!=="one-ember:child-ready")return;var owner=sceneForWindow(e.source);if(!owner)return;
    (m.covers||[m.beat]).forEach(function(id){owner.frames[id]=m;childFrames[id]=m;});diag.record("child-first-frame",{beat:m.beat,covers:m.covers,handle:m.handle,firstFrameAt:m.firstFrameAt,loaderHidden:m.loaderHidden,staged:owner===staging});
    if(owner===committed&&!ready&&frameReady(committed,1)){ready=true;active=1;frame=committed.frame;renderTo(committed,stateFor(0));frame.classList.add("on");$("bar").style.width="100%";$("status").textContent="ready · "+tier.name;$("load").classList.add("off");paint(stateFor(0));diag.record("initial-ready",{beat:1,resources:diag.childResources(frame),firstMeaningfulFrame:committed.frames[1].firstFrameAt});}
    if(owner===staging&&frameReady(staging,staging.beat)){diag.record("stage-first-frame",{beat:staging.beat,firstFrameAt:staging.frames[staging.beat].firstFrameAt,tier:tier.name});if(staging.restoring){var restored=staging;staging=null;active=restored.beat;committed={frame:restored.frame,beat:restored.beat,src:restored.src,frames:restored.frames,createdAt:restored.createdAt,serial:true};frame=committed.frame;holdCommitted();frame.classList.add("on");hideStill();bridgeMessage("The previous scene is restored. You can retry when ready.",true);return;}if(staging.serial)commitSerial(staging);else requestAnimationFrame(function(){commitRich(owner);});}
  });
  function chapter(delta) { var current=stateFor(target).beat.id,next=clamp(current-1+delta,0,D.beats.length-1);setDestination(D.beats[next].t0,delta>0?"next-chapter":"previous-chapter"); }
  function installInput(){var input=$("input"),touchY=null;function focus(){input.focus({preventScroll:true});}input.addEventListener("pointerdown",focus);input.addEventListener("wheel",function(e){e.preventDefault();nudge(e.deltaY,"wheel");},{passive:false});input.addEventListener("touchstart",function(e){touchY=e.touches[0].clientY;},{passive:true});input.addEventListener("touchmove",function(e){var y=e.touches[0].clientY;if(touchY!==null){e.preventDefault();nudge(touchY-y,"touch");touchY=y;}},{passive:false});addEventListener("scroll",function(){if(!syncingScroll)setDestination(scrollY/maxScroll(),"scrollbar",false);},{passive:true});addEventListener("keydown",function(e){var d=0;if(e.key==="End"){e.preventDefault();setDestination(1,"end");return;}if(e.key==="Home"){e.preventDefault();setDestination(0,"home");return;}if(e.key==="]"){e.preventDefault();chapter(1);return;}if(e.key==="["){e.preventDefault();chapter(-1);return;}if(e.key==="PageDown"||e.key===" ")d=.075;else if(e.key==="PageUp")d=-.075;else if(e.key==="ArrowDown")d=.012;else if(e.key==="ArrowUp")d=-.012;if(d){e.preventDefault();setDestination(target+d,"keyboard");}},true);focus();}
  function updateRuler(s) { var progress=$("progress"),marker=$("destination");if(progress)progress.style.width=(s.t*100).toFixed(3)+"%";if(marker)marker.style.left=(target*100).toFixed(3)+"%";Array.prototype.forEach.call($("ticks").querySelectorAll("button"),function(button){button.setAttribute("aria-current",String(+button.dataset.beat===s.beat.id));}); }
  function buildRuler(){var ticks=$("ticks"),ruler=$("ruler");ruler.removeAttribute("aria-hidden");ruler.setAttribute("aria-label","Choose a destination chapter");ticks.innerHTML=D.beats.map(function(b){return '<button class="tick" type="button" data-beat="'+b.id+'" data-t="'+b.t0+'" style="left:'+(b.t0*100).toFixed(3)+'%" aria-label="Travel to Beat '+String(b.id).padStart(2,"0")+': '+b.title+'"><i>'+year(b.yearsBP[0])+'</i></button>';}).join("")+'<button class="tick hot" type="button" data-beat="15" data-t="1" style="left:100%" aria-label="Travel to now"><i>now</i></button>';ticks.addEventListener("click",function(e){var button=e.target.closest("button[data-t]");if(button)setDestination(+button.dataset.t,"ruler");});}
  function purity(){var f=[],b=[],i;for(i=0;i<=400;i++)f.push(JSON.stringify(stateFor(i/400)));for(i=400;i>=0;i--)b.unshift(JSON.stringify(stateFor(i/400)));return f.every(function(v,n){return v===b[n];});}
  Promise.all([fetch("data/film.json").then(function(r){return r.json();}),fetch("../story/narration.json").then(function(r){return r.json();})]).then(function(x){D=x[0];N=x[1];var reader=readableReason();if(reader){location.replace("atlas.html?reason="+reader);return;}tier=capabilities();if(diag.setQualityTier)diag.setQualityTier(tier.name);installStageSurface();buildRuler();installInput();committed=makeScene(stateFor(0),false);frame=committed.frame;active=1;window.FILM={D:D,stateFor:stateFor,renderAt:renderAt,purity:purity,diagnostics:function(){return window.EMBER_DIAGNOSTICS.snapshot();},get childFrames(){return Object.assign({},childFrames);},get active(){return active;},get pending(){return pending;},get ready(){return ready;},get tier(){return Object.assign({},tier);},get target(){return target;},get current(){return cur;},get resolution(){return resolution();},get staging(){return staging&&{beat:staging.beat,serial:staging.serial};}};requestAnimationFrame(tick);}).catch(function(e){diag.record("boot-error",{message:String(e.message||e)});$("status").textContent=String(e.message||e);});
}());
