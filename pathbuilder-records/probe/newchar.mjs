import { click, clickText, sleep, evalIn } from './pbui.mjs';

// Open menu -> New Character -> Get Started
const w = await evalIn('document.getElementById("mySidenav").getBoundingClientRect().width');
if (w < 10) { await click('#menu'); await sleep(600); }
await click('#sidenav-new');
await sleep(1200);
await clickText('Get Started', '#root .modal-button');
await sleep(2500);
console.log('builds:', await evalIn('JSON.stringify([...document.querySelectorAll("#active-builds .active-build-section")].map(e=>e.textContent.trim()))'));
