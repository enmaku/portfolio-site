import * as C from './capture.mjs';
const s = C.sleep;
const openBuild = async (match, idx=0) => {
  await C.closeAll(); await s(150);
  await C.ev('document.querySelector("#divBuild").scrollTop=0'); await s(150);
  const r = await C.ev(`(()=>{const bs=[...document.querySelectorAll('#divBuild .div-button')].filter(e=>e.innerText.replace(/\\n/g,'|').trim().startsWith(${JSON.stringify(match)}));
    if(!bs[${idx}]) return 'NF:'+bs.length; bs[${idx}].click(); return 'OK';})()`);
  await s(1200); return {r, info: await C.modalInfo()};
};
// level 2 class feat
console.log(await openBuild('Class Feat|'));
await C.shot('74-class-feat-select');
// filter panel
console.log('filter', await C.clickSel('.modal .button-filter'));
await s(600);
await C.shot('75-class-feat-filters');
await C.closeAll();
// level 2 skill feat
console.log(await openBuild('Skill Feat|'));
await C.shot('76-skill-feat-select');
await C.closeAll();
// level 3 general feat
console.log(await openBuild('General Feat|'));
await C.shot('77-general-feat-select');
await C.closeAll();
// ability boosts (level 5)
console.log(await openBuild('4|Ability Boosts'));
await C.shot('78-ability-boosts');
await C.closeAll();
// skill increase
console.log(await openBuild('1|Skill Increase'));
await C.shot('79-skill-increase');
await C.closeAll();
