import * as C from './capture.mjs';
const s = C.sleep;

const open = async (label, idx=0) => {
  await C.closeAll(); await s(150);
  await C.ev('document.querySelector("#divBuild").scrollTop=0'); await s(200);
  const r = await C.ev(`(()=>{const bs=[...document.querySelectorAll('#divBuild .div-button')].filter(e=>e.innerText.trim().split('\\n')[0]===${JSON.stringify(label)});
    if(!bs[${idx}]) return 'NF:'+bs.length; bs[${idx}].click(); return 'OK';})()`);
  await s(1100);
  const info = await C.modalInfo();
  console.log(label, idx, r, info);
  return info;
};

const seq = [
  ['Ancestry|Dwarf','62-ancestry-select'],
  ['Background|Acolyte','63-background-select'],
  ['Class|Cleric','64-class-select'],
  ['Set Abilities','65-set-abilities'],
  ['Skill Training','66-skill-training'],
  ['Deity Skill','67-deity-skill'],
  ['Heritage|Rock Dwarf','68-heritage-select'],
  ['Select Font|Healing Font','69-divine-font'],
  ['Select Doctrine|Warpriest','70-doctrine'],
  ["Select Deity's Favored Weapon|Warhammer (1d8 B)",'71-favored-weapon'],
  ['Select Cleric Sanctification|Holy','72-sanctification'],
];
for (const [label, name] of seq) { await open(label,0); await C.shot(name); }
await C.closeAll();
