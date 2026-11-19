import * as C from './capture.mjs';
const s = C.sleep;
await C.closeAll(); await s(200);
// scroll build column to top
await C.ev('document.querySelector("#divBuild").scrollTop=0');
await s(300);
const info = await C.ev(`JSON.stringify([...document.querySelectorAll('#divBuild .div-button')].map((e,i)=>i+':'+e.innerText.replace(/\\n/g,'|').slice(0,36)))`);
console.log(info);
await C.shot('60-build-column-top');
