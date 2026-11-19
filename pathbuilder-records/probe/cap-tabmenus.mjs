import * as C from './capture.mjs';
const s = C.sleep;
const tab = async (t) => { await C.ev(`(()=>{const el=[...document.querySelectorAll('#tabbed-area > .tabbed-area-menu .section-menu')].find(e=>e.innerText.trim()===${JSON.stringify(t)}); if(el) el.click(); return !!el;})()`); await s(700); };
const sub = async (label) => { await C.ev(`(()=>{const el=[...document.querySelectorAll('#tabbed-area .submenu .section-menu')].find(e=>e.innerText.trim()===${JSON.stringify(label)}); if(el) el.click(); return !!el;})()`); await s(700); };

await C.closeAll();
await tab('Weapons');
console.log('addweapon', await C.ev(`(()=>{const b=[...document.querySelectorAll('.div-button-simple,.div-button')].find(e=>e.innerText.trim()==='Add Weapon'); if(!b) return 'NF'; b.click(); return 'OK';})()`));
await s(1000); console.log(await C.modalInfo()); await C.shot('80-add-weapon'); await C.closeAll();
await tab('Gear');
console.log('addgear', await C.ev(`(()=>{const b=[...document.querySelectorAll('.div-button-simple')].find(e=>e.innerText.trim()==='Add Gear'); if(!b) return 'NF'; b.click(); return 'OK';})()`));
await s(1000); console.log(await C.modalInfo()); await C.shot('81-add-gear'); await C.closeAll();
console.log('addcontainer', await C.ev(`(()=>{const b=[...document.querySelectorAll('.div-button-simple')].find(e=>e.innerText.trim()==='Add Container'); if(!b) return 'NF'; b.click(); return 'OK';})()`));
await s(1000); console.log(await C.modalInfo()); await C.shot('82-add-container'); await C.closeAll();
await tab('Defense');
console.log(await C.shot('83-tab-defense-detail'));
console.log(await C.ev(`JSON.stringify([...document.querySelectorAll('.main-column-right .div-button')].map((e,i)=>i+':'+e.innerText.replace(/\\n/g,'|').slice(0,30)).slice(0,20))`));
