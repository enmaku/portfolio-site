import * as C from './capture.mjs';
const s = C.sleep;
const open = async (text, name) => {
  await C.closeAll(); await s(250);
  const r = await C.ev(`(()=>{const b=[...document.querySelectorAll('.div-button, .div-button-simple')].find(e=>e.innerText.trim()===${JSON.stringify(text)} && e.getBoundingClientRect().width>0);
    if(!b) return 'NF'; b.click(); return 'OK';})()`);
  await s(950);
  console.log(text, r, await C.modalInfo());
  await C.shot(name);
  return r;
};
await open('Level1','84-set-level');
await open('XP0','85-set-xp');
await open('Character NameUnknown Adventurer','86-character-name');
await open('Rest','88-rest');
await open('Add Condition','89-add-condition');
await open('Add Custom Buff','90-add-custom-buff');
await C.closeAll();
