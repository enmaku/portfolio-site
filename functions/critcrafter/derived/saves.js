'use strict'
const { RANK_LETTERS, normaliseRank, proficiencyLines, abilityLine, line, stat } = require('./stat')
const { rankedBonus } = require('./skills')

const SAVES = [
  ['fortitude', 'Fortitude', 'con'],
  ['reflex', 'Reflex', 'dex'],
  ['will', 'Will', 'wis'],
]

/** Fortitude, Reflex, Will. Honours `mods` (the SoT computeSave did not). */
function deriveSaves(build, ctx) {
  const prof = build.proficiencies || {}
  return SAVES.map(([id, name, ability]) => {
    const rank = normaliseRank(prof[id])
    return { id, name, rank: RANK_LETTERS[rank], bonus: rankedBonus(build, ctx, ability, rank, [name]) }
  })
}

function derivePerception(build, ctx) {
  const rank = normaliseRank((build.proficiencies || {}).perception)
  return rankedBonus(build, ctx, 'wis', rank, ['Perception'])
}

/** 10 + key ability + class proficiency (+ level when trained). */
function deriveClassDc(build, ctx) {
  const key = ['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(build.keyability) ? build.keyability : 'str'
  const rank = normaliseRank((build.proficiencies || {}).classDC)
  const lines = [line('Base', 10, 'base'), abilityLine(build, key), ...proficiencyLines(rank, Number(build.level) || 1)]
  if (ctx) lines.push(...ctx.mods.linesFor('Class DC'))
  return stat(lines)
}

module.exports = { deriveSaves, derivePerception, deriveClassDc }
