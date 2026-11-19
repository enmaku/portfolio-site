import { evalIn, sleep } from './pbui.mjs';
const expr = process.argv[2];
console.log(await evalIn(expr));
