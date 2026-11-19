import * as C from './capture.mjs';
const s = C.sleep;
const tabs = ['Weapons','Defense','Gear','Spells','Pets','Details','Feats','Actions'];
await C.closeAll(); await s(300);
for (const t of tabs) {
  const r = await C.ev(`(()=>{const el=[...document.querySelectorAll('#tabbed-area .tabbed-area-menu .section-menu')].find(e=>e.innerText.trim()===${JSON.stringify(t)}); if(!el) return 'NF'; el.click(); return 'OK';})()`);
  await s(700);
  console.log(t, r);
  await C.shot('10-tab-' + t.toLowerCase());
}
