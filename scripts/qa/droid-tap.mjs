import fs from 'fs';
const list = await (await fetch('http://localhost:9222/json')).json();
const t = list.find(x => x.type==='page' && /burningriverdarts/.test(x.url));
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id=0; const pending=new Map();
const send=(method,params={})=>{const mid=++id;return new Promise(r=>{pending.set(mid,r);ws.send(JSON.stringify({id:mid,method,params}));});};
ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=()=>rej(new Error('ws'));});
await send('Runtime.enable'); await send('Page.enable');
const seq = JSON.parse(fs.readFileSync('scripts/qa/_taps.json','utf8')); // array of button labels OR {label} OR {x,y}
const center = async (label) => {
  const r = await send('Runtime.evaluate', { returnByValue:true, expression:
    `(()=>{const b=[...document.querySelectorAll('button,span.dart-label,.checkout-dart')].find(x=>(x.textContent||'').trim()===${JSON.stringify(label)}); if(!b)return null; const r=b.getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2};})()` });
  return r.result?.result?.value;
};
for (const label of seq) {
  const c = await center(label);
  if (!c) { console.log('MISS: '+label); continue; }
  await send('Input.dispatchMouseEvent', { type:'mousePressed', x:c.x, y:c.y, button:'left', clickCount:1 });
  await send('Input.dispatchMouseEvent', { type:'mouseReleased', x:c.x, y:c.y, button:'left', clickCount:1 });
  await new Promise(r=>setTimeout(r,550));
}
// read result
const fin = await send('Runtime.evaluate', { returnByValue:true, expression:
  `(()=>{const t=(document.body.innerText||'').replace(/\s+/g,' ');const h=t.match(/PLAYER 1 (\d+)/);const a=t.match(/PLAYER 2 (\d+)/);return JSON.stringify({p1:h?h[1]:'?',p2:a?a[1]:'?',snip:t.slice(0,90)});})()` });
ws.close();
console.log(fin.result?.result?.value);
