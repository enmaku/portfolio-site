<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="leftDrawerOpen = !leftDrawerOpen"
          class="lt-md"
        />

        <q-toolbar-title>Photography</q-toolbar-title>

        <q-space />

        <q-tabs inline-label class="gt-sm" :model-value="activePath" align="right">
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

    <q-drawer v-model="leftDrawerOpen" show-if-above bordered>
      <q-list>
        <q-item-label header>Navigation</q-item-label>

        <q-item
          v-for="t in navTabs"
          :key="t.to"
          clickable
          v-ripple
          :to="t.to"
        >
          <q-item-section avatar>
            <q-icon :name="t.icon" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ t.label }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

const navTabs = [
  { to: '/', label: 'Gallery', icon: 'photo_library' },
  { to: '/about', label: 'About', icon: 'info' },
  { to: '/contact', label: 'Contact', icon: 'mail' },
]

const route = useRoute()

const activePath = computed(() => route.path)

const leftDrawerOpen = ref(false)
</script>
