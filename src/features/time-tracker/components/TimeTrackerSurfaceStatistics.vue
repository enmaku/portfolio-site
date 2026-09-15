<template>
  <div class="tt-surface" data-testid="tt-surface-statistics">
    <div class="tt-surface__scroll">
      <div class="tt-stats">
        <q-select
          v-model="preset"
          :options="periodOptions"
          emit-value
          map-options
          outlined
          dense
          label="Period"
          class="full-width"
          data-testid="tt-stats-period"
        />

        <div v-if="preset === 'custom'" class="row q-col-gutter-sm">
          <div class="col-6">
            <q-input
              v-model="customStart"
              outlined
              dense
              label="Start"
              type="date"
              data-testid="tt-stats-custom-start"
            />
          </div>
          <div class="col-6">
            <q-input
              v-model="customEnd"
              outlined
              dense
              label="End"
              type="date"
              data-testid="tt-stats-custom-end"
            />
          </div>
        </div>

        <div v-if="periodCaption" class="text-caption text-grey-6">{{ periodCaption }}</div>

        <div class="tt-stats-kpis">
          <div class="tt-stats-kpi">
            <div class="tt-stats-kpi__label">Earned</div>
            <div class="tt-stats-kpi__value" data-testid="tt-stats-total-income">
              {{ formatUsdFromCents(report.totalIncomeCents) }}
            </div>
          </div>
          <div class="tt-stats-kpi">
            <div class="tt-stats-kpi__label">Hours</div>
            <div class="tt-stats-kpi__value" data-testid="tt-stats-total-hours">
              {{ formatDurationMs(report.totalHoursMs) }}
            </div>
          </div>
          <div class="tt-stats-kpi">
            <div class="tt-stats-kpi__label">$/hr</div>
            <div class="tt-stats-kpi__value" data-testid="tt-stats-dollars-per-hour">
              {{ formatHeadlineRate(report.dollarsPerHour) }}
            </div>
          </div>
        </div>

        <section v-if="report.showClientBreakdown" class="tt-stats-section">
          <div class="text-subtitle2">By client</div>
          <div class="tt-stats-pies">
            <div class="tt-stats-pie-block">
              <div class="text-caption text-grey-6 text-center">Hours</div>
              <TimeTrackerStatsPie
                :labels="clientHourLabels"
                :values="clientHourValues"
                test-id="tt-stats-client-hours-pie"
              />
            </div>
            <div class="tt-stats-pie-block">
              <div class="text-caption text-grey-6 text-center">Income</div>
              <TimeTrackerStatsPie
                :labels="clientIncomeLabels"
                :values="clientIncomeValues"
                test-id="tt-stats-client-income-pie"
              />
            </div>
          </div>
          <TimeTrackerStatsBreakdownTable :rows="clientTableRows" test-id="tt-stats-client-table" />
        </section>

        <section class="tt-stats-section">
          <div class="text-subtitle2">By project</div>
          <div class="tt-stats-pies">
            <div class="tt-stats-pie-block">
              <div class="text-caption text-grey-6 text-center">Hours</div>
              <TimeTrackerStatsPie
                :labels="projectHourLabels"
                :values="projectHourValues"
                test-id="tt-stats-project-hours-pie"
              />
            </div>
            <div class="tt-stats-pie-block">
              <div class="text-caption text-grey-6 text-center">Income</div>
              <TimeTrackerStatsPie
                :labels="projectIncomeLabels"
                :values="projectIncomeValues"
                test-id="tt-stats-project-income-pie"
              />
            </div>
          </div>
          <TimeTrackerStatsBreakdownTable :rows="projectTableRows" test-id="tt-stats-project-table" />
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { useTimeTrackerSettingsStore } from '../../../stores/timeTrackerSettings.js'
import { TIME_TRACKER_WORKSPACE_KEY } from '../composables/trackerSurfaces.js'
import { formatDurationMs, formatUsd, formatUsdFromCents } from '../formatDisplay.js'
import { defaultOwnerPrefs } from '../sessionPrefs.js'
import { buildStatisticsReport } from '../statistics/buildStatisticsReport.js'
import { resolveStatisticsPeriod } from '../statistics/resolveStatisticsPeriod.js'
import { STATS_PIE_COLORS } from '../statistics/statsPieColors.js'
import TimeTrackerStatsBreakdownTable from './TimeTrackerStatsBreakdownTable.vue'
import TimeTrackerStatsPie from './TimeTrackerStatsPie.vue'

const workspace = inject(TIME_TRACKER_WORKSPACE_KEY)
const state = workspace.state
const settingsStore = useTimeTrackerSettingsStore()

const preset = ref('month')
const customStart = ref('')
const customEnd = ref('')

const periodOptions = [
  { label: 'Weekly', value: 'week' },
  { label: 'Monthly', value: 'month' },
  { label: 'Yearly', value: 'year' },
  { label: 'Custom range', value: 'custom' },
  { label: 'All time', value: 'all' },
]

const ownerPrefs = computed(() => {
  const uid = state.uid
  if (!uid) return defaultOwnerPrefs()
  return settingsStore.prefsFor(uid) ?? defaultOwnerPrefs()
})

const resolvedPeriod = computed(() => {
  const customStartMs = customStart.value ? Date.parse(`${customStart.value}T00:00:00`) : null
  const customEndMs = customEnd.value ? Date.parse(`${customEnd.value}T00:00:00`) : null
  return resolveStatisticsPeriod({
    preset: preset.value,
    now: Date.now(),
    customStartMs,
    customEndMs,
  })
})

const emptyReport = {
  totalHoursMs: 0,
  totalIncomeCents: 0,
  dollarsPerHour: null,
  showClientBreakdown: false,
  clientRows: [],
  projectRows: [],
}

const report = computed(() => {
  if (!resolvedPeriod.value.ok) return emptyReport
  return buildStatisticsReport({
    timeEntries: state.timeEntries,
    projects: state.projects,
    clients: state.clients,
    invoices: state.invoices,
    range: resolvedPeriod.value,
    includeUnpaidInvoices: ownerPrefs.value.showUnpaidInvoicesInStatistics,
    includeUninvoiced: ownerPrefs.value.includeUninvoicedInStatistics,
  })
})

const periodCaption = computed(() => {
  const period = resolvedPeriod.value
  if (!period.ok) return 'Choose a valid start and end date.'
  if (!Number.isFinite(period.startMs) || !Number.isFinite(period.endMs)) return 'All recorded time'
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${formatter.format(period.startMs)} – ${formatter.format(period.endMs)}`
})

function clientName(clientId) {
  if (!clientId) return 'No client'
  return state.clients.find((client) => client.id === clientId)?.name || clientId
}

function projectName(projectId) {
  return state.projects.find((project) => project.id === projectId)?.name || projectId
}

function mapRows(rows, nameForId) {
  return rows.map((row, index) => ({
    key: row.id ?? 'none',
    name: nameForId(row.id),
    hoursMs: row.hoursMs,
    incomeCents: row.incomeCents,
    dollarsPerHour: row.dollarsPerHour,
    color: STATS_PIE_COLORS[index % STATS_PIE_COLORS.length],
  }))
}

const clientTableRows = computed(() => mapRows(report.value.clientRows, clientName))
const projectTableRows = computed(() => mapRows(report.value.projectRows, projectName))

const clientHourLabels = computed(() => clientTableRows.value.map((row) => row.name))
const clientHourValues = computed(() => clientTableRows.value.map((row) => row.hoursMs / 3_600_000))
const clientIncomeLabels = computed(() => clientTableRows.value.map((row) => row.name))
const clientIncomeValues = computed(() =>
  clientTableRows.value.map((row) => row.incomeCents / 100),
)

const projectHourLabels = computed(() => projectTableRows.value.map((row) => row.name))
const projectHourValues = computed(() => projectTableRows.value.map((row) => row.hoursMs / 3_600_000))
const projectIncomeLabels = computed(() => projectTableRows.value.map((row) => row.name))
const projectIncomeValues = computed(() =>
  projectTableRows.value.map((row) => row.incomeCents / 100),
)

function formatHeadlineRate(value) {
  if (value == null) return '—'
  return formatUsd(value)
}
</script>

<style scoped>
.tt-stats {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  min-width: 0;
}

.tt-stats-kpis {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.tt-stats-kpi {
  min-width: 0;
  padding: 10px 8px;
  border-radius: 10px;
  text-align: center;
  background: rgba(255, 255, 255, 0.05);
}

.body--light .tt-stats-kpi {
  background: rgba(0, 0, 0, 0.04);
}

.tt-stats-kpi__label {
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
}

.body--light .tt-stats-kpi__label {
  color: rgba(0, 0, 0, 0.54);
}

.tt-stats-kpi__value {
  margin-top: 4px;
  font-size: 0.98rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tt-stats-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.tt-stats-pies {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
  align-items: start;
}

.tt-stats-pie-block {
  min-width: 0;
}
</style>
