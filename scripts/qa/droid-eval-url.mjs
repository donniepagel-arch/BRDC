import fs from 'fs';
const list = await (await fetch('http://localhost:9222/json')).json();
const t = list.find(x => x.type === 'page' && new RegExp(process.argv[3] || "burningriverdarts").test(x.url)) || list.find(x => x.type === 'page');
if (!t) { console.log(JSON.stringify({error:'no page target'})); process.exit(0); }
const WS = t.webSocketDebuggerUrl;
const exprFile = process.argv[2] || 'scripts/qa/_expr.js';
const expression = fs.readFileSync(exprFile, 'utf8');
const ws = new WebSocket(WS);
let id = 0; const pending = new Map(); const consoleErrs = [];
const send = (method, params={}) => { const mid = ++id; return new Promise(res => { pending.set(mid, res); ws.send(JSON.stringify({id:mid, method, params})); }); };
ws.onmessage = (ev) => { const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') consoleErrs.push(m.params.args.map(a=>a.value||a.description||'').join(' ').slice(0,150));
  if (m.method === 'Runtime.exceptionThrown') consoleErrs.push('EXC: ' + (m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text||'').slice(0,150));
};
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws fail')); });
await send('Runtime.enable');
const r = await send('Runtime.evaluate', { expression, awaitPromise:true, returnByValue:true, userGesture:true });
await new Promise(res => setTimeout(res, 250));
ws.close();
console.log(JSON.stringify({ target: t.url.slice(0,60), value: r.result?.result?.value, exception: r.result?.exceptionDetails?.exception?.description || r.result?.exceptionDetails?.text, consoleErrors: [...new Set(consoleErrs)].slice(0,8) }));
