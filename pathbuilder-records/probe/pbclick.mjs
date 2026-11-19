// Click an element by CSS selector or by text, using real CDP mouse events.
const TARGET = 'EB0794557D8CBD3F66551E367C61603A';
const BRIDGE = 'http://127.0.0.1:9333';

async function evalIn(expr) {
  const r = await fetch(BRIDGE + '/eval', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ targetId: TARGET, expression: expr }),
  });
  return (await r.json()).value;
}
async function mouse(type, x, y, clickCount = 1) {
  await fetch(BRIDGE + '/cmd', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ targetId: TARGET, method: 'Input.dispatchMouseEvent',
      params: { type, x, y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount, pointerType: 'mouse' } }),
  });
}
async function clickAt(x, y, count = 1) {
  await mouse('mouseMoved', x, y, 0);
  for (let i = 1; i <= count; i++) {
    await mouse('mousePressed', x, y, i);
    await mouse('mouseReleased', x, y, i);
    await new Promise(r => setTimeout(r, 40));
  }
}
const [mode, arg, arg2] = process.argv.slice(2);
if (mode === 'sel') {
  const box = await evalIn(`(()=>{const e=document.querySelector(${JSON.stringify(arg)}); if(!e) return null; const r=e.getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height});})()`);
  if (!box) { console.log('NOT FOUND', arg); process.exit(1); }
  const b = JSON.parse(box);
  await clickAt(b.x, b.y, Number(arg2 || 1));
  console.log('clicked', arg, 'at', Math.round(b.x), Math.round(b.y));
} else if (mode === 'text') {
  const box = await evalIn(`(()=>{const els=[...document.querySelectorAll(${JSON.stringify(arg2 || '*')})]; const e=els.find(x=>x.textContent.trim()===${JSON.stringify(arg)} && x.getBoundingClientRect().width>0); if(!e) return null; const r=e.getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2});})()`);
  if (!box) { console.log('NOT FOUND', arg); process.exit(1); }
  const b = JSON.parse(box);
  await clickAt(b.x, b.y, 1);
  console.log('clicked text', arg, 'at', Math.round(b.x), Math.round(b.y));
} else if (mode === 'xy') {
  await clickAt(Number(arg), Number(arg2), 1);
  console.log('clicked', arg, arg2);
}
