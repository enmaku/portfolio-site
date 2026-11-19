const url = 'ws://127.0.0.1:9222/devtools/browser/240ef7a8-acb6-458c-915b-b4249f487193';
const ws = new WebSocket(url);
ws.onopen = () => { console.log('OPEN'); ws.send(JSON.stringify({id:1, method:'Target.getTargets'})); };
ws.onmessage = (e) => { console.log('MSG', String(e.data).slice(0,3000)); ws.close(); };
ws.onerror = (e) => { console.log('ERR', e.message || e.type); };
ws.onclose = (e) => { console.log('CLOSE', e.code, e.reason); process.exit(0); };
setTimeout(()=>{console.log('TIMEOUT');process.exit(1)}, 8000);
