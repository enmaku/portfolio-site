'use strict'
const { RANK_LETTERS, normaliseRank, proficiencyLines, abilityLine, stat } = require('./stat')

const CORE_SKILLS = [
  ['acrobatics', 'Acrobatics', 'dex'],
  ['arcana', 'Arcana', 'int'],
  ['athletics', 'Athletics', 'str'],
  ['crafting', 'Crafting', 'int'],
  ['deception', 'Deception', 'cha'],
  ['diplomacy', 'Diplomacy', 'cha'],
  ['intimidation', 'Intimidation', 'cha'],
  ['medicine', 'Medicine', 'wis'],
  ['nature', 'Nature', 'wis'],
  ['occultism', 'Occultism', 'int'],
  ['performance', 'Performance', 'cha'],
  ['religion', 'Religion', 'wis'],
  ['society', 'Society', 'int'],
  ['stealth', 'Stealth', 'dex'],
  ['survival', 'Survival', 'wis'],
  ['thievery', 'Thievery', 'dex'],
]

const normaliseName = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** A ranked, ability-based bonus: ability + proficiency (+ level when trained) + mods for `modLabels`. */
function rankedBonus(build, ctx, abilityId, rankValue, modLabels) {
  const lines = [abilityLine(build, abilityId), ...proficiencyLines(rankValue, Number(build.level) || 1)]
  for (const label of modLabels) lines.push(...ctx.mods.linesFor(label))
  return stat(lines)
}

/** The 16 core skills (alphabetical), then lores in export order. Keys are `skills:<name>#<nth>`. */
function deriveSkills(build, ctx) {
  const prof = build.proficiencies || {}
  const seen = new Map()
  const keyFor = (name) => {
    const base = `skills:${normaliseName(name)}`
    const n = (seen.get(base) || 0) + 1
    seen.set(base, n)
    return `${base}#${n}`
  }
  const out = CORE_SKILLS.map(([id, name, ability]) => {
    const rank = normaliseRank(prof[id])
    return {
      key: keyFor(name),
      name,
      ability,
      rank: RANK_LETTERS[rank],
      bonus: rankedBonus(build, ctx, ability, rank, [name]),
      lore: false,
    }
  })
  for (const entry of build.lores || []) {
    const [rawName, rawRank] = Array.isArray(entry) ? entry : [entry, 0]
    const loreName = String(rawName)
    const name = /\blore$/i.test(loreName) ? loreName : `${loreName} Lore`
    const rank = normaliseRank(rawRank)
    out.push({
      key: keyFor(name),
      name,
      ability: 'int',
      rank: RANK_LETTERS[rank],
      bonus: rankedBonus(build, ctx, 'int', rank, [loreName, name]),
      lore: true,
    })
  }
  return out
}

module.exports = { deriveSkills, rankedBonus, CORE_SKILLS, normaliseName }
