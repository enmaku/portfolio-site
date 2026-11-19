// Enumerate every clickable element in a container with its text and position.
import { evalIn } from './pbui.mjs';
const sel = process.argv[2] || '#main-container';
const out = await evalIn(`(()=>{
  const root = document.querySelector(${JSON.stringify(sel)});
  if (!root) return 'NOT FOUND';
  const clickable = [...root.querySelectorAll('*')].filter(e => {
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cls = typeof e.className === 'string' ? e.className : '';
    return /div-button|button-|section-menu|listview-item|cogButton|checkbox|sidenav-link|tab|spinner|slider|edittext|modal-button/.test(cls)
      || e.tagName === 'SELECT' || e.tagName === 'INPUT' || e.tagName === 'BUTTON';
  });
  return JSON.stringify(clickable.map(e => ({
    tag: e.tagName,
    cls: (typeof e.className === 'string' ? e.className : '').slice(0, 70),
    txt: e.innerText ? e.innerText.split('\\n').join('|').slice(0, 60) : (e.value || e.placeholder || ''),
    x: Math.round(e.getBoundingClientRect().x + e.getBoundingClientRect().width/2),
    y: Math.round(e.getBoundingClientRect().y + e.getBoundingClientRect().height/2),
  })), null, 1);
})()`);
console.log(out);
