import * as C from './capture.mjs';
const s = C.sleep;
await C.closeAll(); await s(200);
await C.clickId('menu'); await s(500);

const items = [
  ['sidenav-options','30-options'],
  ['sidenav-new','31-new-character'],
  ['sidenav-save','32-save'],
  ['sidenav-load','33-open-character'],
  ['sidenav-connect','34-connect-gm'],
];
for (const [id, name] of items) {
  await C.closeAll(); await s(150);
  const r = await C.clickId(id);
  await s(900);
  const info = await C.modalInfo();
  console.log(id, r, info);
  await C.shot(name);
  await C.closeAll(); await s(200);
}
