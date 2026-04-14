<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn
          class="xs"
          flat
          round
          dense
          icon="menu"
          aria-label="Open menu"
          @click="leftDrawerOpen = true"
        />

        <q-toolbar-title>David J. Perry</q-toolbar-title>

        <q-space class="gt-xs" />

        <div class="row items-center no-wrap gt-xs">
          <q-tabs inline-label :model-value="activePath" align="right" shrink>
            <q-route-tab
              v-for="t in navTabs"
              :key="t.to"
              :to="t.to"
              :name="t.to"
              :icon="t.icon"
              :label="t.label"
            />
          </q-tabs>
          <q-btn-dropdown
            flat
            dense
            stretch
            label="Projects"
            dropdown-icon="expand_more"
            class="q-ml-xs"
          >
            <q-list dense style="min-width: 220px">
              <q-item
                v-for="p in projectLinks"
                :key="p.to"
                v-ripple
                clickable
                @click="openProjectInNewTab(p.to)"
              >
                <q-item-section avatar>
                  <q-icon :name="p.icon" />
                </q-item-section>
                <q-item-section>{{ p.label }}</q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>
        </div>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" overlay bordered class="xs">
      <q-list padding>
        <q-item
          v-for="t in navTabs"
          :key="t.to"
          v-ripple
          clickable
          :to="t.to"
          :active="route.path === t.to"
          active-class="bg-grey-3 text-weight-medium"
          @click="leftDrawerOpen = false"
        >
          <q-item-section avatar>
            <q-icon :name="t.icon" />
          </q-item-section>
          <q-item-section>{{ t.label }}</q-item-section>
        </q-item>

        <q-expansion-item
          v-model="projectsDrawerExpanded"
          icon="folder"
          label="Projects"
          expand-separator
        >
          <q-item
            v-for="p in projectLinks"
            :key="p.to"
            v-ripple
            clickable
            :inset-level="1"
            @click="openProjectInNewTab(p.to)"
          >
            <q-item-section avatar>
              <q-icon :name="p.icon" />
            </q-item-section>
            <q-item-section>{{ p.label }}</q-item-section>
          </q-item>
        </q-expansion-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const navTabs = [
  { to: '/', label: 'Photography', icon: 'photo_library' },
  { to: '/about', label: 'About', icon: 'info' },
]

const projectLinks = [
  { to: '/projects/game-timer', label: 'Game Timer', icon: 'timer' },
  { to: '/projects/movie-vote', label: 'Movie Vote', icon: 'movie' },
]

const route = useRoute()
const router = useRouter()
const leftDrawerOpen = ref(false)
const projectsDrawerExpanded = ref(false)

watch(
  () => route.path,
  () => {
    leftDrawerOpen.value = false
  },
)

function openProjectInNewTab (to) {
  const { href } = router.resolve(to)
  window.open(href, '_blank', 'noopener,noreferrer')
  leftDrawerOpen.value = false
}

const activePath = computed(() => route.path)
</script>
