// Robust UI driver for the Pathbuilder tab: real CDP mouse/keyboard events.
const TARGET = 'EB0794557D8CBD3F66551E367C61603A';
const BRIDGE = 'http://127.0.0.1:9333';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function evalIn(expr) {
  const r = await fetch(BRIDGE + '/eval', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ targetId: TARGET, expression: expr }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.value;
}
async function mouse(type, x, y, clickCount = 1) {
  await fetch(BRIDGE + '/cmd', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ targetId: TARGET, method: 'Input.dispatchMouseEvent',
      params: { type, x, y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount, pointerType: 'mouse' } }),
  });
}
export async function clickAt(x, y, count = 1) {
  await mouse('mouseMoved', x, y, 0);
  for (let i = 1; i <= count; i++) {
    await mouse('mousePressed', x, y, i);
    await mouse('mouseReleased', x, y, i);
    await sleep(50);
  }
}
// Normalizes whitespace inside the page, then finds the element.
const FIND_BY_TEXT = (text, selector) => `(()=>{
  const norm = s => s.trim().replace(/[\\s\\u00a0]+/g, ' ');
  const els = [...document.querySelectorAll(${JSON.stringify(selector)})];
  const e = els.find(x => norm(x.textContent) === ${JSON.stringify(text)} && x.getBoundingClientRect().width > 0);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
})()`;

export async function boxOf(selector, { visible = true, timeout = 5000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const v = await evalIn(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}); if(!e) return null; const r=e.getBoundingClientRect(); if(${visible} && (r.width<1||r.height<1)) return null; return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height});})()`);
    if (v) return JSON.parse(v);
    await sleep(150);
  }
  throw new Error('not visible: ' + selector);
}
export async function click(selector, { count = 1, visible = true, timeout = 5000 } = {}) {
  const b = await boxOf(selector, { visible, timeout });
  await clickAt(b.x, b.y, count);
  return b;
}
export async function clickText(text, selector = '*', { count = 1, timeout = 5000, scroll = false } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (scroll) {
      await evalIn(`(()=>{const norm=s=>s.trim().replace(/[\\s\\u00a0]+/g,' ');const els=[...document.querySelectorAll(${JSON.stringify(selector)})];const e=els.find(x=>norm(x.textContent)===${JSON.stringify(text)});if(e)e.scrollIntoView({block:'center'});return 'ok';})()`);
      await sleep(250);
    }
    const v = await evalIn(FIND_BY_TEXT(text, selector));
    if (v) { const b = JSON.parse(v); await clickAt(b.x, b.y, count); return b; }
    await sleep(150);
  }
  throw new Error('text not found: ' + text);
}
export async function typeText(text) {
  for (const ch of text) {
    await fetch(BRIDGE + '/cmd', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetId: TARGET, method: 'Input.dispatchKeyEvent', params: { type: 'keyDown', text: ch } }) });
    await fetch(BRIDGE + '/cmd', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetId: TARGET, method: 'Input.dispatchKeyEvent', params: { type: 'keyUp' } }) });
    await sleep(15);
  }
}
export async function pressKey(key, code, keyCode) {
  const p = { key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
  await fetch(BRIDGE + '/cmd', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ targetId: TARGET, method: 'Input.dispatchKeyEvent', params: { type: 'rawKeyDown', ...p } }) });
  await fetch(BRIDGE + '/cmd', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ targetId: TARGET, method: 'Input.dispatchKeyEvent', params: { type: 'keyUp', ...p } }) });
}
export async function openMenu() {
  const w = await evalIn('document.getElementById("mySidenav").getBoundingClientRect().width');
  if (w < 10) { await click('#menu'); await sleep(700); }
}
export async function dismissAlert(accept = false) {
  const has = await evalIn('!!document.querySelector(".modal .modal-button")');
  if (!has) return false;
  await clickText(accept ? 'Accept' : 'Cancel', '.modal .modal-button');
  await sleep(600);
  return true;
}
