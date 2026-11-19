import * as C from './capture.mjs';
const s = C.sleep;
await C.ev('(()=>{document.body.style.zoom="1"; return 1})()');
console.log(await C.ev('JSON.stringify({w:innerWidth,h:innerHeight,modals:document.querySelectorAll(".modal").length, build:document.querySelector("#divBuild")?.innerText.slice(0,80)})'));
// close any open modals
console.log('closed', await C.closeAll());
await s(400);
await C.shot('00-full-app');
