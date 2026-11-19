import * as C from './capture.mjs';
const s = C.sleep;
await C.closeAll();
// dice tray
console.log('dice', await C.ev(`(()=>{const d=document.querySelector('.dice-switch'); if(!d) return 'NF'; d.click(); return 'OK';})()`));
await s(800);
await C.shot('91-dice-tray');
console.log(await C.ev('JSON.stringify({r:getComputedStyle(document.querySelector(".dice-tray")).right})'));
// close
await C.ev(`document.getElementById('dice-backdrop').click()`); await s(600);
// listview info pane: open a feat dialog and click a row
await C.closeAll();
await C.ev(`(()=>{const bs=[...document.querySelectorAll('#divBuild .div-button')].filter(e=>e.innerText.replace(/\\n/g,'|').trim().startsWith('Class Feat|')); bs[0].click(); return 'ok';})()`);
await s(1200);
await C.ev(`(()=>{const it=document.querySelector('.modal .listview-item'); it.querySelector('.listview-topdiv').click(); return 1})()`);
await s(600);
await C.shot('92-listview-detail-expanded');
await C.closeAll();
// gear tab inventory with an item added? skip
// conditions list
await C.closeAll();
