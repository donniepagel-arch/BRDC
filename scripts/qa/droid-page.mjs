import fs from 'fs';
const url = process.argv[2];
const list = await (await fetch('http://localhost:9222/json')).json();
const t = list.find(x => x.type==='page' && /burningriverdarts/.test(x.url));
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id=0; const pending=new Map(); const errs=[];
const send=(m,p={})=>{const mid=++id;return new Promise(r=>{pending.set(mid,r);ws.send(JSON.stringify({id:mid,method:m,params:p}));});};
ws.onmessage=ev=>{const m=JSON.parse(ev.data);
  if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}
  if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errs.push(m.params.args.map(a=>a.value||a.description||'').join(' ').slice(0,150));
  if(m.method==='Runtime.exceptionThrown')errs.push('EXC: '+(m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text||'').slice(0,150));
};
await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=()=>rej(new Error('ws'))});
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate',{url});
await new Promise(r=>setTimeout(r,13000));
const r=await send('Runtime.evaluate',{returnByValue:true,expression:`(()=>{const t=(document.body.innerText||'').replace(/\s+/g,' ');return JSON.stringify({title:document.title,len:t.length,hasErr:/error|failed|missing |undefined|unexpected/i.test(t),snippet:t.slice(0,120)});})()`});
ws.close();
console.log(JSON.stringify({url:url.split('/pages/')[1].split('?')[0], render:JSON.parse(r.result.result.value), consoleErrors:[...new Set(errs)].slice(0,5)}));
