import * as C from './capture.mjs';
const s = C.sleep;
await C.closeAll();
const open = async (prefix, name) => {
  await C.closeAll(); await s(200);
  const r = await C.ev(`(()=>{const b=[...document.querySelectorAll('.div-button')].filter(e=>e.getBoundingClientRect().top<130 && e.innerText.split('\\n').join('|').startsWith(${JSON.stringify(prefix)}));
    if(!b.length) return 'NF'; b[0].click(); return 'OK';})()`);
  await s(900);
  console.log(prefix, r, await C.modalInfo());
  await C.shot(name);
};
await open('Level|','84-set-level');
await open('XP|','85-set-xp');
await open('Character Name|','86-character-name');
