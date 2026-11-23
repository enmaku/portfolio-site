<script setup>
/**
 * PROTOTYPE, THROWAWAY (wayfinder ticket "Prototype: the Pets tab layout").
 * Question: what does the Pets tab look like in the existing mobile layout?
 * Three variants on one route, switch with ?variant=A|B|C (or the pill at the top, or the arrow keys).
 * Character data switches with ?char=oracle|summoner|inventor|mix. All numbers are hand-fed from the
 * Pathbuilder Pets-screen ground truth (tickets "Capture Pathbuilder's Pets screens..." and "Capture a
 * construct-companion export..."). Pet HP is in-memory only. Dev-only route; never shipped.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import '../../features/critcrafter/components/critcrafter.css'
import CritcrafterBottomBar from '../../features/critcrafter/components/CritcrafterBottomBar.vue'
import CritcrafterHpKeypad from '../../features/critcrafter/components/CritcrafterHpKeypad.vue'

const route = useRoute()
const router = useRouter()

/* ---------- fake data ---------- */
const ORACLE_PETS = [
  {
    id: 'scorpion', kind: 'Animal companion', title: 'Giant Widow (Nyame)', sub: 'Young Scorpion',
    hp: 55, ac: 22, fort: 10, ref: 12, will: 10, perc: 10, speed: '30 ft', size: 'Small', senses: 'Darkvision',
    abil: [3, 3, 1, -4, 1, 0], armor: 'Unarmored, trained',
    attacks: [
      { name: 'Stinger', bonus: 12, dmg: '1d6+3 P plus poison', traits: [] },
      { name: 'Pincer', bonus: 12, dmg: '1d6+3 S', traits: ['agile'] },
    ],
    abilities: [{ name: 'Support Benefit', src: 'Companion', text: 'Scorpion support text (illustrative).' }],
    equipment: [],
  },
  {
    id: 'beetle', kind: 'Animal companion', title: 'Orb Weaver (Asase)', sub: 'Young Beetle',
    hp: 71, ac: 20, fort: 12, ref: 10, will: 10, perc: 10, speed: '35 ft', size: 'Medium', senses: 'Low-light vision',
    abil: [3, 1, 3, -4, 1, 0], armor: 'Unarmored, trained',
    attacks: [
      { name: 'Mandible', bonus: 12, dmg: '1d8+3 P', traits: [] },
      { name: 'Foot', bonus: 12, dmg: '1d6+3 B', traits: ['agile'] },
    ],
    abilities: [{ name: 'Support Benefit', src: 'Companion', text: 'Beetle support text (illustrative).' }],
    equipment: [],
  },
  {
    id: 'tarantula', kind: 'Animal companion', title: 'Obaara', sub: 'Young Riding Tarantula',
    hp: 53, ac: 22, fort: 10, ref: 12, will: 11, perc: 11, speed: '30 ft, climb 30 ft', size: 'Large', senses: 'Darkvision',
    abil: [2, 3, 1, -4, 2, 0], armor: 'Unarmored, trained',
    attacks: [
      { name: 'Fangs', bonus: 12, dmg: '1d6+2 P plus poison', traits: ['finesse'] },
      { name: 'Leg', bonus: 12, dmg: '1d4+2 P', traits: ['agile', 'finesse'] },
    ],
    abilities: [{ name: 'Support Benefit', src: 'Companion', text: 'Tarantula support text (illustrative).' }],
    equipment: ['Hosteling Statuette'],
  },
  {
    id: 'familiar', kind: 'Familiar', title: 'Spider Mask (Adaze)', sub: 'Familiar',
    hp: 35, ac: 22, fort: 10, ref: 12, will: 16, perc: 11, speed: '25 ft', size: 'Tiny', senses: 'Low-light vision, darkvision',
    abil: null, armor: null, attacks: [],
    abilities: [
      { name: 'Darkvision', src: 'Familiar', text: 'Your familiar has darkvision.' },
      { name: 'Share Senses', src: 'Master', text: 'Once per round, you can sense through your familiar.' },
      { name: 'Tattoo Transformation', src: 'Master', text: 'Your familiar takes the form of a tattoo.' },
      { name: 'Manual Dexterity', src: 'Familiar', text: 'Your familiar can use up to 2 manipulate actions.' },
    ],
    equipment: [],
  },
]
const EIDOLON = {
  id: 'eidolon', kind: 'Eidolon', title: 'Eidolon', sub: 'Dragon', derived: true, sharesHp: true,
  note: 'Build choices (evolutions, preset, name) are not in the export. Numbers are the base values before evolutions.',
  hp: null, level: 1,
  presets: [
    { label: 'Brazen', str: 4, dex: 2, ac: 17, ref: 5, atk: 7 },
    { label: 'Slinking', str: 2, dex: 4, ac: 17, ref: 7, atk: 7 },
  ],
  fixed: { fort: 6, will: 5, perc: 3, speed: '25 ft', size: 'Medium', senses: 'Darkvision', abil: [null, null, 1, 1, 0, 1] },
  feats: ['Glider Form'],
}
const CONSTRUCT = {
  id: 'construct', kind: 'Construct companion', title: 'Construct companion', sub: 'Inventor Construct', derived: true,
  note: 'Initial modification and name are not in the export. Numbers are the base values.',
  hp: 18, ac: 16, fort: 5, ref: 6, will: 4, perc: 4, speed: '25 ft', size: 'Medium', senses: 'None',
  abil: [3, 3, 2, -4, 1, 0], armor: 'Unarmored, trained', level: 1,
  attacks: [
    { name: 'Fist', bonus: 6, dmg: '1d8+3 B', traits: [] },
    { name: 'Spike', bonus: 6, dmg: '1d6+3 piercing or slashing', traits: ['agile', 'finesse'] },
  ],
  abilities: [], feats: [],
}
const SETS = {
  oracle: { pets: ORACLE_PETS, tabs: 6 },
  summoner: { pets: [EIDOLON] },
  inventor: { pets: [CONSTRUCT] },
  mix: { pets: [EIDOLON, ORACLE_PETS[3], ORACLE_PETS[0]] },
}
const AB = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`)

/* ---------- route state ---------- */
const VARIANTS = [
  ['A', 'Stat block, sectioned'],
  ['B', 'Pet topper + sub-tabs'],
  ['C', 'Dense text stat block'],
  ['D', 'B with dropdown picker'],
]
const variant = computed(() => (VARIANTS.some(([k]) => k === route.query.variant) ? route.query.variant : 'A'))
const char = computed(() => (SETS[route.query.char] ? route.query.char : 'oracle'))
const pets = computed(() => SETS[char.value].pets)
const label = computed(() => VARIANTS.find(([k]) => k === variant.value)[1])
function setQ(q) {
  router.replace({ query: { ...route.query, ...q } })
}
function cycle(d) {
  const i = VARIANTS.findIndex(([k]) => k === variant.value)
  setQ({ variant: VARIANTS[(i + d + VARIANTS.length) % VARIANTS.length][0] })
}
function onKey(e) {
  if (/INPUT|TEXTAREA/.test(e.target?.tagName) || e.target?.isContentEditable) return
  if (e.key === 'ArrowLeft') cycle(-1)
  if (e.key === 'ArrowRight') cycle(1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

/* ---------- pet selection and HP (in-memory) ---------- */
const sel = ref(0)
const pet = computed(() => pets.value[Math.min(sel.value, pets.value.length - 1)])
const hpNow = reactive({})
const hpOf = (p) => (p.id in hpNow ? hpNow[p.id] : p.hp)
const keypadOpen = ref(false)
function applyHp(mode, amount) {
  const p = pet.value
  const cur = hpOf(p)
  if (mode === 'damage') hpNow[p.id] = Math.max(0, cur - amount)
  else if (mode === 'heal') hpNow[p.id] = Math.min(p.hp, cur + amount)
}
function pickChar(c) {
  sel.value = 0
  setQ({ char: c })
}

/* ---------- tap-to-explain (hand-written breakdowns) ---------- */
const explain = ref(null)
const explainOpen = ref(false)
function tell(title, total, lines) {
  explain.value = { title, total, lines }
  explainOpen.value = true
}
function whyAc(p) {
  if (p.derived) return tell(`${p.kind} AC`, p.ac, ['10', 'Dex +3 (capped)', 'Unarmored, trained +3 (level 1 + 2)', 'Base: before evolutions or armor'])
  if (!p.armor) return tell('Familiar AC', p.ac, ['Equals your AC (22)'])
  tell(`${p.sub} AC`, p.ac, ['10', `Dex ${fmt(p.abil[1])}`, 'Unarmored, trained +9 (level 7 + 2)', 'Item +0'])
}
function whySave(p, name, v) {
  if (!p.armor && !p.derived) return tell(`Familiar ${name}`, v, ['Equals your own bonus (includes your item bonus)'])
  tell(`${p.title} ${name}`, v, ['Ability modifier', 'Level 7 + trained 2', 'Companion: always trained'])
}
function whyAtk(p, a) {
  tell(`${a.name} attack`, a.bonus, ['Ability modifier +3', 'Level 7 + trained 2', 'Companion: trained in unarmed'])
}

/* sub-tabs for variant B */
const sub = ref('stats')
const barTabs = [
  { key: 'stats', label: 'Stats', icon: 'monitor_heart' },
  { key: 'skills', label: 'Skills', icon: 'psychology' },
  { key: 'gear', label: 'Gear', icon: 'backpack' },
  { key: 'spells', label: 'Spells', icon: 'auto_awesome' },
  { key: 'actions', label: 'Actions', icon: 'bolt' },
  { key: 'pets', label: 'Pets', icon: 'pets' },
]
const tab = ref('pets')
</script>

<template>
  <q-page class="cc-proto column no-wrap">
    <!-- prototype controls: obviously not part of the design -->
    <div class="proto-bar row items-center no-wrap">
      <q-btn flat round dense icon="chevron_left" @click="cycle(-1)" />
      <div class="q-px-sm text-center proto-label">{{ variant }} ({{ label }})</div>
      <q-btn flat round dense icon="chevron_right" @click="cycle(1)" />
      <q-separator vertical class="q-mx-sm" />
      <q-btn-toggle
        :model-value="char" dense flat toggle-color="white" no-caps size="sm"
        :options="[{label:'Oracle',value:'oracle'},{label:'Summoner',value:'summoner'},{label:'Inventor',value:'inventor'},{label:'Mix',value:'mix'}]"
        @update:model-value="pickChar"
      />
    </div>

    <!-- stand-in topper for the master -->
    <div class="cc-hero q-pa-md q-ma-sm">
      <div class="row items-baseline no-wrap">
        <div class="text-h6 col ellipsis">Fixture</div>
        <div class="text-caption text-grey-4">Lv {{ char === 'oracle' ? 7 : 1 }}</div>
      </div>
      <div class="text-caption text-grey-4">(master's topper, unchanged)</div>
    </div>

    <div class="cc-scroll col scroll q-px-sm q-pb-sm">
      <template v-if="tab === 'pets'">
        <!-- chip row, all variants; hidden for exactly one pet -->
        <div v-if="pets.length > 1 && variant !== 'D'" class="cc-chips row no-wrap q-mb-sm">
          <button
            v-for="(p, i) in pets" :key="p.id" type="button" class="cc-chip"
            :class="{ on: i === sel }" @click="sel = i"
          >{{ p.derived ? p.kind : p.title }}</button>
        </div>

        <!-- ================= VARIANT A: sectioned stat block ================= -->
        <div v-if="variant === 'A'">
          <div class="cc-card q-mb-sm">
            <div class="text-h6">{{ pet.title }}</div>
            <div class="text-caption text-grey-4">{{ pet.kind }} · {{ pet.sub }}<template v-if="pet.size"> · {{ pet.size }}</template></div>
            <div v-if="pet.equipment?.length" class="text-caption q-mt-xs">Equipment: {{ pet.equipment.join(', ') }}</div>
          </div>

          <div v-if="pet.sharesHp" class="cc-card cc-note q-mb-sm">Shares your HP pool. No separate HP.</div>
          <div v-else class="cc-card cc-card--tap q-mb-sm row items-center no-wrap" @click="keypadOpen = true">
            <div class="col"><div class="text-caption">HP</div><div class="text-h5">{{ hpOf(pet) }} <span class="text-grey-5 text-h6">/ {{ pet.hp }}</span></div></div>
            <q-icon name="dialpad" size="24px" />
          </div>

          <template v-if="!pet.presets">
            <div class="cc-label">Defenses</div>
            <div class="cc-statgrid">
              <div class="cc-card cc-statcell cc-card--tap" @click="whyAc(pet)"><div class="text-caption">AC</div><div class="text-h6">{{ pet.ac }}</div></div>
              <div class="cc-card cc-statcell cc-card--tap" @click="whySave(pet,'Fortitude',pet.fort)"><div class="text-caption">Fort</div><div class="text-h6">{{ fmt(pet.fort) }}</div></div>
              <div class="cc-card cc-statcell cc-card--tap" @click="whySave(pet,'Reflex',pet.ref)"><div class="text-caption">Ref</div><div class="text-h6">{{ fmt(pet.ref) }}</div></div>
              <div class="cc-card cc-statcell cc-card--tap" @click="whySave(pet,'Will',pet.will)"><div class="text-caption">Will</div><div class="text-h6">{{ fmt(pet.will) }}</div></div>
              <div class="cc-card cc-statcell"><div class="text-caption">Perception</div><div class="text-h6">{{ fmt(pet.perc) }}</div></div>
              <div class="cc-card cc-statcell"><div class="text-caption">Speed</div><div class="text-subtitle1">{{ pet.speed }}</div></div>
            </div>
            <template v-if="pet.abil">
              <q-separator dark class="cc-sep" />
              <div class="cc-label">Abilities</div>
              <div class="cc-statgrid">
                <div v-for="(m, i) in pet.abil" :key="i" class="cc-card cc-statcell"><div class="text-caption">{{ AB[i] }}</div><div class="text-h6">{{ fmt(m) }}</div></div>
              </div>
            </template>
            <template v-if="pet.attacks?.length">
              <q-separator dark class="cc-sep" />
              <div class="cc-label">Attacks</div>
              <div v-for="a in pet.attacks" :key="a.name" class="cc-card cc-card--tap q-mb-xs row items-center no-wrap" @click="whyAtk(pet,a)">
                <div class="col"><div>{{ a.name }}</div><div class="text-caption text-grey-4">{{ a.dmg }}<template v-if="a.traits.length"> · {{ a.traits.join(', ') }}</template></div></div>
                <div class="cc-bonus text-h6">{{ fmt(a.bonus) }}</div>
              </div>
            </template>
          </template>
          <template v-else>
            <div class="cc-card cc-note q-mb-sm">{{ pet.note }}</div>
            <div class="cc-label">Base numbers, by preset</div>
            <div class="row q-col-gutter-sm q-mb-sm">
              <div v-for="pr in pet.presets" :key="pr.label" class="col-6">
                <div class="cc-card text-center"><div class="text-caption">{{ pr.label }}</div>
                  <div>AC {{ pr.ac }}</div><div>Ref {{ fmt(pr.ref) }}</div><div>Atk {{ fmt(pr.atk) }}</div><div class="text-caption">Str {{ fmt(pr.str) }} · Dex {{ fmt(pr.dex) }}</div></div>
              </div>
            </div>
            <div class="cc-statgrid">
              <div class="cc-card cc-statcell"><div class="text-caption">Fort</div><div class="text-h6">{{ fmt(pet.fixed.fort) }}</div></div>
              <div class="cc-card cc-statcell"><div class="text-caption">Will</div><div class="text-h6">{{ fmt(pet.fixed.will) }}</div></div>
              <div class="cc-card cc-statcell"><div class="text-caption">Perception</div><div class="text-h6">{{ fmt(pet.fixed.perc) }}</div></div>
            </div>
          </template>
          <template v-if="pet.abilities?.length">
            <q-separator dark class="cc-sep" />
            <div class="cc-label">Abilities</div>
            <q-expansion-item v-for="a in pet.abilities" :key="a.name" dark expand-separator class="cc-exp" header-class="cc-exp-head" :label="a.name" :caption="a.src">
              <div class="q-pa-md text-body2">{{ a.text }}</div>
            </q-expansion-item>
          </template>
          <template v-if="pet.feats?.length">
            <q-separator dark class="cc-sep" />
            <div class="cc-label">Evolution feats</div>
            <div v-for="f in pet.feats" :key="f" class="cc-card q-mb-xs">{{ f }}</div>
          </template>
        </div>

        <!-- ================= VARIANT B: pet topper + sub-tabs ================= -->
        <div v-else-if="variant === 'B' || variant === 'D'">
          <q-select
            v-if="variant === 'D' && pets.length > 1" v-model="sel" dark outlined dense options-dark
            emit-value map-options class="q-mb-sm cc-picker" label="Pet"
            :options="pets.map((p, i) => ({ label: (p.derived ? p.kind : p.title) + ' · ' + p.sub, value: i }))"
          />
          <div class="cc-hero q-pa-md q-mb-sm">
            <div class="text-subtitle1 ellipsis">{{ pet.title }}</div>
            <div class="text-caption text-grey-4 q-mb-sm">{{ pet.kind }} · {{ pet.sub }}</div>
            <div class="row text-center items-center">
              <div class="col-5" :class="{ 'cc-hp': !pet.sharesHp }" @click="!pet.sharesHp && (keypadOpen = true)">
                <template v-if="pet.sharesHp"><div class="text-subtitle2">Your HP</div><div class="text-caption">shared</div></template>
                <template v-else><div class="text-h5">{{ hpOf(pet) }}<span class="text-subtitle1 text-grey-4"> / {{ pet.hp }}</span></div><div class="text-caption">HP</div></template>
              </div>
              <div class="col" @click="pet.presets ? null : whyAc(pet)"><div class="text-h6">{{ pet.presets ? pet.presets[0].ac : pet.ac }}</div><div class="text-caption">AC</div></div>
              <div class="col"><div class="text-h6">{{ fmt(pet.presets ? pet.fixed.perc : pet.perc) }}</div><div class="text-caption">Perc</div></div>
              <div class="col"><div class="text-subtitle1">{{ (pet.presets ? pet.fixed.speed : pet.speed).replace(', climb 30 ft','+') }}</div><div class="text-caption">Speed</div></div>
            </div>
          </div>
          <q-btn-toggle v-model="sub" spread no-caps dense unelevated class="q-mb-sm cc-seg" toggle-color="primary" color="dark" text-color="grey-5"
            :options="[{label:'Stats',value:'stats'},{label:'Attacks',value:'attacks'},{label:'Abilities',value:'abil'}]" />
          <div v-if="sub === 'stats'">
            <div v-if="pet.presets" class="cc-card cc-note">{{ pet.note }}</div>
            <div v-else class="cc-statgrid">
              <div class="cc-card cc-statcell" @click="whySave(pet,'Fortitude',pet.fort)"><div class="text-caption">Fort</div><div class="text-h6">{{ fmt(pet.fort) }}</div></div>
              <div class="cc-card cc-statcell" @click="whySave(pet,'Reflex',pet.ref)"><div class="text-caption">Ref</div><div class="text-h6">{{ fmt(pet.ref) }}</div></div>
              <div class="cc-card cc-statcell" @click="whySave(pet,'Will',pet.will)"><div class="text-caption">Will</div><div class="text-h6">{{ fmt(pet.will) }}</div></div>
              <template v-if="pet.abil"><div v-for="(m, i) in pet.abil" :key="i" class="cc-card cc-statcell"><div class="text-caption">{{ AB[i] }}</div><div class="text-h6">{{ fmt(m) }}</div></div></template>
            </div>
            <div class="text-caption text-grey-5 q-mt-sm">{{ pet.size || pet.fixed?.size }} · {{ pet.senses || pet.fixed?.senses }}</div>
          </div>
          <div v-else-if="sub === 'attacks'">
            <div v-if="!pet.attacks?.length" class="cc-card text-grey-5">{{ pet.presets ? 'Strike damage arrives with the full derived card.' : 'No attacks.' }}</div>
            <div v-for="a in pet.attacks" :key="a.name" class="cc-card q-mb-xs row items-center no-wrap" @click="whyAtk(pet,a)">
              <div class="col"><div>{{ a.name }}</div><div class="text-caption text-grey-4">{{ a.dmg }} {{ a.traits.join(', ') }}</div></div>
              <div class="cc-bonus text-h6">{{ fmt(a.bonus) }}</div>
            </div>
          </div>
          <div v-else>
            <div v-if="!pet.abilities?.length && !pet.feats?.length" class="cc-card text-grey-5">None.</div>
            <div v-for="a in pet.abilities" :key="a.name" class="cc-card q-mb-xs"><div>{{ a.name }} <span class="text-caption text-grey-5">· {{ a.src }}</span></div><div class="text-body2 text-grey-4">{{ a.text }}</div></div>
            <div v-for="f in pet.feats" :key="f" class="cc-card q-mb-xs">{{ f }} <span class="text-caption text-grey-5">· evolution</span></div>
          </div>
        </div>

        <!-- ================= VARIANT C: dense text stat block ================= -->
        <div v-else class="cc-card cc-textblock">
          <div class="row items-baseline no-wrap">
            <div class="text-h6 col ellipsis">{{ pet.title }}</div>
            <div class="text-caption text-grey-4">{{ pet.kind }}</div>
          </div>
          <div class="text-caption text-grey-4 q-mb-sm">{{ pet.sub }} · {{ pet.size || pet.fixed?.size }} · {{ pet.senses || pet.fixed?.senses }}</div>
          <div v-if="pet.presets" class="cc-note q-mb-sm">{{ pet.note }}</div>
          <p v-if="!pet.presets"><b>AC</b> <u @click="whyAc(pet)">{{ pet.ac }}</u>; <b>Fort</b> <u @click="whySave(pet,'Fortitude',pet.fort)">{{ fmt(pet.fort) }}</u>, <b>Ref</b> <u @click="whySave(pet,'Reflex',pet.ref)">{{ fmt(pet.ref) }}</u>, <b>Will</b> <u @click="whySave(pet,'Will',pet.will)">{{ fmt(pet.will) }}</u></p>
          <p v-else><b>AC</b> {{ pet.presets[0].ac }} / {{ pet.presets[1].ac }}; <b>Fort</b> {{ fmt(pet.fixed.fort) }}, <b>Ref</b> {{ fmt(pet.presets[0].ref) }} / {{ fmt(pet.presets[1].ref) }}, <b>Will</b> {{ fmt(pet.fixed.will) }}</p>
          <p>
            <b>HP</b>
            <template v-if="pet.sharesHp">shared with you</template>
            <u v-else class="cc-hpinline" @click="keypadOpen = true">{{ hpOf(pet) }} / {{ pet.hp }}</u>;
            <b>Perception</b> {{ fmt(pet.perc ?? pet.fixed.perc) }}; <b>Speed</b> {{ pet.speed || pet.fixed.speed }}
          </p>
          <p v-if="pet.abil"><span v-for="(m, i) in pet.abil" :key="i"><b>{{ AB[i] }}</b> {{ fmt(m) }}<template v-if="i < 5">, </template></span></p>
          <p v-for="a in pet.attacks" :key="a.name"><b>Melee</b> {{ a.name }} <u @click="whyAtk(pet,a)">{{ fmt(a.bonus) }}</u> <span v-if="a.traits.length">({{ a.traits.join(', ') }})</span>, <b>Damage</b> {{ a.dmg }}</p>
          <p v-if="pet.presets"><b>Attack modifier</b> {{ pet.presets.map(p => p.label + ' ' + fmt(p.atk)).join(' / ') }}</p>
          <p v-for="a in pet.abilities" :key="a.name"><b>{{ a.name }}</b> <span class="text-grey-5">({{ a.src }})</span>. {{ a.text }}</p>
          <p v-if="pet.feats?.length"><b>Evolutions</b> {{ pet.feats.join(', ') }}</p>
          <p v-if="pet.equipment?.length"><b>Equipment</b> {{ pet.equipment.join(', ') }}</p>
        </div>
      </template>
      <div v-else class="cc-card text-grey-5 q-mt-md">Other tabs omitted in this prototype. Tap Pets.</div>
    </div>

    <CritcrafterBottomBar v-model="tab" :tabs="barTabs" />

    <CritcrafterHpKeypad v-model="keypadOpen" mode="damage" :hp="hpOf(pet)" :max-hp="pet.hp ?? 0" :temp-hp="0" :shield="null" @apply="applyHp" />

    <q-dialog v-model="explainOpen" position="bottom">
      <div v-if="explain" class="cc-sheet q-pa-md">
        <div class="text-h6">{{ explain.title }}: {{ explain.total }}</div>
        <div v-for="l in explain.lines" :key="l" class="q-mt-xs">{{ l }}</div>
        <div class="text-caption text-grey-5 q-mt-md">(hand-written illustration of a sheet-computed breakdown)</div>
      </div>
    </q-dialog>
  </q-page>
</template>

<style scoped>
.cc-proto { min-height: 0; flex: 1 1 0; overflow: hidden; }
.cc-scroll { flex: 1 1 0; min-height: 0; overflow-y: auto; overflow-x: hidden; }
.proto-bar { position: fixed; top: 6px; left: 50%; transform: translateX(-50%); z-index: 9999; background: #111; color: #fff; border-radius: 24px; padding: 2px 10px; box-shadow: 0 2px 10px rgba(0,0,0,.6); }
.proto-label { min-width: 90px; font-size: 12px; }
.cc-chips { overflow-x: auto; gap: 8px; padding-bottom: 4px; }
.cc-chip { flex: none; min-height: 40px; padding: 0 16px; border-radius: 20px; border: 1px solid rgba(142,141,139,.5); background: var(--q-dark); color: var(--q-secondary); white-space: nowrap; font-size: 14px; }
.cc-chip.on { background: var(--q-primary); color: #fff; border-color: var(--q-primary); }
.cc-statgrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-auto-rows: 1fr; gap: 8px; }
.cc-statcell { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.cc-note { color: var(--q-secondary); font-size: 14px; }
.cc-textblock p { margin: 0 0 8px; line-height: 1.5; font-size: 15px; }
.cc-textblock u { text-decoration: underline dotted; cursor: pointer; }
.cc-seg { border: 1px solid rgba(142,141,139,.3); border-radius: 10px; }
</style>
