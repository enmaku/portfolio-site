<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-toolbar-title>Photography</q-toolbar-title>

        <q-space />

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
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const navTabs = [
  { to: '/', label: 'Gallery', icon: 'photo_library' },
  { to: '/about', label: 'About', icon: 'info' },
  { to: '/contact', label: 'Contact', icon: 'mail' },
]

const route = useRoute()

const activePath = computed(() => route.path)
</script>
