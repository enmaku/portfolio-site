import * as C from './capture.mjs';
const s = C.sleep;
await C.closeAll(); await s(300);
console.log('open sidebar', await C.clickId('menu'));
await s(800);
await C.shot('20-sidebar-open');
console.log(await C.ev('JSON.stringify({w:document.getElementById("mySidenav").style.width, links:document.querySelectorAll(".sidenav-link").length})'));
