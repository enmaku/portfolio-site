import { clickAt, sleep, evalIn } from './pbui.mjs';
const idx = Number(process.argv[2] || 0);
const b = JSON.parse(await evalIn(`(()=>{const e=[...document.querySelectorAll('#id_parent_feats .div-button')][${idx}]; const r=e.getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2,t:e.innerText.split('\\n').join('|')});})()`));
console.log('clicking', b.t, b.x, b.y);
await clickAt(b.x, b.y);
await sleep(2200);
console.log(await evalIn(`JSON.stringify({
  title: document.querySelector('#root .dialog-title')?.textContent,
  tabs: [...document.querySelectorAll('#root .section-menu')].map(e => e.textContent.trim()),
  n: document.querySelectorAll('#content .listview-item').length,
  first: [...document.querySelectorAll('#content .listview-item')].slice(0, 6).map(e => e.innerText.split('\\n').join(' | ').slice(0, 70)),
})`));
