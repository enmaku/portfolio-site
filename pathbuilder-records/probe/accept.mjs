import { clickText, sleep, evalIn } from './pbui.mjs';
const label = process.argv[2] || 'Accept';
const scope = process.argv[3] || '.modal:last-of-type .modal-button';
await clickText(label, scope);
await sleep(2000);
console.log(await evalIn(`JSON.stringify({
  modals: [...document.querySelectorAll('.modal')].map(e => e.innerText.slice(0, 250)),
  feats: [...document.querySelectorAll('#id_parent_feats .div-button')].slice(0, 4).map(e => e.innerText.split('\\n').join('|')),
})`));
