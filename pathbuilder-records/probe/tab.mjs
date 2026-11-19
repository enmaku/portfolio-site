import { clickText, sleep, evalIn } from './pbui.mjs';
const name = process.argv[2];
await clickText(name, '.section-menu');
await sleep(1600);
const out = await evalIn(`(()=>{
  const d = document.querySelector('.tabbed-area-display');
  const norm = s => (s||'').trim().replace(/[\\s\\u00a0]+/g,' ');
  const btns = [...d.querySelectorAll('.div-button-simple,.div-button,.section-menu,.listview-item,.checkbox-standard,.button-filter,.icon-spellbook,.prof-layout,.spell-button-row')]
    .map(e => ({ cls:(typeof e.className==='string'?e.className:'').slice(0,55), txt:norm(e.innerText).slice(0,70),
                 x:Math.round(e.getBoundingClientRect().x+e.getBoundingClientRect().width/2),
                 y:Math.round(e.getBoundingClientRect().y+e.getBoundingClientRect().height/2),
                 w:Math.round(e.getBoundingClientRect().width) }))
    .filter(b=>b.w>0);
  return JSON.stringify({ text: norm(d.innerText).slice(0,2500), buttons: btns.slice(0,60) }, null, 1);
})()`);
console.log(out);
