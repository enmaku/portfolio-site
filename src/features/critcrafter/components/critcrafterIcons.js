/** Equip glyphs from the approved prototype (white-filled SVG data URIs for q-icon `img:`). */
const svg = (body) => 'img:data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'>${body}</svg>`)

export const SWORD_ICON = svg(
  "<g transform='rotate(45 12 12)'><polygon points='10.8,13 10.8,3 12,0.8 13.2,3 13.2,13'/><rect x='7.5' y='13.2' width='9' height='1.8' rx='.6'/><rect x='11' y='15' width='2' height='4'/><circle cx='12' cy='20.6' r='1.4'/></g>",
)
export const SHIRT_ICON = svg("<path d='M16 3l5 3-2 4-3-1v11H8V9l-3 1-2-4 5-3a4 3 0 0 0 8 0z'/>")
export const RAISE_ICON = svg(
  "<circle cx='9.5' cy='5.5' r='2.6'/><path d='M3.5 21v-6.5a4.5 4.5 0 0 1 4.5-4.5h3a4.5 4.5 0 0 1 4.5 4.5V21z'/><path d='M14 11.5 19 4' stroke='white' stroke-width='2.6' stroke-linecap='round' fill='none'/><circle cx='19.3' cy='3.6' r='1.9'/>",
)
export const EQUIP_ICON = { weapon: SWORD_ICON, armor: SHIRT_ICON, shield: 'shield' }
