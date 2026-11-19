import { clickAt, sleep, evalIn } from './pbui.mjs';
const x = Number(process.argv[2]), y = Number(process.argv[3]);
await clickAt(x, y);
await sleep(400);
console.log('after 400ms:', await evalIn('JSON.stringify({modals:[...document.querySelectorAll(".modal")].map(e=>e.innerText.slice(0,150))})'));
await sleep(1500);
console.log('after 1.9s:', await evalIn('JSON.stringify({modals:[...document.querySelectorAll(".modal")].map(e=>e.innerText.slice(0,150))})'));
