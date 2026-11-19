// Evaluate a JS expression in the Pathbuilder tab. Expression is read from argv[2] or stdin.
const TARGET = 'EB0794557D8CBD3F66551E367C61603A';
const BRIDGE = 'http://127.0.0.1:9333';
let expr = process.argv[2];
if (!expr) {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  expr = Buffer.concat(chunks).toString('utf8');
}
const r = await fetch(BRIDGE + '/eval', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ targetId: TARGET, expression: expr }),
});
const j = await r.json();
if (j.error) { console.error('ERROR:', j.error); process.exit(1); }
console.log(typeof j.value === 'string' ? j.value : JSON.stringify(j.value, null, 1));
