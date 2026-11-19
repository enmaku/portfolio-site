import { click, sleep, evalIn } from './pbui.mjs';
const idx = Number(process.argv[2] || 1);
await click(`#active-builds .active-build-section:nth-child(${idx}) .button-active-build:nth-child(2)`);
await sleep(900);
console.log(await evalIn('JSON.stringify({builds:[...document.querySelectorAll("#active-builds .active-build-section")].map(e=>e.textContent.trim()), top:document.getElementById("divTopButtons")?.innerText})'));
