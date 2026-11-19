import * as C from './capture.mjs';
const s = C.sleep;
await C.closeAll(); await s(300);
await C.ev(`document.querySelector("#divBuild").scrollTop=0`); await s(200);
console.log(await C.ev(`(()=>{const bs=[...document.querySelectorAll('#divBuild .div-button')].filter(e=>e.innerText.replace(/\\n/g,'|').trim().startsWith('Class Feat|'));
 if(!bs.length) return 'NF'; bs[0].click(); return 'OK';})()`));
await s(1300);
console.log(await C.modalInfo());
console.log(await C.ev(`(()=>{const m=document.querySelector('.modal:last-of-type'); const it=m.querySelector('.listview-item'); if(!it) return 'noitem';
 const td=it.querySelector('.listview-topdiv'); const b=td.getBoundingClientRect();
 return JSON.stringify({x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)});})()`));
await C.shot('92-feat-listview');
// click row via elementFromPoint centroid
const pos = JSON.parse(await C.ev(`(()=>{const m=document.querySelector('.modal:last-of-type'); const it=m.querySelector('.listview-item'); const td=it.querySelector('.listview-topdiv'); const b=td.getBoundingClientRect(); return JSON.stringify({x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)});})()`));
await C.ev(`(()=>{const m=document.querySelector('.modal:last-of-type'); const it=m.querySelector('.listview-item'); const el=document.elementFromPoint(${pos.x},${pos.y}); (el||it.querySelector('.listview-topdiv')).click(); return 1})()`);
await s(700);
await C.shot('93-listview-detail-expanded');
await C.closeAll();
