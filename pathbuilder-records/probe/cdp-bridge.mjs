// Persistent CDP bridge: connects to Chrome DevTools browser endpoint ONCE and
// exposes a local HTTP control API so later probes reuse the same connection.
import http from 'node:http';
import fs from 'node:fs';

const WS_URL = process.argv[2];
const PORT = Number(process.argv[3] || 9333);

let ws, nextId = 1;
const pending = new Map();
const sessions = new Map();      // targetId -> sessionId
const events = [];               // ring buffer
const EVENT_CAP = 5000;
let connected = false;

function send(method, params = {}, sessionId) {
  const id = nextId++;
  const msg = { id, method, params };
  if (sessionId) msg.sessionId = sessionId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, method });
    ws.send(JSON.stringify(msg));
    setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); reject(new Error('timeout: ' + method)); }
    }, 60000);
  });
}

function connect() {
  ws = new WebSocket(WS_URL);
  ws.onopen = () => { connected = true; console.log('[bridge] connected'); };
  ws.onclose = () => { connected = false; console.log('[bridge] closed, reconnecting in 1s'); setTimeout(connect, 1000); };
  ws.onerror = (e) => console.log('[bridge] ws error', e.message || e.type);
  ws.onmessage = (e) => {
    let msg; try { msg = JSON.parse(e.data); } catch { return; }
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error))); else p.resolve(msg.result);
      return;
    }
    if (msg.method) {
      events.push({ t: Date.now(), sessionId: msg.sessionId, method: msg.method, params: msg.params });
      if (events.length > EVENT_CAP) events.splice(0, events.length - EVENT_CAP);
    }
  };
}
connect();

async function attach(targetId) {
  if (sessions.has(targetId)) return sessions.get(targetId);
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  sessions.set(targetId, sessionId);
  return sessionId;
}

async function evalIn(targetId, expression, awaitPromise = true) {
  const sessionId = await attach(targetId);
  const r = await send('Runtime.evaluate', {
    expression, awaitPromise, returnByValue: true, allowUnsafeEvalBlockedByCSP: true,
    userGesture: true,
  }, sessionId);
  if (r.exceptionDetails) return { error: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
  return { value: r.result?.value, type: r.result?.type };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let body = '';
  for await (const c of req) body += c;
  let json = {}; try { json = body ? JSON.parse(body) : {}; } catch {}
  const out = (o, code = 200) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o, null, 1)); };
  try {
    switch (url.pathname) {
      case '/status': return out({ connected, sessions: [...sessions.keys()], events: events.length });
      case '/targets': {
        const r = await send('Target.getTargets');
        return out(r.targetInfos.map(t => ({ id: t.targetId, type: t.type, title: t.title, url: t.url, attached: t.attached })));
      }
      case '/attach': return out({ sessionId: await attach(json.targetId) });
      case '/cmd': {
        const sessionId = json.targetId ? await attach(json.targetId) : undefined;
        return out(await send(json.method, json.params || {}, sessionId));
      }
      case '/eval': return out(await evalIn(json.targetId, json.expression, json.awaitPromise !== false));
      case '/nav': {
        const sessionId = await attach(json.targetId);
        await send('Page.enable', {}, sessionId);
        await send('Page.navigate', { url: json.url }, sessionId);
        return out({ ok: true });
      }
      case '/new': {
        const r = await send('Target.createTarget', { url: json.url || 'about:blank' });
        return out(r);
      }
      case '/close': return out(await send('Target.closeTarget', { targetId: json.targetId }));
      case '/events': {
        const since = json.since || 0;
        return out(events.filter(e => e.t > since).slice(-(json.limit || 200)));
      }
      case '/events/clear': { events.length = 0; return out({ ok: true }); }
      case '/screenshot': {
        const sessionId = await attach(json.targetId);
        const r = await send('Page.captureScreenshot', { format: json.format || 'png', captureBeyondViewport: !!json.full }, sessionId);
        const p = json.path || '/tmp/shot.png';
        fs.writeFileSync(p, Buffer.from(r.data, 'base64'));
        return out({ path: p, bytes: Buffer.from(r.data, 'base64').length });
      }
      case '/mouse': {
        const sessionId = await attach(json.targetId);
        const type = json.type || 'mousePressed';
        await send('Input.dispatchMouseEvent', {
          type, x: json.x, y: json.y, button: json.button || 'left',
          clickCount: json.clickCount ?? (type === 'mousePressed' ? 1 : 0),
          buttons: type === 'mousePressed' ? 1 : 0,
        }, sessionId);
        return out({ ok: true });
      }
      case '/key': {
        const sessionId = await attach(json.targetId);
        await send('Input.dispatchKeyEvent', json.event, sessionId);
        return out({ ok: true });
      }
      case '/quit': { out({ ok: true }); setTimeout(() => process.exit(0), 100); return; }
      default: return out({ error: 'unknown path', paths: ['/status','/targets','/attach','/cmd','/eval','/nav','/new','/close','/events','/events/clear','/screenshot','/mouse','/key','/quit'] }, 404);
    }
  } catch (e) { return out({ error: String(e.message || e) }, 500); }
});
server.listen(PORT, '127.0.0.1', () => console.log('[bridge] http on ' + PORT));
