import fs from 'node:fs';
import path from 'node:path';

const BRIDGE = 'http://127.0.0.1:9333';
const TID = 'EB0794557D8CBD3F66551E367C61603A';
const OUT = '/Users/enmaku/code/pathbuilder-clone/docs/img';
fs.mkdirSync(OUT, { recursive: true });

const post = async (p, body) => {
  const r = await fetch(BRIDGE + p, { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(body) });
  return r.json();
};
export const ev = async (expr) => {
  const r = await post('/eval', { targetId: TID, expression: expr });
  if (r.error) throw new Error(r.error);
  return r.value;
};
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const shot = async (name, full = false) => {
  const p = path.join(OUT, name + '.png');
  await post('/screenshot', { targetId: TID, path: p, full });
  const sz = fs.statSync(p).size;
  console.log('shot', name, sz);
  return p;
};
// Click an element matched by JS predicate string, returning info
export const clickJs = async (finder) => ev(`(()=>{const e=${finder}; if(!e) return 'NF'; e.click(); return 'OK';})()`);
export const closeModal = async () => ev(`(()=>{const ms=document.querySelectorAll('.modal'); if(!ms.length) return 'none';
  const m=ms[ms.length-1];
  const btn=[...m.querySelectorAll('.modal-button')].find(b=>/^(Cancel|Close|Finished|Ok|OK)$/i.test(b.innerText.trim()));
  m.remove(); return 'removed';})()`);
export const closeAll = async () => ev(`(()=>{let n=0; document.querySelectorAll('.modal').forEach(m=>{m.remove();n++}); document.getElementById('backdrop')?.classList.add('hidden'); return n;})()`);

export const clickId = async (id) => ev(`(()=>{const e=document.getElementById(${JSON.stringify(id)}); if(!e) return 'NF'; e.click(); return 'OK';})()`);
export const clickSel = async (sel, idx=0) => ev(`(()=>{const e=document.querySelectorAll(${JSON.stringify(sel)})[${idx}]; if(!e) return 'NF'; e.click(); return 'OK';})()`);
export const clickText = async (sel, text) => ev(`(()=>{
  const leaf=[...document.querySelectorAll(${JSON.stringify(sel)})].filter(e=>e.children.length===0 && e.innerText.trim()===${JSON.stringify(text)});
  if(!leaf.length) return 'NF';
  const el=leaf[0];
  let n=el;
  while(n && !/div-button|sidenav-link|div-button-simple|section-menu|modal-button|button-money|listview-item|cogButton/.test(n.className)) n=n.parentElement;
  (n||el).click();
  return 'OK';
})()`);
export const modalTitle = async () => ev(`(()=>{const m=document.querySelector('.modal:last-of-type'); return m? (m.querySelector('.dialog-title')?.innerText||'(no title)') : null;})()`);
export const nmodals = async () => ev(`document.querySelectorAll('.modal').length`);
export const modalInfo = async () => ev(`(()=>{const m=document.querySelector('.modal:last-of-type'); if(!m) return null;
  return JSON.stringify({title:m.querySelector('.dialog-title')?.innerText, w:m.getBoundingClientRect().width, h:m.getBoundingClientRect().height,
   buttons:[...m.querySelectorAll('.modal-button')].map(b=>b.innerText), tabs:[...m.querySelectorAll('.section-menu-sb')].map(b=>b.innerText)});})()`);
