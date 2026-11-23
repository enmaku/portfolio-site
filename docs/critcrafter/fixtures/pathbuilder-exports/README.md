# Pathbuilder export fixtures

Real `json.php` bodies from throwaway test characters, with the character name replaced by `Fixture`. Everything else is as exported.

| File | Level / Con | `bonushp` | `bonushpPerLevel` | Max HP shown in Pathbuilder |
| --- | --- | --- | --- | --- |
| `dwarf-fighter-toughness.json` | 5 / +3 | 0 | 1 | 80 |
| `dwarf-fighter-barbarian-resiliency.json` | 5 / +3 | 6 | 1 | 86 |

Both fit `ancestryhp + (classhp + conMod) × level + bonushp + bonushpPerLevel × level`. The old form that multiplied `bonushp` by level gives 110 for the second file and is wrong. See `pathbuilder-records/docs/08-export-and-integrations.md` §3.7.

Still wanted: a pet or companion, an eidolon, runes on gear, a high-rank caster.
