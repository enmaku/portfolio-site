import * as C from './capture.mjs';
const s = C.sleep;
const info = await C.closeAll();
console.log(await C.ev(`JSON.stringify([...document.querySelectorAll('.div-button, .div-button-simple, .dice-switch, .top-bar .button-text')].map(e=>{const r=e.getBoundingClientRect();return {t:e.innerText.split('\\n').join('|').slice(0,30), x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};}).filter(o=>o.y<130 && o.w>0 && o.t))`));
