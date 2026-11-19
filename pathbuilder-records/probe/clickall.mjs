// Click a selector, wait, then dump the resulting dialog.
import { click, clickText, sleep, evalIn } from './pbui.mjs';
import { execSync } from 'node:child_process';
const mode = process.argv[2];
const arg = process.argv[3];
const arg2 = process.argv[4];
if (mode === 'sel') await click(arg, { scroll: true });
else if (mode === 'text') await clickText(arg, arg2 || '*', { scroll: true });
await sleep(2200);
console.log(execSync('node dumpdialog.mjs', { encoding: 'utf8' }));
