import * as C from './capture.mjs';
const s = C.sleep;
const open = async (prefix, name, idx=0) => {
  await C.closeAll(); await s(200);
  await C.ev('document.querySelector("#divBuild").scrollTop=0'); await s(200);
  const r = await C.ev(`(()=>{const bs=[...document.querySelectorAll('#divBuild .div-button')].filter(e=>e.innerText.startsWith(${JSON.stringify(prefix)}));
    if(!bs[${idx}]) return 'NF:'+bs.length; bs[${idx}].click(); return 'OK';})()`);
  await s(1300);
  console.log(prefix, idx, r, await C.modalInfo());
  await C.shot(name);
};
await open('Deity Skill','67-deity-skill');
await open('Select Font','69-divine-font');
await open('Select Doctrine','70-doctrine');
await open("Select Deity's",'71-favored-weapon');
await open('Select Cleric Sanctification','72-sanctification');
await open('Extra','74-extra-feat-slot');
await C.closeAll(); await s(200);
// class feat, skill feat, general feat
await open('Class Feat','82-class-feat-select');
await open('Skill Feat','83-skill-feat-select');
await open('General Feat','84-general-feat-select');
await C.closeAll();
