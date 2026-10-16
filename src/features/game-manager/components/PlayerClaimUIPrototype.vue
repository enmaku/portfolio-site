<template>
  <div data-testid="gm-surface" class="gm-surface">
    <!-- Variant switcher bar -->
    <div class="variant-bar bg-grey-9 text-white q-pa-sm">
      <div class="text-overline text-grey-6">PROTOTYPE — THROWAWAY CODE</div>
      <div class="text-caption">Player Claim UI Variant: {{ variantName }}</div>
    </div>

    <div class="variant-switcher q-pa-sm bg-grey-2">
      <div class="row q-gutter-xs">
        <q-btn
          dense
          :color="variant === 'people-a' ? 'primary' : 'grey-7'"
          label="People A"
          size="sm"
          @click="setVariant('people-a')"
        />
        <q-btn
          dense
          :color="variant === 'people-b' ? 'primary' : 'grey-7'"
          label="People B"
          size="sm"
          @click="setVariant('people-b')"
        />
        <q-btn
          dense
          :color="variant === 'claim-a' ? 'primary' : 'grey-7'"
          label="Claim A"
          size="sm"
          @click="setVariant('claim-a')"
        />
        <q-btn
          dense
          :color="variant === 'claim-b' ? 'primary' : 'grey-7'"
          label="Claim B"
          size="sm"
          @click="setVariant('claim-b')"
        />
        <q-btn
          dense
          :color="variant === 'sitting-a' ? 'primary' : 'grey-7'"
          label="Sitting A"
          size="sm"
          @click="setVariant('sitting-a')"
        />
        <q-btn
          dense
          :color="variant === 'sitting-b' ? 'primary' : 'grey-7'"
          label="Sitting B"
          size="sm"
          @click="setVariant('sitting-b')"
        />
      </div>
    </div>

    <!-- Variant: People A - Slide action for claim -->
    <div v-if="variant === 'people-a'" class="gm-surface__scroll q-pa-md">
      <div class="text-caption text-grey-6 q-mb-sm">
        Variant A: Claim as left slide action (like edit)
      </div>

      <div
        v-if="!people.length"
        class="gm-empty column items-center q-mx-auto q-py-xl text-center text-grey-5"
      >
        <p class="q-mb-sm text-body1">No people yet.</p>
      </div>

      <div v-else data-testid="gm-people-list">
        <!-- Self player - no claim -->
        <q-slide-item
          v-for="person in selfPlayers"
          :key="person.id"
          class="gm-slide rounded-borders overflow-hidden q-mb-sm"
          left-color="primary"
          right-color="negative"
          @left="(e) => openEditSlide(e, person)"
          @right="(e) => requestDelete(e, person)"
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
              <q-item-label caption class="text-white-70">Self player</q-item-label>
            </q-item-section>
          </q-item>
        </q-slide-item>

        <!-- Linked player - no claim -->
        <q-slide-item
          v-for="person in linkedPlayers"
          :key="person.id"
          class="gm-slide rounded-borders overflow-hidden q-mb-sm"
          left-color="primary"
          right-color="negative"
          @left="(e) => openEditSlide(e, person)"
          @right="(e) => requestDelete(e, person)"
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
              <q-item-label caption class="text-white-70"
                >Linked to {{ person.linkedAccount }}</q-item-label
              >
            </q-item-section>
          </q-item>
        </q-slide-item>

        <!-- Unlinked player - claim available -->
        <q-slide-item
          v-for="person in unlinkedPlayers"
          :key="person.id"
          class="gm-slide rounded-borders overflow-hidden q-mb-sm"
          left-color="primary"
          right-color="secondary"
          @left="(e) => openClaimSlide(e, person)"
          @right="(e) => requestDelete(e, person)"
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
              <q-item-label caption class="text-white-70"
                >Unlinked — swipe left to claim</q-item-label
              >
            </q-item-section>
          </q-item>
        </q-slide-item>
      </div>
    </div>

    <!-- Variant: People B - Overflow menu action -->
    <div v-if="variant === 'people-b'" class="gm-surface__scroll q-pa-md">
      <div class="text-caption text-grey-6 q-mb-sm">
        Variant B: Claim in overflow menu (three-dot)
      </div>

      <div
        v-if="!people.length"
        class="gm-empty column items-center q-mx-auto q-py-xl text-center text-grey-5"
      >
        <p class="q-mb-sm text-body1">No people yet.</p>
      </div>

      <div v-else data-testid="gm-people-list">
        <q-item
          v-for="person in allPeople"
          :key="person.id"
          clickable
          v-ripple
          class="gm-person-row rounded-borders q-mb-sm"
          :style="rowStyle(person)"
        >
          <q-item-section>
            <q-item-label class="gm-person-row__name ellipsis">{{ person.name }}</q-item-label>
            <q-item-label caption class="text-white-70">{{ person.status }}</q-item-label>
          </q-item-section>
          <q-item-section side v-if="person.canClaim">
            <q-btn flat dense round icon="more_vert" @click.stop="showPersonMenu(person)" />
          </q-item-section>
        </q-item>
      </div>
    </div>

    <!-- Variant: Claim A - Card dialog -->
    <div v-if="variant === 'claim-a'" class="gm-surface__scroll q-pa-md">
      <div class="text-caption text-grey-6 q-mb-sm">Variant A: Card dialog with clear sections</div>

      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6">Claim this player?</div>
          <div class="text-body2 q-mt-sm">
            <strong>owner@example.com</strong> is offering you access to sittings where
            <strong>Jordan</strong> played.
          </div>
        </q-card-section>

        <q-card-section class="bg-grey-1 q-pa-sm">
          <div class="text-subtitle2">What you'll see:</div>
          <ul class="q-mt-sm q-pl-md text-body2">
            <li>All sittings where Jordan was a present player</li>
            <li>Scores, play time, and statistics for those sittings</li>
            <li>Owner's edits to those sittings</li>
          </ul>
          <div class="text-subtitle2 q-mt-md">What you won't see:</div>
          <ul class="q-mt-sm q-pl-md text-body2">
            <li>The owner's game collection</li>
            <li>Sittings where Jordan wasn't present</li>
            <li>The owner's other people</li>
          </ul>
        </q-card-section>

        <q-card-actions vertical>
          <q-btn color="primary" label="Sign in to claim" @click="signInToClaim" />
          <q-btn flat color="grey" label="Cancel" />
        </q-card-actions>
      </q-card>
    </div>

    <!-- Variant: Claim B - Compact sheet -->
    <div v-if="variant === 'claim-b'" class="gm-surface__scroll q-pa-md">
      <div class="text-caption text-grey-6 q-mb-sm">Variant B: Compact bottom sheet</div>

      <q-card class="q-mb-md">
        <q-card-section class="row items-center">
          <div
            class="rounded-borders q-mr-md"
            style="width: 48px; height: 48px; background: #ffe66d"
          />
          <div>
            <div class="text-h6">Claim Jordan</div>
            <div class="text-caption text-grey-7">From owner@example.com</div>
          </div>
        </q-card-section>

        <q-card-section class="q-pt-none text-body2">
          You'll read all sittings where Jordan played. The owner's collection stays private.
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat color="grey" label="Cancel" />
          <q-btn unelevated color="primary" label="Claim" @click="signInToClaim" />
        </q-card-actions>
      </q-card>
    </div>

    <!-- Variant: Sitting A - Full session card -->
    <div v-if="variant === 'sitting-a'" class="gm-surface__scroll q-pa-md">
      <div class="text-caption text-grey-6 q-mb-sm">
        Variant A: Full session card with read-only badge
      </div>

      <q-card>
        <q-card-section>
          <div class="row items-center q-mb-sm">
            <q-chip size="sm" color="grey-7" text-color="white" icon="lock"> Read-only </q-chip>
            <q-space />
            <div class="text-caption text-grey-6">From owner@example.com</div>
          </div>
          <div class="text-h6">Terraforming Mars</div>
          <div class="text-body2 text-grey-7">Recorded Jan 15, 2026</div>
        </q-card-section>

        <q-separator />

        <q-card-section>
          <div class="text-subtitle2">Session statistics</div>
          <div class="row q-mt-sm q-gutter-md">
            <div class="col">
              <div class="text-caption text-grey-6">Play time</div>
              <div class="text-body1 text-weight-bold">2h 15m</div>
            </div>
            <div class="col">
              <div class="text-caption text-grey-6">Your score</div>
              <div class="text-body1 text-weight-bold">142</div>
            </div>
          </div>
        </q-card-section>

        <q-card-section class="bg-grey-1 q-pa-sm">
          <div class="text-subtitle2">Scores</div>
          <div class="q-mt-sm">
            <div class="row items-center q-mb-sm">
              <div
                class="rounded-borders q-mr-sm"
                style="width: 24px; height: 24px; background: #ffe66d"
              />
              <div class="col text-body2">Jordan (you)</div>
              <div class="text-body2 text-weight-bold">142</div>
            </div>
            <div class="row items-center q-mb-sm">
              <div
                class="rounded-borders q-mr-sm"
                style="width: 24px; height: 24px; background: #ff6b6b"
              />
              <div class="col text-body2">Alex</div>
              <div class="text-body2 text-weight-bold">156</div>
            </div>
            <div class="row items-center">
              <div
                class="rounded-borders q-mr-sm"
                style="width: 24px; height: 24px; background: #4ecdc4"
              />
              <div class="col text-body2">Sam</div>
              <div class="text-body2 text-weight-bold">128</div>
            </div>
          </div>
        </q-card-section>

        <q-card-actions>
          <q-btn flat color="grey" label="Close" />
        </q-card-actions>
      </q-card>
    </div>

    <!-- Variant: Sitting B - Stats panel style -->
    <div v-if="variant === 'sitting-b'" class="gm-surface__scroll q-pa-md">
      <div class="text-caption text-grey-6 q-mb-sm">
        Variant B: Stats panel style (like session statistics)
      </div>

      <div class="text-subtitle2 text-grey-7 q-mb-sm">Session from owner@example.com</div>

      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6">Terraforming Mars</div>
          <div class="text-body2 text-grey-7">Jan 15, 2026</div>
        </q-card-section>

        <q-separator />

        <q-card-section>
          <div class="text-subtitle2">Session statistics</div>
          <div class="row q-mt-sm q-gutter-md">
            <div class="col">
              <div class="text-caption text-grey-6">Play time</div>
              <div class="text-body1 text-weight-bold">2h 15m</div>
            </div>
            <div class="col">
              <div class="text-caption text-grey-6">Your score</div>
              <div class="text-body1 text-weight-bold">142</div>
            </div>
          </div>
        </q-card-section>

        <q-card-section class="bg-grey-1 q-pa-sm">
          <div class="text-subtitle2">Scores</div>
          <div class="q-mt-sm">
            <div class="row items-center q-mb-sm">
              <div
                class="rounded-borders q-mr-sm"
                style="width: 24px; height: 24px; background: #ffe66d"
              />
              <div class="col text-body2">Jordan (you)</div>
              <div class="text-body2 text-weight-bold">142</div>
            </div>
            <div class="row items-center q-mb-sm">
              <div
                class="rounded-borders q-mr-sm"
                style="width: 24px; height: 24px; background: #ff6b6b"
              />
              <div class="col text-body2">Alex</div>
              <div class="text-body2 text-weight-bold">156</div>
            </div>
            <div class="row items-center">
              <div
                class="rounded-borders q-mr-sm"
                style="width: 24px; height: 24px; background: #4ecdc4"
              />
              <div class="col text-body2">Sam</div>
              <div class="text-body2 text-weight-bold">128</div>
            </div>
          </div>
        </q-card-section>

        <q-card-actions>
          <q-btn flat color="grey" label="Close" />
          <q-space />
          <div class="text-caption text-grey-6 italic">Read-only</div>
        </q-card-actions>
      </q-card>
    </div>

    <!-- Claim link dialog -->
    <q-dialog v-model="showClaimLinkDialog">
      <q-card class="gm-dialog-card gm-dialog-card--narrow">
        <q-card-section class="text-h6">Share claim link</q-card-section>
        <q-card-section class="q-pt-none">
          <q-input
            :model-value="claimLink"
            outlined
            dense
            readonly
            label="Claim link"
            class="q-mb-sm"
          >
            <template #append>
              <q-btn flat dense icon="content_copy" @click="copyClaimLink" />
            </template>
          </q-input>
          <div class="text-caption text-grey-6">
            Link works until Jordan is linked or deleted. First successful claim wins.
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Done" color="primary" @click="showClaimLinkDialog = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Person menu (Variant B) -->
    <q-menu v-model="personMenuOpen" anchor="bottom right" self="top right">
      <q-list dense style="min-width: 150px">
        <q-item clickable v-close-popup @click="showClaimLinkDialog = true">
          <q-item-section>Share claim link</q-item-section>
        </q-item>
        <q-item clickable v-close-popup>
          <q-item-section>Edit</q-item-section>
        </q-item>
        <q-item clickable v-close-popup>
          <q-item-section>Delete</q-item-section>
        </q-item>
      </q-list>
    </q-menu>
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

const variant = ref('people-a')
const showClaimLinkDialog = ref(false)
const personMenuOpen = ref(false)
const selectedPerson = ref(null)
const claimLink = ref(
  'https://portfolio.example.com/claim?owner=owner@example.com&player=jordan-id',
)

const variantName = computed(() => {
  const names = {
    'people-a': 'People A (slide action)',
    'people-b': 'People B (overflow menu)',
    'claim-a': 'Claim A (card dialog)',
    'claim-b': 'Claim B (compact sheet)',
    'sitting-a': 'Sitting A (full card)',
    'sitting-b': 'Sitting B (stats panel)',
  }
  return names[variant.value] || variant.value
})

const selfPlayers = ref([
  { id: 'self-1', name: 'Alex (you)', color: '#ff6b6b', status: 'Self player' },
])

const linkedPlayers = ref([
  {
    id: 'linked-1',
    name: 'Sam',
    color: '#4ecdc4',
    status: 'Linked to sam@example.com',
    linkedAccount: 'sam@example.com',
  },
])

const unlinkedPlayers = ref([
  { id: 'unlinked-1', name: 'Jordan', color: '#ffe66d', status: 'Unlinked — claim available' },
])

const allPeople = computed(() => [
  ...selfPlayers.value.map((p) => ({ ...p, canClaim: false })),
  ...linkedPlayers.value.map((p) => ({ ...p, canClaim: false })),
  ...unlinkedPlayers.value.map((p) => ({ ...p, canClaim: true })),
])

onMounted(() => {
  const variantParam = route.query.variant
  if (
    variantParam &&
    ['people-a', 'people-b', 'claim-a', 'claim-b', 'sitting-a', 'sitting-b'].includes(variantParam)
  ) {
    variant.value = variantParam
  }
})

function setVariant(newVariant) {
  variant.value = newVariant
  router.replace({ query: { variant: newVariant } })
}

function rowStyle(person) {
  const color = typeof person?.color === 'string' && person.color ? person.color : '#78909c'
  return {
    backgroundColor: playerBarTrackColor(color, $q.dark.isActive),
  }
}

function openEditSlide(detail, person) {
  detail.reset()
  $q.notify({
    message: `Edit ${person.name}`,
    color: 'info',
    timeout: 1000,
  })
}

function openClaimSlide(detail, person) {
  detail.reset()
  $q.notify({
    message: `Share claim link for ${person.name}`,
    color: 'info',
    timeout: 1000,
  })
  showClaimLinkDialog.value = true
}

function requestDelete(detail, person) {
  detail.reset()
  $q.notify({
    message: `Delete ${person.name}`,
    color: 'negative',
    timeout: 1000,
  })
}

function showPersonMenu(person) {
  selectedPerson.value = person
  personMenuOpen.value = true
}

function signInToClaim() {
  $q.notify({
    message: 'In real flow: sign in → create self player → confirm claim',
    color: 'info',
    timeout: 3000,
  })
}

function copyClaimLink() {
  navigator.clipboard.writeText(claimLink.value)
  $q.notify({
    message: 'Link copied to clipboard',
    color: 'positive',
    timeout: 1500,
  })
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

.variant-bar {
  position: sticky;
  top: 0;
  z-index: 10;
}

.variant-switcher {
  position: sticky;
  top: 48px;
  z-index: 9;
  border-bottom: 1px solid #e0e0e0;
}
</style>
