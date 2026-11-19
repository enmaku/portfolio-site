import * as C from './capture.mjs';
const s = C.sleep;
const items = [
  ['sidenav-custom-pack','43-custom-pack'],
  ['sidenav-custom-ability','44-custom-ability-increases'],
  ['sidenav-custom-feat-choice','45-custom-feat-choice'],
  ['sidenav-custom-skill-increase','46-custom-skill-increases'],
  ['sidenav-help','47-help'],
  ['sidenav-ogl','48-licenses'],
  ['sidenav-patch','49-patch-notes'],
  ['sidenav-error','50-report-error'],
];
for (const [id, name] of items) {
  await C.closeAll(); await s(200);
  const r = await C.clickId(id);
  await s(900);
  console.log(id, r, await C.modalInfo());
  await C.shot(name);
  await C.closeAll(); await s(200);
}
