import * as C from './capture.mjs';
await C.closeAll();
const info = await C.ev(`(async()=>{
  const db=await new Promise(r=>{const q=indexedDB.open("pathbuilder2e_db");q.onsuccess=()=>r(q.result)});
  const all=await new Promise(r=>{const q=db.transaction("saves","readonly").objectStore("saves").getAll();q.onsuccess=()=>r(q.result)});
  const arr=all.map(s=>typeof s==='string'?JSON.parse(s):s);
  const out=[];
  for (const c of arr) {
    out.push({id:String(c.webID).slice(0,8), cls:c.className, anc:c.ancestry, lvl:c.characterLevel??c.level ?? 1,
      boosts:c.hashMapAbilityBoosts, key:c.classKeyAbility, ancFree:c.hashMapAncestryFreeBoostSelections,
      bg:c.background, bgFree:c.getBackgroundBoostFreeSelection, bgThird:c.backgroundBoostThirdSelection, bgLim:c.backgroundBoostLimitedSelection});
  }
  return JSON.stringify(out,null,1);
})()`);
console.log(info);
