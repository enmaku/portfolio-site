// Restore the app to a clean, working character view:
//  - dismiss every modal
//  - close the sidebar / dice tray
//  - select the most recent character tab
// Usage: node reset.mjs
import * as C from './capture.mjs';

await C.closeAll();
await C.ev(`(()=>{
  const sn=document.getElementById('mySidenav'); if(sn) sn.style.width='0em';
  document.getElementById('backdrop')?.classList.add('hidden');
  const dt=document.querySelector('.dice-tray'); if(dt){dt.style.right='-360px';dt.setAttribute('aria-hidden','true');}
  document.getElementById('dice-backdrop')?.classList.add('hidden');
  return 1;})()`);
await C.sleep(300);

const state = await C.ev(`JSON.stringify({
  hasStartDialog: !!document.getElementById('root-no_character'),
  hasBuild: !!document.getElementById('divBuildLevels'),
  builds: [...document.querySelectorAll('#active-builds .button-active-build')]
            .filter(e=>e.innerText.trim()!=='X').map(e=>e.innerText.trim()),
})`);
console.log(state);

const s = JSON.parse(state);
if (s.hasStartDialog) {
  console.log('dismissing start dialog…');
  await C.ev(`(()=>{const b=[...document.querySelectorAll('#root-no_character .div-button-simple')]
    .find(e=>e.innerText.trim()==='Load Most Recent Character'); if(b) b.click(); return !!b;})()`);
  await C.sleep(4000);
}
console.log('ready:', await C.ev(`!!document.getElementById('divBuildLevels')`));
