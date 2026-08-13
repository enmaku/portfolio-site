<template>
  <q-page class="gm-page column fit no-wrap">
    <div v-if="loading" class="col flex flex-center" data-testid="gm-page-loading">
      <q-circular-progress indeterminate size="32px" color="primary" />
    </div>

    <div v-else-if="!isAccountOwner" class="col flex flex-center q-pa-md">
      <GameManagerSignInPanel class="full-width" />
    </div>

    <template v-else>
      <div class="gm-page__header row items-center no-wrap q-px-md q-pt-md q-pb-sm">
        <MeepleIcon size="md" class="q-mr-sm" />
        <div class="text-h6 text-weight-medium col">Game Manager</div>
        <q-btn
          flat
          dense
          round
          icon="help_outline"
          color="grey-5"
          aria-label="Help and about"
          data-testid="gm-page-help-btn"
          @click="helpOpen = true"
        />
        <q-btn
          flat
          dense
          round
          icon="logout"
          color="grey-5"
          aria-label="Sign out"
          data-testid="gm-page-sign-out-btn"
          :loading="signOutPending"
          @click="signOutConfirmOpen = true"
        />
      </div>

      <q-tab-panels v-model="activeSurface" animated class="col gm-page__panels">
        <q-tab-panel name="collection" class="q-pa-none">
          <GameManagerSurfaceCollection />
        </q-tab-panel>
        <q-tab-panel name="people" class="q-pa-none">
          <GameManagerSurfacePeople />
        </q-tab-panel>
        <q-tab-panel name="sessions" class="q-pa-none">
          <GameManagerSurfaceSessions :sessions-api="sessionsApi" />
        </q-tab-panel>
        <q-tab-panel name="stats" class="q-pa-none">
          <GameManagerSurfaceStats />
        </q-tab-panel>
      </q-tab-panels>

      <div class="gm-nav-bar">
        <q-tabs
          v-model="activeSurface"
          dense
          no-caps
          align="justify"
          active-color="primary"
          indicator-color="primary"
          class="gm-nav-bar__tabs text-grey-5"
        >
          <q-tab name="collection" icon="collections_bookmark" label="Collection" />
          <q-tab name="people" icon="groups" label="Players" />
          <q-tab name="sessions" icon="event_note" label="Sessions" />
          <q-tab name="stats" icon="bar_chart" label="Stats" />
        </q-tabs>
      </div>

      <GameManagerSessionFlowHost />

      <q-dialog v-model="helpOpen">
        <q-card class="gm-dialog-card gm-dialog-card--narrow">
          <q-card-section class="text-h6">Help &amp; about</q-card-section>
          <q-separator />
          <q-card-section class="text-body2" data-testid="gm-page-help-attribution">
            {{ attribution }}
            <div class="q-mt-sm">
              <a
                href="https://boardgamegeek.com/wiki/page/BGG_XML_API2"
                target="_blank"
                rel="noreferrer"
                class="text-primary"
                style="text-decoration: none"
              >
                BoardGameGeek XML API
              </a>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Close" color="primary" v-close-popup />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <q-dialog v-model="signOutConfirmOpen" persistent>
        <q-card class="gm-dialog-card gm-dialog-card--narrow">
          <q-card-section class="text-h6">Sign out?</q-card-section>
          <q-card-section class="q-pt-none text-body2">
            Sign out of Game Manager on this device?
          </q-card-section>
          <q-card-actions align="right">
            <q-btn
              flat
              label="Cancel"
              color="grey"
              data-testid="gm-page-sign-out-cancel"
              @click="signOutConfirmOpen = false"
            />
            <q-btn
              unelevated
              label="Sign out"
              color="primary"
              data-testid="gm-page-sign-out-confirm"
              :loading="signOutPending"
              @click="confirmSignOut"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </template>
  </q-page>
</template>

<script setup>
import { provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MeepleIcon from '../../components/MeepleIcon.vue'
import { CATALOG_ATTRIBUTION } from '../../features/game-manager/catalog/catalogAttribution.js'
import GameManagerSignInPanel from '../../features/game-manager/components/GameManagerSignInPanel.vue'
import GameManagerSessionFlowHost from '../../features/game-manager/components/GameManagerSessionFlowHost.vue'
import GameManagerSurfaceCollection from '../../features/game-manager/components/GameManagerSurfaceCollection.vue'
import GameManagerSurfacePeople from '../../features/game-manager/components/GameManagerSurfacePeople.vue'
import GameManagerSurfaceSessions from '../../features/game-manager/components/GameManagerSurfaceSessions.vue'
import GameManagerSurfaceStats from '../../features/game-manager/components/GameManagerSurfaceStats.vue'
import { GAME_MANAGER_SESSION_FLOW_KEY } from '../../features/game-manager/composables/sessionFlowKey.js'
import { useGameManagerAuth } from '../../features/game-manager/composables/useGameManagerAuth.js'
import { useGameManagerSessionFlow } from '../../features/game-manager/composables/useGameManagerSessionFlow.js'
import { useGameManagerSessions } from '../../features/game-manager/composables/useGameManagerSessions.js'
import { useManagerTimerLink } from '../../features/game-manager/composables/useManagerTimerLink.js'
import { GM_CONTINUE_QUERY_KEY } from '../../features/game-manager/domain/timerLinkOrchestration.js'

const { isAccountOwner, loading, signOut } = useGameManagerAuth()

const activeSurface = ref('collection')
const signOutPending = ref(false)
const signOutConfirmOpen = ref(false)
const helpOpen = ref(false)
const attribution = CATALOG_ATTRIBUTION
const route = useRoute()
const router = useRouter()

const sessionsApi = useGameManagerSessions()
const timerLink = useManagerTimerLink({ router })
const sessionFlow = useGameManagerSessionFlow({
  sessionsApi,
  activeSurface,
  timerLink,
})
provide(GAME_MANAGER_SESSION_FLOW_KEY, sessionFlow)

async function consumeTimerContinueQuery() {
  if (!isAccountOwner.value) return
  const raw = route.query[GM_CONTINUE_QUERY_KEY]
  if (raw === undefined || raw === null) return
  const playSessionId = Array.isArray(raw) ? raw[0] : raw
  if (!String(playSessionId || '').trim()) return

  const nextQuery = { ...route.query }
  delete nextQuery[GM_CONTINUE_QUERY_KEY]
  await router.replace({
    path: route.path,
    query: nextQuery,
    hash: route.hash,
  })

  await sessionsApi.reload()
  await sessionFlow.openScoringFromTimerContinue(String(playSessionId))
}

watch(
  () => [isAccountOwner.value, loading.value, route.query[GM_CONTINUE_QUERY_KEY]],
  () => {
    if (loading.value) return
    void consumeTimerContinueQuery()
  },
  { immediate: true },
)

async function confirmSignOut() {
  signOutPending.value = true
  try {
    await signOut()
    signOutConfirmOpen.value = false
  } finally {
    signOutPending.value = false
  }
}
</script>

<style scoped lang="scss">
.gm-page {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

.gm-page__header {
  flex-shrink: 0;
}

.gm-page__panels {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;

  :deep(.q-tab-panel) {
    height: 100%;
    overflow: hidden;
  }
}

.gm-nav-bar {
  flex-shrink: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.body--light .gm-nav-bar {
  border-top-color: rgba(0, 0, 0, 0.08);
}
</style>
