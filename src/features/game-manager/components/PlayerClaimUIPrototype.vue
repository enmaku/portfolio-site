<template>
  <!--
    Three variants of player-claim UI moments, switchable via ?variant=A|B|C.
    Throwaway prototype — not merged to main.
  -->
  <div data-testid="gm-surface" class="gm-surface">
    <!-- Variant A: Slide + Card + Badge -->
    <div v-if="activeVariant === 'A'" class="gm-surface__scroll">
      <div class="q-pa-md">
        <div class="text-caption text-grey-6 q-mb-sm">Moment 1: People — claim as left slide (share icon)</div>

        <q-slide-item
          v-for="person in unlinkedPeople"
          :key="person.id"
          class="gm-slide rounded-borders overflow-hidden"
          left-color="secondary"
          right-color="negative"
          @left="(e) => { e.reset(); showClaimLinkNotify(person) }"
          @right="(e) => { e.reset(); showDeleteNotify(person) }"
        >
          <template #left>
            <div class="row items-center full-height q-px-md" aria-hidden="true">
              <q-icon name="share" size="md" />
            </div>
          </template>
          <template #right>
            <div class="row items-center full-height q-px-md" aria-hidden="true">
              <q-icon name="delete" size="md" />
            </div>
          </template>
          <q-item clickable v-ripple class="gm-person-row" :style="rowStyle(person)">
            <q-item-section>
              <q-item-label class="gm-person-row__name ellipsis">{{ person.name }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-slide-item>

        <q-slide-item
          v-for="person in nonClaimablePeople"
          :key="person.id"
          class="gm-slide rounded-borders overflow-hidden"
          left-color="primary"
          right-color="negative"
          @left="(e) => { e.reset(); showEditNotify(person) }"
          @right="(e) => { e.reset(); showDeleteNotify(person) }"
        >
          <template #left>
            <div class="row items-center full-height q-px-md" aria-hidden="true">
              <q-icon name="edit" size="md" />
            </div>
          </template>
          <template #right>
            <div class="row items-center full-height q-px-md" aria-hidden="true">
              <q-icon name="delete" size="md" />
            </div>
          </template>
          <q-item clickable v-ripple class="gm-person-row" :style="rowStyle(person)">
            <q-item-section>
              <q-item-label class="gm-person-row__name ellipsis">{{ person.name }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-slide-item>
      </div>

      <q-separator />

      <div class="q-pa-md">
        <div class="text-caption text-grey-6 q-mb-sm">Moment 2: Claim landing — card dialog</div>
        <q-card>
          <q-card-section>
            <div class="text-h6">Claim this player?</div>
            <div class="text-subtitle2 text-grey-7 q-mt-xs">Jordan · from owner@example.com</div>
          </q-card-section>
          <q-card-section class="bg-grey-10 q-pa-sm q-pt-none">
            <div class="text-subtitle2 q-mt-sm">You'll see</div>
            <ul class="q-mt-xs q-pl-md text-body2">
              <li>Every sitting where Jordan played</li>
              <li>Scores, play time, and statistics</li>
              <li>Owner's edits to those sittings</li>
            </ul>
            <div class="text-subtitle2 q-mt-sm">You won't see</div>
            <ul class="q-mt-xs q-pl-md text-body2">
              <li>The owner's game collection</li>
              <li>Sittings Jordan wasn't in</li>
              <li>The owner's other people</li>
            </ul>
          </q-card-section>
          <q-card-actions vertical>
            <q-btn color="primary" label="Sign in to claim" @click="signInToClaimNotify" />
            <q-btn flat color="grey" label="Cancel" />
          </q-card-actions>
        </q-card>
      </div>

      <q-separator />

      <div class="q-pa-md">
        <div class="text-caption text-grey-6 q-mb-sm">Moment 3: Foreign sitting — card with read-only badge</div>
        <q-card>
          <q-card-section>
            <div class="row items-center q-mb-sm">
              <q-chip size="sm" color="grey-8" text-color="white" icon="lock">Read-only · owner's sitting</q-chip>
              <q-space />
              <div class="text-caption text-grey-6">Nov 3, 2025</div>
            </div>
            <div class="text-h6">Wingspan</div>
          </q-card-section>
          <q-separator />
          <q-card-section>
            <div class="text-subtitle2 q-mb-xs">Play time</div>
            <div class="text-h5">1h 42m</div>
          </q-card-section>
          <q-card-section class="bg-grey-10 q-pa-sm">
            <div class="text-subtitle2">Scores</div>
            <div class="q-mt-sm">
              <div v-for="p in sittingScores" :key="p.name" class="row items-center q-mb-sm">
                <div
                  class="rounded-borders q-mr-sm"
                  :style="{ width: '24px', height: '24px', backgroundColor: p.color }"
                />
                <div class="col text-body2">
                  {{ p.name }}<span v-if="p.isClaimant" class="text-caption text-grey-6"> (you)</span>
                </div>
                <div class="text-body2 text-weight-bold" :class="{ 'text-secondary': p.isClaimant }">{{ p.score }}</div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Variant B: Overflow + Sheet + Integrated -->
    <div v-if="activeVariant === 'B'" class="gm-surface__scroll">
      <div class="q-pa-md">
        <div class="text-caption text-grey-6 q-mb-sm">Moment 1: People — claim in overflow menu</div>

        <q-item
          v-for="person in unlinkedPeople"
          :key="'unlinked-' + person.id"
          clickable
          v-ripple
          class="gm-person-row rounded-borders q-mb-sm"
          :style="rowStyle(person)"
        >
          <q-item-section>
            <q-item-label class="gm-person-row__name ellipsis">{{ person.name }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn flat dense round icon="more_vert" @click.stop="showClaimLinkNotify(person)" />
          </q-item-section>
        </q-item>

        <q-item
          v-for="person in nonClaimablePeople"
          :key="'other-' + person.id"
          clickable
          v-ripple
          class="gm-person-row rounded-borders q-mb-sm"
          :style="rowStyle(person)"
        >
          <q-item-section>
            <q-item-label class="gm-person-row__name ellipsis">{{ person.name }}</q-item-label>
          </q-item-section>
        </q-item>
      </div>

      <q-separator />

      <div class="q-pa-md">
        <div class="text-caption text-grey-6 q-mb-sm">Moment 2: Claim landing — compact bottom sheet</div>
        <q-card>
          <q-card-section class="row items-center">
            <div class="rounded-borders q-mr-md" style="width: 48px; height: 48px; background: #ffe66d" />
            <div>
              <div class="text-h6">Claim Jordan</div>
              <div class="text-caption text-grey-7">owner@example.com</div>
            </div>
          </q-card-section>
          <q-card-section class="q-pt-none text-body2">
            Read all sittings Jordan played. Collection stays private.
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat color="grey" label="Cancel" />
            <q-btn unelevated color="primary" label="Claim" @click="signInToClaimNotify" />
          </q-card-actions>
        </q-card>
      </div>

      <q-separator />

      <div class="q-pa-md">
        <div class="text-caption text-grey-6 q-mb-sm">Moment 3: Foreign sitting — stats-panel style</div>
        <q-card class="gm-flow-panel" style="max-height: none; height: auto;">
          <q-card-section class="row items-center no-wrap q-pb-sm gm-flow-panel__header">
            <div class="text-h6 col ellipsis">Wingspan</div>
            <div class="text-caption text-grey-6 q-mr-sm">owner@example.com</div>
            <q-btn flat dense round icon="close" />
          </q-card-section>

          <q-card-section class="col q-pt-none column no-wrap q-gutter-y-md" style="max-height: none; overflow: visible;">
            <div class="full-width">
              <div class="text-body2 text-grey-6">Play time</div>
              <div class="text-h4">1h 42m</div>
            </div>

            <div class="gm-session-stats-charts full-width">
              <div class="gm-session-stats-charts__title text-subtitle1 text-weight-medium">Points</div>
              <template v-for="(player, idx) in sittingScoreRows" :key="'score-' + idx">
                <div class="gm-session-stats-bar-name ellipsis">
                  {{ player.name }}<span v-if="player.isClaimant" class="text-caption text-grey-6"> (you)</span>
                </div>
                <div class="gm-session-stats-bar-track">
                  <div class="gm-session-stats-bar-fill" :style="barFillScoreStyle(player)">
                    <span class="gm-session-stats-bar-value">{{ player.score }}</span>
                  </div>
                </div>
              </template>
            </div>
          </q-card-section>

          <q-card-actions class="gm-flow-panel__actions">
            <q-space />
            <div class="text-caption text-grey-6">Read-only</div>
          </q-card-actions>
        </q-card>
      </div>
    </div>

    <!-- Variant C: Button + Fullscreen + Minimal -->
    <div v-if="activeVariant === 'C'" class="gm-surface__scroll">
      <div class="q-pa-md">
        <div class="text-caption text-grey-6 q-mb-sm">Moment 1: People — visible Claim button on unlinked rows</div>

        <q-item
          v-for="person in unlinkedPeople"
          :key="'unlinked-' + person.id"
          clickable
          v-ripple
          class="gm-person-row rounded-borders q-mb-sm"
          :style="rowStyle(person)"
        >
          <q-item-section>
            <q-item-label class="gm-person-row__name ellipsis">{{ person.name }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn outline size="sm" color="white" label="Claim" @click.stop="showClaimLinkNotify(person)" />
          </q-item-section>
        </q-item>

        <q-item
          v-for="person in nonClaimablePeople"
          :key="'other-' + person.id"
          clickable
          v-ripple
          class="gm-person-row rounded-borders q-mb-sm"
          :style="rowStyle(person)"
        >
          <q-item-section>
            <q-item-label class="gm-person-row__name ellipsis">{{ person.name }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <template v-if="person.linkedTo">
              <q-icon name="link" size="sm" color="grey-5">
                <q-tooltip>Linked to {{ person.linkedTo }}</q-tooltip>
              </q-icon>
            </template>
            <template v-else>
              <div class="text-caption text-grey-5">You</div>
            </template>
          </q-item-section>
        </q-item>
      </div>

      <q-separator />

      <div class="q-pa-md">
        <div class="text-caption text-grey-6 q-mb-sm">Moment 2: Claim landing — fullscreen page</div>
        <div class="column items-center q-py-xl text-center">
          <q-avatar size="80px" style="background: #ffe66d" class="q-mb-lg">
            <span class="text-h4 text-weight-bold">J</span>
          </q-avatar>
          <div class="text-h5 q-mb-sm">Jordan is claiming you</div>
          <div class="text-body2 text-grey-7 q-mb-lg" style="max-width: 280px">
            owner@example.com wants you to see every sitting Jordan played.
            Scores, stats, and edits — no collection access.
          </div>
          <q-btn color="primary" size="lg" label="Sign in to claim" class="full-width" style="max-width: 280px" @click="signInToClaimNotify" />
          <q-btn flat color="grey" label="Not now" class="q-mt-sm" />
        </div>
      </div>

      <q-separator />

      <div class="q-pa-md">
        <div class="text-caption text-grey-6 q-mb-sm">Moment 3: Foreign sitting — minimal, stripped view</div>
        <div class="q-pb-md">
          <div class="text-caption text-grey-6 q-mb-xs">Wednesday, Nov 3, 2025 · 1h 42m</div>
          <div class="text-h6 q-mb-md">Wingspan</div>

          <q-list dense separator>
            <q-item v-for="(p, idx) in sittingScores" :key="idx">
              <q-item-section avatar>
                <q-avatar size="28px" :style="{ backgroundColor: p.color }" />
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  {{ p.name }}<span v-if="p.isClaimant" class="text-caption text-grey-6"> (you)</span>
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-item-label :class="{ 'text-weight-bold text-secondary': p.isClaimant, 'text-weight-bold': !p.isClaimant }">{{ p.score }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <div class="text-caption text-grey-6 text-center q-mt-md">Read-only · from owner@example.com</div>
        </div>
      </div>
    </div>

    <!-- Floating variant switcher -->
    <div class="proto-switcher">
      <q-btn flat dense round icon="chevron_left" aria-label="Previous variant" @click="cycleVariant(-1)" />
      <div class="proto-switcher__label text-caption text-weight-medium">
        {{ activeVariant }} — {{ variantLabel(activeVariant) }}
      </div>
      <q-btn flat dense round icon="chevron_right" aria-label="Next variant" @click="cycleVariant(1)" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { playerBarTrackColor } from '../../game-timer/core.js'

const $q = useQuasar()
const route = useRoute()
const router = useRouter()

const VARIANTS = ['A', 'B', 'C']
const VARIANT_LABELS = {
  A: 'Slide + Card + Badge',
  B: 'Overflow + Sheet + Integrated',
  C: 'Button + Fullscreen + Minimal',
}

const activeVariant = ref('A')

const unlinkedPeople = [
  { id: 'p1', name: 'Jordan', color: '#ffe66d' },
  { id: 'p2', name: 'Taylor', color: '#a29bfe' },
]

const nonClaimablePeople = [
  { id: 'self', name: 'Alex (you)', color: '#ff6b6b', linkedTo: null },
  { id: 'p3', name: 'Sam', color: '#4ecdc4', linkedTo: 'sam@example.com' },
]

const sittingScores = [
  { name: 'Jordan', score: 87, color: '#ffe66d', isClaimant: true },
  { name: 'Alex', score: 94, color: '#ff6b6b', isClaimant: false },
  { name: 'Sam', score: 72, color: '#4ecdc4', isClaimant: false },
]

const sittingScoreRows = computed(() =>
  sittingScores.map((s, i) => ({ ...s, personId: `s${i}` })),
)

const maxScore = computed(() =>
  Math.max(0, ...sittingScoreRows.value.map((p) => Math.abs(p.score))),
)

onMounted(() => {
  // Force the audit surface dark so Quasar cards/pages don't render light on light.
  const wasDark = $q.dark.isActive
  if (!wasDark) $q.dark.set(true)

  const v = route.query.variant
  if (v && VARIANTS.includes(v)) {
    activeVariant.value = v
  }
  document.addEventListener('keydown', onKeyDown)
})

function onKeyDown(e) {
  if (isEditingElement(e.target)) return
  if (e.key === 'ArrowLeft') cycleVariant(-1)
  else if (e.key === 'ArrowRight') cycleVariant(1)
}

function isEditingElement(el) {
  if (!el) return false
  const tag = el?.tagName?.toLowerCase()
  return tag === 'input' || tag === 'textarea' || el.isContentEditable
}

function cycleVariant(dir) {
  const idx = VARIANTS.indexOf(activeVariant.value)
  activeVariant.value = VARIANTS[(idx + dir + VARIANTS.length) % VARIANTS.length]
  router.replace({ query: { variant: activeVariant.value } })
}

function variantLabel(v) {
  return VARIANT_LABELS[v] || v
}

function rowStyle(person) {
  const color = person?.color || '#78909c'
  return { backgroundColor: playerBarTrackColor(color, $q.dark.isActive) }
}

function barFillScoreStyle(player) {
  const w = maxScore.value > 0 ? `${Math.max(12, (Math.abs(player.score) / maxScore.value) * 100)}%` : '0%'
  return { width: w, backgroundColor: player.color || '#78909c' }
}

function showClaimLinkNotify(person) {
  $q.notify({ message: `Share claim link for ${person.name}`, color: 'info', timeout: 1500 })
}

function showEditNotify(person) {
  $q.notify({ message: `Edit ${person.name}`, color: 'info', timeout: 1000 })
}

function showDeleteNotify(person) {
  $q.notify({ message: `Delete ${person.name}`, color: 'negative', timeout: 1000 })
}

function signInToClaimNotify() {
  $q.notify({ message: 'Real flow: sign in → create self player → confirm claim', color: 'info', timeout: 3000 })
}
</script>

<style scoped>
.gm-person-row {
  min-height: 72px;
  color: rgba(255, 255, 255, 0.92);
}

.body--light .gm-person-row {
  color: rgba(0, 0, 0, 0.87);
}

.gm-person-row__name {
  color: inherit;
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.25;
}

.proto-switcher {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 28px;
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
  user-select: none;
}

.proto-switcher__label {
  min-width: 200px;
  text-align: center;
  line-height: 1.2;
}

/* Variant B reuses the session-statistics chart look; scoped locally. */
.gm-session-stats-charts {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  column-gap: 10px;
  row-gap: 12px;
  align-items: center;
}

.gm-session-stats-charts__title {
  grid-column: 1 / -1;
}

.gm-session-stats-bar-name {
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.2;
}

.gm-session-stats-bar-track {
  min-width: 0;
  height: 40px;
  border-radius: 6px;
  background: rgba(128, 128, 128, 0.2);
  overflow: hidden;
}

.gm-session-stats-bar-fill {
  position: relative;
  height: 100%;
  min-width: 3.25rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  padding: 0 10px;
  box-sizing: border-box;
  overflow: hidden;
}

.gm-session-stats-bar-value {
  position: relative;
  z-index: 1;
  color: #fff;
  font-size: 1.05rem;
  font-weight: 700;
  text-shadow:
    -1.5px 0 0 #000,
    1.5px 0 0 #000,
    0 -1.5px 0 #000,
    0 1.5px 0 #000;
  flex: none;
}
</style>