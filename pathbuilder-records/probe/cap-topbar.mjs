import * as C from './capture.mjs';
const s = C.sleep;
await C.closeAll();
// close the sidebar if open
await C.ev(`(()=>{const n=document.getElementById('mySidenav'); n.style.width='0em'; document.getElementById('backdrop').classList.add('hidden'); return 1})()`);
await s(400);
console.log('LVL', await C.ev(`(()=>{const b=[...document.querySelectorAll('.top-bar .div-button')].find(e=>e.innerText.replace(/\\n/g,'|').startsWith('Level|')); if(!b) return 'NF'; b.click(); return 'OK';})()`));
await s(900); console.log(await C.modalInfo()); await C.shot('84-set-level'); await C.closeAll();
console.log('NAME', await C.ev(`(()=>{const b=[...document.querySelectorAll('.top-bar .div-button')].find(e=>e.innerText.replace(/\\n/g,'|').startsWith('Character Name|')); if(!b) return 'NF'; b.click(); return 'OK';})()`));
await s(900); console.log(await C.modalInfo()); await C.shot('85-character-name'); await C.closeAll();
console.log('REST', await C.ev(`(()=>{const b=[...document.querySelectorAll('.top-bar .div-button')].find(e=>e.innerText.trim()==='Rest'); if(!b) return 'NF'; b.click(); return 'OK';})()`));
await s(900); console.log(await C.modalInfo()); await C.shot('86-rest'); await C.closeAll();
console.log('COND', await C.ev(`(()=>{const b=[...document.querySelectorAll('.top-bar .div-button')].find(e=>e.innerText.trim()==='Add Condition'); if(!b) return 'NF'; b.click(); return 'OK';})()`));
await s(900); console.log(await C.modalInfo()); await C.shot('87-add-condition'); await C.closeAll();
console.log('BUFF', await C.ev(`(()=>{const b=[...document.querySelectorAll('.top-bar .div-button')].find(e=>/Buff/.test(e.innerText)); if(!b) return 'NF'; b.click(); return 'OK';})()`));
await s(900); console.log(await C.modalInfo()); await C.shot('88-add-buff'); await C.closeAll();
