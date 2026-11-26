/** Pure view-models for the Features expansion and the item/feature detail sheet. */

/** Row title: name, option in parentheses, count as x-n. */
export function entryTitle(entry) {
  let t = entry.name
  if (entry.option) t += ` (${entry.option})`
  if (entry.count && entry.count > 1) t += ` ×${entry.count}`
  return t
}

const FACTS = [
  ['Defense', 'defense'],
  ['Range', 'range'],
  ['Area', 'area'],
  ['Duration', 'duration'],
]

/** Defense, range, area and duration lines for whatever the entry carries (weapon range is feet). */
function factsOf(entry) {
  const out = []
  for (const [label, key] of FACTS) {
    const raw = entry[key]
    const v = typeof raw === 'number' && raw > 0 ? `${raw} feet` : raw
    if (typeof v === 'string' && v.trim()) out.push({ label, value: v })
  }
  return out
}

/**
 * Detail sheet content for any corpus entry. A corpus miss (`rules: null`) has no html and
 * no licence tag; the sheet then shows the name and the AoN link only.
 */
export function detailView(entry) {
  const rules = entry.rules ?? null
  return {
    title: entryTitle(entry),
    traits: entry.traits ?? [],
    cost: entry.cost ?? null,
    html: rules ? rules.html : null,
    licenseTag: rules ? rules.license : null,
    source: rules ? rules.source : null,
    aonUrl: entry.aonUrl ?? null,
    bulk: entry.bulk ?? null,
    price: entry.price ?? null,
    facts: factsOf(entry),
    linked: entry.linked ?? [],
  }
}

/**
 * Features groups for display: sheet group order, entries stable-sorted by feat level (entries
 * without a level last), empty groups dropped.
 * @param {{ groups?: any[] } | undefined} features
 */
export function featureGroups(features) {
  return (features?.groups ?? [])
    .filter((g) => g.entries?.length)
    .map((g) => ({
      id: g.id,
      label: g.label,
      rows: g.entries
        .map((e, i) => ({ e, i }))
        .sort((a, b) => (a.e.level ?? Infinity) - (b.e.level ?? Infinity) || a.i - b.i)
        .map(({ e }) => ({
          key: e.key,
          title: entryTitle(e),
          levelLabel: e.level == null ? '' : String(e.level),
          entry: e,
        })),
    }))
}
