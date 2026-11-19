import * as C from './capture.mjs';
const s = C.sleep;
await C.closeAll(); await s(200);
await C.clickId('menu'); await s(700);
await C.shot('20-sidebar-open');
await C.ev(`(()=>{const n=document.getElementById('mySidenav'); n.style.width='0em'; document.getElementById('backdrop').classList.add('hidden'); return 1})()`);
await s(300);
const items = [
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
  ['sidenav-remaster-info','42-remaster-info'],
];
for (const [id, name] of items) {
  await C.closeAll(); await s(250);
  const r = await C.clickId(id);
  await s(1100);
  console.log(id, r, await C.modalInfo());
  await C.shot(name);
}
await C.closeAll();
