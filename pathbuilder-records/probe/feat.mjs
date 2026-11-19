import { clickText, sleep, evalIn } from './pbui.mjs';
const label = process.argv[2];
await clickText(label, '#id_parent_feats .small-text.grey-text, #divBuildLevels .small-text.grey-text', { scroll: true });
await sleep(2000);
const out = await evalIn(`JSON.stringify({
  title: document.querySelector('#root .dialog-title')?.textContent,
  tabs: [...document.querySelectorAll('#root .section-menu')].map(e => e.textContent.trim()),
  n: document.querySelectorAll('#content .listview-item').length,
  first: [...document.querySelectorAll('#content .listview-item')].slice(0, 6).map(e => e.innerText.split('\\n').join(' | ').slice(0, 70)),
})`);
console.log(out);
