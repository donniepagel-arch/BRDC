const list = await (await fetch('http://localhost:9222/json')).json();
const t = list.find(x => x.type==='page' && /burningriverdarts/.test(x.url));
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id=0; const pending=new Map();
const send=(m,p={})=>{const mid=++id;return new Promise(r=>{pending.set(mid,r);ws.send(JSON.stringify({id:mid,method:m,params:p}));});};
const reqs=new Map(); // requestId -> {url, start}
const done=[];
ws.onmessage=ev=>{const m=JSON.parse(ev.data);
  if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);return;}
  if(m.method==='Network.requestWillBeSent'){const u=m.params.request.url;reqs.set(m.params.requestId,{url:u,start:m.params.timestamp});}
  if(m.method==='Network.loadingFinished'){const r=reqs.get(m.params.requestId);if(r){done.push({url:r.url,ms:Math.round((m.params.timestamp-r.start)*1000),bytes:m.params.encodedDataLength});}}
};
await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=()=>rej(new Error('ws'))});
await send('Network.enable');
await send('Page.enable');
await send('Page.navigate',{url:'https://burningriverdarts.com/pages/home-vnext.html?_cb=perf'+Math.floor(Math.random()*9999)});
await new Promise(r=>setTimeout(r,20000));
ws.close();
// filter to data calls (functions + firestore), sort slowest
const data=done.filter(d=>/cloudfunctions|firestore|run\.app|functions/.test(d.url)).sort((a,b)=>b.ms-a.ms);
const fn=u=>{const m=u.match(/cloudfunctions\.net\/(\w+)/)||u.match(/firestore.*\/(documents.*)/);return m?m[1].slice(0,40):u.split('?')[0].split('/').slice(-1)[0].slice(0,40);};
console.log('SLOWEST DATA CALLS (ms):');
data.slice(0,18).forEach(d=>console.log(String(d.ms).padStart(6)+'ms  '+(d.bytes||0+'').toString().padStart(7)+'b  '+fn(d.url)));
console.log('\nTOTAL data calls:',data.length,' | sum ms:',data.reduce((a,b)=>a+b.ms,0));
