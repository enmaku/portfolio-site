// Dump the currently-open modal's full structure.
import { evalIn } from './pbui.mjs';
const out = await evalIn(`(()=>{
  const m = document.querySelector('.modal:last-of-type');
  if (!m) return JSON.stringify({none:true});
  const norm = s => (s||'').trim().replace(/[\\s\\u00a0]+/g,' ');
  const controls = [...m.querySelectorAll('select,input,textarea')].map(e => ({
    tag: e.tagName, type: e.type, ph: e.placeholder, val: e.value,
    opts: e.tagName === 'SELECT' ? [...e.options].map(o => o.text) : undefined,
  }));
  const buttons = [...m.querySelectorAll('.modal-button,.div-button-simple,.div-button,.section-menu,.checkbox-standard,.button-filter,.icon-spellbook,.action-icon')].map(e => ({
    cls: (typeof e.className === 'string' ? e.className : '').slice(0,60),
    txt: norm(e.innerText).slice(0,50),
    src: e.tagName === 'IMG' ? e.src.split('/').pop() : undefined,
    x: Math.round(e.getBoundingClientRect().x + e.getBoundingClientRect().width/2),
    y: Math.round(e.getBoundingClientRect().y + e.getBoundingClientRect().height/2),
    w: Math.round(e.getBoundingClientRect().width),
  })).filter(b => b.w > 0);
  return JSON.stringify({
    title: norm(m.querySelector('.dialog-title')?.textContent),
    controls, buttons,
    itemCount: m.querySelectorAll('.listview-item').length,
    items: [...m.querySelectorAll('.listview-item')].slice(0, 8).map(e => norm(e.innerText).slice(0, 90)),
    text: norm(m.innerText).slice(0, 700),
  }, null, 1);
})()`);
console.log(out);
