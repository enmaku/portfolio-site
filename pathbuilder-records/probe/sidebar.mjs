import { click, clickText, sleep, evalIn, openMenu } from './pbui.mjs';
import { execSync } from 'node:child_process';
const id = process.argv[2];
await openMenu();
await click('#' + id);
await sleep(2500);
console.log(execSync('node dumpdialog.mjs', { encoding: 'utf8' }));
