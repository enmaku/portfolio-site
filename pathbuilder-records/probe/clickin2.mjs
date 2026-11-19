// Scroll the left build column so the target is visible, then click it.
import { clickAt, sleep, evalIn } from './pbui.mjs';
import { execSync } from 'node:child_process';
const text = process.argv[2];
const wait = Number(process.argv[3] || 2200);
await evalIn(`(()=>{const c=document.getElementById('divBuild');const e=[...document.querySelectorAll('#divBuildLevels .listview-item,#divBuildLevels .div-button')].find(x=>x.innerText.trim().startsWith(${JSON.stringify(text)}));if(!e)return 'nf';const cr=c.getBoundingClientRect();const er=e.getBoundingClientRect();c.scrollTop += (er.top - cr.top) - 200;return 'ok';})()`);
await sleep(600);
const box = await evalIn(`(()=>{const e=[...document.querySelectorAll('#divBuildLevels .listview-item,#divBuildLevels .div-button')].find(x=>x.innerText.trim().startsWith(${JSON.stringify(text)}));if(!e)return null;const r=e.getBoundingClientRect();return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2});})()`);
if (!box) { console.log('NOT FOUND', text); process.exit(1); }
const b = JSON.parse(box);
await clickAt(b.x, b.y);
await sleep(wait);
console.log(execSync('node dumpdialog.mjs', { encoding: 'utf8' }));
