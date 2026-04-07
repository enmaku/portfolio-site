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

        <q-tabs inline-label :model-value="activePath" align="right" shrink class="gt-xs">
          <q-route-tab
            v-for="t in navTabs"
            :key="t.to"
            :to="t.to"
            :name="t.to"
            :icon="t.icon"
            :label="t.label"
          />
        </q-tabs>
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
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const navTabs = [
  { to: '/', label: 'Photography', icon: 'photo_library' },
  { to: '/about', label: 'About', icon: 'info' },
]

const route = useRoute()
const leftDrawerOpen = ref(false)

watch(
  () => route.path,
  () => {
    leftDrawerOpen.value = false
  },
)

const activePath = computed(() => route.path)
</script>
