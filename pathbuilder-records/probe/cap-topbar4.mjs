import * as C from './capture.mjs';
const s = C.sleep;
const open = async (text, name) => {
  await C.closeAll(); await s(250);
  const r = await C.ev(`(()=>{const b=[...document.querySelectorAll('.div-button, .div-button-simple')].find(e=>e.innerText.trim()===${JSON.stringify(text)} && e.getBoundingClientRect().width>0);
    if(!b) return 'NF'; b.click(); return 'OK';})()`);
  await s(950);
  console.log(text, r, await C.modalInfo());
  await C.shot(name);
};
await open('Hide Plan','87-hide-plan');
await open('Rest','88-rest');
await open('Add Condition','89-add-condition');
await open('Add Custom Buff','90-add-custom-buff');
await C.closeAll();
