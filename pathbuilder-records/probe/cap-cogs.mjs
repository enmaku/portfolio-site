import * as C from './capture.mjs';
const s = C.sleep;
const open = async (label, name, idx=0) => {
  await C.closeAll(); await s(200);
  await C.ev('document.querySelector("#divBuild").scrollTop=0'); await s(200);
  const r = await C.ev(`(()=>{
    const all=[...document.querySelectorAll('#divBuild .cogButton')];
    const bs=all.filter(e=>{const t=e.querySelector('.centered-tiny'); return t && t.innerText.trim()===${JSON.stringify(label)};});
    if(!bs[${idx}]) return 'NF:'+bs.length;
    bs[${idx}].click(); return 'OK';})()`);
  await s(1300);
  console.log(label, idx, r, await C.modalInfo());
  await C.shot(name);
};
await open('Set Abilities','65-set-abilities');
await open('Skill Training','66-skill-training');
await open('Deity Skill','67-deity-skill');
await open('Extra','74-extra-feat-slot');
await C.closeAll(); await s(200);
await C.ev('document.querySelector("#divBuild").scrollTop=0');
await open('Select Font','69-divine-font');
await open('Select Doctrine','70-doctrine');
await open("Select Deity's Favored Weapon",'71-favored-weapon');
await open('Select Cleric Sanctification','72-sanctification');
await C.closeAll();
