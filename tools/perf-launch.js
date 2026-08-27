const puppeteer=require('puppeteer-core');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
(async()=>{
  const b=await puppeteer.launch({executablePath:CHROME,headless:false,
    args:['--no-sandbox','--window-size=1680,1050','--autoplay-policy=no-user-gesture-required']});
  const p=(await b.pages())[0];
  await p.setViewport({width:1680,height:1000,deviceScaleFactor:2});
  const errs=[];
  p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
  await p.goto('http://127.0.0.1:3000/launch.html',{waitUntil:'networkidle2'});
  await p.waitForFunction('window.LX && window.LX.Engine.duration>0');
  const r=await p.evaluate(()=>new Promise(res=>{
    const E=window.LX.Engine; E.seek(0); E.play();
    const buckets={}; let last=performance.now(); let n=0;
    const T=window.LX.Film.T;
    function key(t){return t<T.logo?'01 vacío':t<T.eco?'02 logo':t<T.dash?'03 ecosistema':
      t<T.speed?'04 interfaz':t<T.macro?'05 rampa':t<T.flow?'06 macro':t<T.dev?'07 flujo':
      t<T.whip?'08 dispositivos':t<T.final?'09 héroe':'10 ecosistema final';}
    function tick(){
      const now=performance.now(), dt=now-last; last=now; n++;
      if(n>4){const k=key(E.time);(buckets[k]||(buckets[k]=[])).push(dt);}
      if(E.time<E.duration-0.05) requestAnimationFrame(tick);
      else{
        const out={};
        Object.keys(buckets).forEach(k=>{
          const a=buckets[k].slice().sort((x,y)=>x-y);
          const avg=buckets[k].reduce((s,c)=>s+c,0)/a.length;
          out[k]={fps:+(1000/avg).toFixed(1), p95:+a[Math.floor(a.length*.95)].toFixed(1),
                  peor:+a[a.length-1].toFixed(1), caidos:a.filter(v=>v>20).length};
        });
        res({buckets:out, tier:window.LX.Quality.tier, dpr:window.devicePixelRatio});
      }
    }
    requestAnimationFrame(tick);
  }));
  console.log('tier', r.tier, '· dpr', r.dpr);
  Object.keys(r.buckets).sort().forEach(k=>{const v=r.buckets[k];
    console.log('  '+k.padEnd(20), String(v.fps).padStart(5)+' fps', ' p95 '+String(v.p95).padStart(5)+'ms',
      ' peor '+String(v.peor).padStart(6)+'ms', ' >20ms: '+v.caidos);});
  if(errs.length) console.log('\nERRORES:\n'+errs.join('\n')); else console.log('\nsin errores de consola');
  await b.close();
})();
