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
            content-class="bg-toolbar-menu"
          >
            <q-list
              dense
              class="bg-toolbar-menu"
              style="min-width: 220px"
            >
              <q-expansion-item
                v-for="section in projectSections"
                :key="section.label"
                dense
                expand-separator
                group="projects-nav-dropdown"
                :label="section.label"
              >
                <template v-if="section.links.length">
                  <q-item
                    v-for="p in section.links"
                    :key="p.to"
                    v-ripple
                    clickable
                    v-close-popup
                    @click="openProjectInNewTab(p.to)"
                  >
                    <q-item-section avatar>
                      <q-icon :name="p.icon" />
                    </q-item-section>
                    <q-item-section>{{ p.label }}</q-item-section>
                  </q-item>
                </template>
                <q-item
                  v-else-if="section.comingSoon"
                  disabled
                >
                  <q-item-section class="text-grey-4 text-caption">
                    Coming soon
                  </q-item-section>
                </q-item>
              </q-expansion-item>
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
          <q-expansion-item
            v-for="section in projectSections"
            :key="section.label"
            :label="section.label"
            :header-inset-level="1"
            expand-separator
            group="projects-nav-drawer"
          >
            <template v-if="section.links.length">
              <q-item
                v-for="p in section.links"
                :key="p.to"
                v-ripple
                clickable
                :inset-level="2"
                @click="openProjectInNewTab(p.to)"
              >
                <q-item-section avatar>
                  <q-icon :name="p.icon" />
                </q-item-section>
                <q-item-section>{{ p.label }}</q-item-section>
              </q-item>
            </template>
            <q-item
              v-else-if="section.comingSoon"
              disabled
              :inset-level="2"
            >
              <q-item-section class="text-grey-4 text-caption">
                Coming soon
              </q-item-section>
            </q-item>
          </q-expansion-item>
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

const projectSections = [
  {
    label: 'Mobile',
    links: [
      { to: '/projects/game-timer', label: 'Game Timer', icon: 'timer' },
      { to: '/projects/movie-vote', label: 'Movie Vote', icon: 'movie' },
      { to: '/projects/dungeon-runner', label: 'Dungeon Runner', icon: 'shield' },
    ],
  },
  {
    label: 'Desktop',
    comingSoon: true,
    links: [],
  },
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
