'use strict'
const { abilityModOf, line, stat } = require('./stat')

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

/**
 * Max HP = ancestryhp + (classhp + conMod) x level + bonushp + bonushpPerLevel x level.
 * `bonushp` is a flat total, not per level.
 */
function deriveMaxHp(build) {
  const a = build.attributes || {}
  const level = num(build.level) || 1
  const con = abilityModOf(build, 'con')
  const sign = con >= 0 ? '+' : ''
  const lines = [
    line('Ancestry HP', num(a.ancestryhp), 'base'),
    line(`Class HP (${num(a.classhp)} x level ${level})`, num(a.classhp) * level, 'base'),
    line(`Constitution (${sign}${con} x level ${level})`, con * level, 'ability'),
  ]
  if (num(a.bonushp) !== 0) lines.push(line('Bonus HP', num(a.bonushp), 'untyped'))
  if (num(a.bonushpPerLevel) !== 0) {
    lines.push(line(`Bonus HP per level (${num(a.bonushpPerLevel)} x level ${level})`, num(a.bonushpPerLevel) * level, 'untyped'))
  }
  return stat(lines)
}

function deriveSpeed(build) {
  const a = build.attributes || {}
  const lines = [line('Base speed', num(a.speed), 'base')]
  if (num(a.speedBonus) !== 0) lines.push(line('Speed bonus', num(a.speedBonus), 'untyped'))
  return stat(lines)
}

module.exports = { deriveMaxHp, deriveSpeed }
