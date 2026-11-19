import { clickAt, sleep, evalIn } from './pbui.mjs';
import { execSync } from 'node:child_process';
await clickAt(Number(process.argv[2]), Number(process.argv[3]));
await sleep(2200);
console.log(execSync('node dumpdialog.mjs', { encoding: 'utf8' }));
