<template>
  <div class="tt-stats-table-wrap">
    <q-markup-table
      flat
      dense
      wrap-cells
      separator="horizontal"
      class="tt-stats-table"
      :data-testid="testId"
    >
      <thead>
        <tr>
          <th class="text-left">Name</th>
          <th class="text-right">Hours</th>
          <th class="text-right">Income</th>
          <th class="text-right">$/hr</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key">
          <td>
            <span class="tt-stats-name-cell">
              <span
                v-if="row.color"
                class="tt-stats-swatch"
                :style="{ backgroundColor: row.color }"
                aria-hidden="true"
              />
              <span class="tt-stats-name">{{ row.name }}</span>
            </span>
          </td>
          <td class="text-right tt-stats-num">{{ formatDurationMs(row.hoursMs) }}</td>
          <td class="text-right tt-stats-num">{{ formatUsdFromCents(row.incomeCents) }}</td>
          <td class="text-right tt-stats-num">{{ formatRate(row.dollarsPerHour) }}</td>
        </tr>
      </tbody>
    </q-markup-table>
  </div>
</template>

<script setup>
import { formatDurationMs, formatUsd, formatUsdFromCents } from '../formatDisplay.js'

defineProps({
  rows: { type: Array, required: true },
  testId: { type: String, required: true },
})

function formatRate(value) {
  if (value == null) return '—'
  return formatUsd(value)
}
</script>

<style scoped>
.tt-stats-table-wrap {
  width: 100%;
  min-width: 0;
  overflow-x: auto;
}

.tt-stats-table :deep(table) {
  table-layout: fixed;
  width: 100%;
}

.tt-stats-table :deep(th),
.tt-stats-table :deep(td) {
  vertical-align: middle;
}

.tt-stats-table :deep(th:first-child),
.tt-stats-table :deep(td:first-child) {
  width: 38%;
}

.tt-stats-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.tt-stats-name {
  min-width: 0;
  overflow-wrap: anywhere;
}

.tt-stats-num {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.tt-stats-swatch {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
</style>
