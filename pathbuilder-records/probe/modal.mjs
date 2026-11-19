import { clickText, sleep, evalIn } from './pbui.mjs';
const label = process.argv[2];
const scope = process.argv[3] || '.modal .modal-button';
await clickText(label, scope);
await sleep(1500);
console.log(await evalIn(`JSON.stringify({
  modals: [...document.querySelectorAll('.modal')].map(e => ({ t: e.innerText.slice(0, 120), btns: [...e.querySelectorAll('.modal-button')].map(b => b.textContent.trim()) })),
})`));
