import * as C from './capture.mjs';
const s = C.sleep;
await C.closeAll(); await s(200);
await C.clickId('menu'); await s(700);
await C.shot('20-sidebar-open');
const items = [
  ['sidenav-options','30-options'],
  ['sidenav-new','31-new-character'],
  ['sidenav-save','32-save'],
  ['sidenav-load','33-open-character'],
  ['sidenav-connect','34-connect-gm'],
  ['sidenav-gm-mode','35-gm-mode'],
  ['sidenav-statblock','36-statblock-pdf'],
  ['sidenav-json','37-export-json'],
  ['sidenav-share','38-share-copy'],
  ['sidenav-export','39-backup-restore'],
  ['sidenav-campaign','40-campaign'],
  ['sidenav-feat-browser','41-feat-browser'],
  ['sidenav-custom-pack','43-custom-pack'],
  ['sidenav-custom-ability','44-custom-ability-increases'],
  ['sidenav-custom-feat-choice','45-custom-feat-choice'],
  ['sidenav-custom-skill-increase','46-custom-skill-increases'],
  ['sidenav-help','47-help'],
  ['sidenav-ogl','48-licenses'],
  ['sidenav-error','50-report-error'],
];
for (const [id, name] of items) {
  await C.closeAll(); await s(200);
  const r = await C.clickId(id);
  await s(1000);
  const info = await C.modalInfo();
  console.log(id, r, info);
  await C.shot(name);
}
await C.closeAll();
