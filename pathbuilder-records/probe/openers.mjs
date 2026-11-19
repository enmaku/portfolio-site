import * as C from './capture.mjs';
export const ev = C.ev; export const sleep = C.sleep; export const shot = C.shot;

// click a leaf element whose text matches exactly, walking up to a clickable ancestor
export const clickText = async (sel, text) => ev(`(()=>{
  const leaf=[...document.querySelectorAll(${JSON.stringify(sel)})].filter(e=>e.children.length===0 && e.innerText.trim()===${JSON.stringify(text)});
  if(!leaf.length) return 'NF:'+${JSON.stringify(text)};
  const el=leaf[0];
  let n=el;
  while(n && !(n.classList.contains('div-button')||n.classList.contains('sidenav-link')||n.classList.contains('div-button-simple')||n.classList.contains('section-menu')||n.classList.contains('modal-button')||n.classList.contains('button-money'))) n=n.parentElement;
  (n||el).click();
  return 'OK';
})()`);

export const clickId = async (id) => ev(`(()=>{const e=document.getElementById(${JSON.stringify(id)}); if(!e) return 'NF'; e.click(); return 'OK';})()`);
export const clickSel = async (sel, idx=0) => ev(`(()=>{const e=document.querySelectorAll(${JSON.stringify(sel)})[${idx}]; if(!e) return 'NF'; e.click(); return 'OK';})()`);
export const modalTitle = async () => ev(`(()=>{const m=document.querySelector('.modal:last-of-type'); return m? (m.querySelector('.dialog-title')?.innerText||'(no title)') : null;})()`);
export const nmodals = async () => ev(`document.querySelectorAll('.modal').length`);
