<template>
  <div class="player-claim-prototype">
    <div class="prototype-header bg-grey-9 text-white q-pa-md">
      <div class="text-overline text-grey-6">PROTOTYPE — THROWAWAY CODE</div>
      <div class="text-h6">Player Claim UI</div>
      <div class="text-caption q-mt-sm">
        Three moments: People row control, claimant screen, foreign sitting
      </div>
    </div>

    <div class="variant-switcher q-pa-md bg-grey-2">
      <div class="text-caption text-grey-7 q-mb-sm">Switch moment:</div>
      <q-btn-group>
        <q-btn
          :color="variant === 'people-row' ? 'primary' : 'grey-7'"
          label="People row"
          @click="variant = 'people-row'"
        />
        <q-btn
          :color="variant === 'claimant-screen' ? 'primary' : 'grey-7'"
          label="Claimant screen"
          @click="variant = 'claimant-screen'"
        />
        <q-btn
          :color="variant === 'foreign-sitting' ? 'primary' : 'grey-7'"
          label="Foreign sitting"
          @click="variant = 'foreign-sitting'"
        />
      </q-btn-group>
    </div>

    <!-- Moment 1: People row with claim control -->
    <div v-if="variant === 'people-row'" class="prototype-content q-pa-md">
      <div class="text-subtitle1 q-mb-md">People list — unlinked recorded player row</div>

      <div class="bg-white rounded-borders q-pa-md" style="max-width: 400px">
        <div class="text-caption text-grey-6 q-mb-sm">Your people (owner view)</div>

        <!-- Self player row (no claim control) -->
        <q-item class="q-pa-sm rounded-borders bg-grey-1 q-mb-sm">
          <q-item-section avatar>
            <div class="rounded-borders" style="width: 32px; height: 32px; background: #ff6b6b" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-bold">Alex (you)</q-item-label>
            <q-item-label caption class="text-grey-7">Self player — linked</q-item-label>
          </q-item-section>
        </q-item>

        <!-- Linked recorded player (no claim control) -->
        <q-item class="q-pa-sm rounded-borders bg-grey-1 q-mb-sm">
          <q-item-section avatar>
            <div class="rounded-borders" style="width: 32px; height: 32px; background: #4ecdc4" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-bold">Sam</q-item-label>
            <q-item-label caption class="text-grey-7">Linked to sam@example.com</q-item-label>
          </q-item-section>
        </q-item>

        <!-- Unlinked recorded player (CLAIM CONTROL) -->
        <q-item class="q-pa-sm rounded-borders bg-primary text-white">
          <q-item-section avatar>
            <div class="rounded-borders" style="width: 32px; height: 32px; background: #ffe66d" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-bold">Jordan</q-item-label>
            <q-item-label caption class="text-white-70">Unlinked — claim available</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn
              dense
              flat
              color="white"
              icon="share"
              label="Claim link"
              @click="showClaimLinkDialog = true"
            />
          </q-item-section>
        </q-item>
      </div>

      <div class="text-caption text-grey-6 q-mt-md">
        <strong>Design decision:</strong> Claim control appears as a secondary action on unlinked
        recorded player rows. Self player and linked players have no claim control.
      </div>
    </div>

    <!-- Moment 2: Claimant landing screen -->
    <div v-if="variant === 'claimant-screen'" class="prototype-content q-pa-md">
      <div class="text-subtitle1 q-mb-md">Claimant lands on claim link</div>

      <div class="bg-white rounded-borders q-pa-md" style="max-width: 400px">
        <div class="text-caption text-grey-6 q-mb-sm">Visitor view (not signed in yet)</div>

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

      <div class="text-caption text-grey-6 q-mt-md">
        <strong>Design decision:</strong> Claim screen explains read access scope clearly before
        confirmation. New accounts create self player first, then claim.
      </div>
    </div>

    <!-- Moment 3: Foreign sitting view -->
    <div v-if="variant === 'foreign-sitting'" class="prototype-content q-pa-md">
      <div class="text-subtitle1 q-mb-md">Claimant views a foreign sitting</div>

      <div class="bg-white rounded-borders q-pa-md" style="max-width: 400px">
        <div class="text-caption text-grey-6 q-mb-sm">Claimant view (after successful claim)</div>

        <q-card>
          <q-card-section>
            <div class="text-subtitle2 text-grey-7">Session from owner@example.com</div>
            <div class="text-h6 q-mt-sm">Terraforming Mars</div>
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
                <div class="rounded-borders q-mr-sm" style="width: 24px; height: 24px; background: #ffe66d" />
                <div class="col text-body2">Jordan (you)</div>
                <div class="text-body2 text-weight-bold">142</div>
              </div>
              <div class="row items-center q-mb-sm">
                <div class="rounded-borders q-mr-sm" style="width: 24px; height: 24px; background: #ff6b6b" />
                <div class="col text-body2">Alex</div>
                <div class="text-body2 text-weight-bold">156</div>
              </div>
              <div class="row items-center">
                <div class="rounded-borders q-mr-sm" style="width: 24px; height: 24px; background: #4ecdc4" />
                <div class="col text-body2">Sam</div>
                <div class="text-body2 text-weight-bold">128</div>
              </div>
            </div>
          </q-card-section>

          <q-card-actions>
            <q-btn flat color="grey" label="Close" />
            <q-space />
            <div class="text-caption text-grey-6 italic">Read-only — owner's sitting</div>
          </q-card-actions>
        </q-card>
      </div>

      <div class="text-caption text-grey-6 q-mt-md">
        <strong>Design decision:</strong> Foreign sittings show full session detail but are clearly
        marked as read-only. No edit controls, only view. Claimant sees their own score highlighted.
      </div>
    </div>

    <!-- Claim link dialog -->
    <q-dialog v-model="showClaimLinkDialog">
      <q-card class="q-pa-md" style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">Share claim link</div>
          <div class="text-body2 q-mt-sm">
            Send this link to <strong>Jordan</strong> so they can claim their play sessions.
          </div>
        </q-card-section>

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
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useQuasar } from 'quasar'

const $q = useQuasar()

const variant = ref('people-row')
const showClaimLinkDialog = ref(false)
const claimLink = ref('https://portfolio.example.com/claim?owner=owner@example.com&player=jordan-id')

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
.player-claim-prototype {
  max-width: 600px;
  margin: 0 auto;
}

.prototype-header {
  border-radius: 8px 8px 0 0;
}

.variant-switcher {
  border-radius: 0 0 8px 8px;
  border-top: 1px solid #e0e0e0;
}

.prototype-content {
  background: #f5f5f5;
  min-height: 400px;
}
</style>
