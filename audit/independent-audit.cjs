const { chromium } = require('C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const base = 'http://127.0.0.1:8123';
(async () => {
  const browser = await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const out={};
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[]; page.on('pageerror',e=>errors.push(String(e)));
  // Still inspection only. Do not use this page for timing claims.
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
  await page.goto(base+'/index.html?still=1',{waitUntil:'load'});
  await page.waitForFunction(()=>window.EMBER,{timeout:120000});
  out.tests=await page.evaluate(()=>{
    const result=[];
    for(let n=0;n<2;n++){
      const r={};for(const name of ['purity','copyCheck','law06','absence','hold']){
        EMBER[name]();r[name]=document.querySelector('#o-'+(name==='copyCheck'?'copy':name)).innerText;
      }result.push(r);
    }return result;
  });
  for(const [id,t] of [['05',.280],['06',.345],['07',.432]]){
    await page.evaluate(t=>EMBER.renderAt(t),t);
    await page.screenshot({path:path.join(__dirname,'audit-film-'+id+'.png'),timeout:120000});
  }
  await page.evaluate(()=>EMBER.renderAt(.28));
  await page.evaluate(()=>EMBER.renderAt(.31));
  out.hiddenCopy=await page.evaluate(()=>({record:document.querySelector('#record').textContent,opacity:getComputedStyle(document.querySelector('#record')).opacity,hidden:document.querySelector('#record').hidden,inert:document.querySelector('#record').inert,canvasLabels:document.querySelectorAll('canvas[aria-label]').length}));
  out.accessibility=await page.locator('body').ariaSnapshot();
  await page.emulateMedia({reducedMotion:'reduce'});
  out.liveReducedMotion=await page.locator('#gate').evaluate(e=>getComputedStyle(e).display);
  await page.setViewportSize({width:390,height:844});
  out.liveResizeGate=await page.locator('#gate').evaluate(e=>getComputedStyle(e).display);
  const atlas=await browser.newPage({viewport:{width:390,height:844}});
  await atlas.goto(base+'/atlas.html',{waitUntil:'load'});
  out.atlas=await atlas.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,images:[...document.images].map(i=>({src:i.getAttribute('src'),complete:i.complete,alt:i.alt,loading:i.loading})),links:[...document.querySelectorAll('a')].map(a=>({text:a.innerText,href:a.getAttribute('href')}))}));
  await atlas.screenshot({path:path.join(__dirname,'audit-atlas-mobile.png'),fullPage:true,timeout:120000});
  const failure=await browser.newPage({viewport:{width:1440,height:900}});
  await failure.route('**/data/bathy_sunda.png',r=>r.abort());
  await failure.goto(base+'/index.html',{waitUntil:'load'});
  out.assetFailure=await failure.locator('body').ariaSnapshot();
  const mutation=await browser.newPage({viewport:{width:1440,height:900}});
  await mutation.route('**/film.js',r=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(root,'slice/film.js'),'utf8').replace('var c = camAt(t);','var c = camAt(t); temp += 100 * Math.exp(-Math.pow((t-0.42725)/0.003,2));')}));
  await mutation.goto(base+'/index.html?nogl=1',{waitUntil:'load'});
  await mutation.waitForFunction(()=>window.EMBER,{timeout:120000});
  out.smoothCausalMutation=await mutation.evaluate(()=>({passes:EMBER.law06(),result:document.querySelector('#o-law06').innerText}));
  out.errors=errors;
  fs.writeFileSync(path.join(__dirname,'independent-audit-results.json'),JSON.stringify(out,null,2));
  console.log(JSON.stringify(out,null,2));
  await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
