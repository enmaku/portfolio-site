import { clickAt, sleep, evalIn } from './pbui.mjs';
const name = process.argv[2];
const b = JSON.parse(await evalIn(`(()=>{const e=[...document.querySelectorAll('.section-menu')].find(x=>x.textContent.trim()===${JSON.stringify(name)} && x.getBoundingClientRect().width>0); if(!e) return 'null'; const r=e.getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2});})()`));
if (!b) { console.log('not found'); process.exit(1); }
await clickAt(b.x, b.y);
await sleep(1600);
console.log(await evalIn(`(()=>{const d=document.querySelector('.tabbed-area-display'); const norm=s=>(s||'').trim().replace(/[\\s\\u00a0]+/g,' '); return JSON.stringify({sel:[...document.querySelectorAll('.section-menu')].filter(e=>e.className.includes('selected')).map(e=>e.textContent.trim()), text:norm(d.innerText).slice(0,2000)},null,1);})()`));
