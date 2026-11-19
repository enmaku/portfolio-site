import { click, sleep, evalIn } from './pbui.mjs';
const w = await evalIn('document.getElementById("mySidenav").getBoundingClientRect().width');
if (w < 10) { await click('#menu'); await sleep(600); }
console.log('sidenav width', await evalIn('document.getElementById("mySidenav").getBoundingClientRect().width'));
