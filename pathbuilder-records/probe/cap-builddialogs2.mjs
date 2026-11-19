import * as C from './capture.mjs';
const s = C.sleep;

const open = async (match, idx=0) => {
  await C.closeAll(); await s(150);
  await C.ev('document.querySelector("#divBuild").scrollTop=0'); await s(200);
  const r = await C.ev(`(()=>{const bs=[...document.querySelectorAll('#divBuild .div-button')].filter(e=>e.innerText.replace(/\\n/g,'|').trim().startsWith(${JSON.stringify(match)}));
    if(!bs[${idx}]) return 'NF:'+bs.length; bs[${idx}].click(); return 'OK';})()`);
  await s(1200);
  const info = await C.modalInfo();
  console.log(match, idx, r, info);
  return info;
};

const seq = [
  ['Ancestry|Dwarf','62-ancestry-select'],
  ['Background|Acolyte','63-background-select'],
  ['Class|Cleric','64-class-select'],
  ['Heritage|Rock Dwarf','68-heritage-select'],
  ['Ancestry Feat|Dwarven Lore','73-ancestry-feat'],
  ['Select Font|Healing Font','69-divine-font'],
  ['Select Doctrine|Warpriest','70-doctrine'],
  ["Select Deity's Favored Weapon|",'71-favored-weapon'],
  ['Select Cleric Sanctification|','72-sanctification'],
];
for (const [m, name] of seq) { await open(m,0); await C.shot(name); }
await C.closeAll();
