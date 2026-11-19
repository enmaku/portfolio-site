// Scroll an element into view, then click it, re-measuring after the scroll settles.
import { clickAt, sleep, evalIn } from './pbui.mjs';
import { execSync } from 'node:child_process';
const selector = process.argv[2];
const text = process.argv[3];
const wait = Number(process.argv[4] || 2200);
const find = `(()=>{const els=[...document.querySelectorAll(${JSON.stringify(selector)})];const e=els.find(x=>x.innerText.trim().startsWith(${JSON.stringify(text)}));if(!e)return null;e.scrollIntoView({block:'center'});return 'ok';})()`;
await evalIn(find);
await sleep(700);
const box = await evalIn(`(()=>{const els=[...document.querySelectorAll(${JSON.stringify(selector)})];const e=els.find(x=>x.innerText.trim().startsWith(${JSON.stringify(text)}));if(!e)return null;const r=e.getBoundingClientRect();return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2});})()`);
if (!box) { console.log('NOT FOUND', text); process.exit(1); }
const b = JSON.parse(box);
await clickAt(b.x, b.y);
await sleep(wait);
console.log(execSync('node dumpdialog.mjs', { encoding: 'utf8' }));
