import * as C from './capture.mjs';
const s = C.sleep;
await C.closeAll(); await s(200);

const items = [
  ['sidenav-pdf','35-character-sheet-pdf','40-pdf'],
  ['sidenav-statblock','36-statblock-pdf','37-statblock'],
  ['sidenav-json','37-export-json','38-json'],
  ['sidenav-share','38-share-copy','39-share'],
  ['sidenav-export','39-backup-restore','41-backup'],
  ['sidenav-campaign','40-campaign','42-campaign'],
  ['sidenav-feat-browser','41-feat-browser','43-featbrowser'],
  ['sidenav-remaster-info','42-remaster-info','44-remasterinfo'],
];
for (const [id, name, reopen] of items) {
  await C.closeAll(); await s(150);
  const r = await C.clickId(id);
  await s(1000);
  const info = await C.modalInfo();
  console.log(id, r, info);
  await C.shot(name);
  await C.closeAll(); await s(300);
}
console.log(await C.ev('JSON.stringify({url:location.href})'));
