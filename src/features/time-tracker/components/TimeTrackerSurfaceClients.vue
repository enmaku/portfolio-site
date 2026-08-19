<template>
  <div class="tt-surface" data-testid="tt-surface-clients">
    <div class="tt-surface__scroll q-pa-md">
      <div v-for="client in state.clients" :key="client.id" class="q-mb-md">
        <q-item clickable :data-testid="`tt-client-${client.id}`" @click="openEdit(client)">
          <q-item-section>
            <q-item-label>{{ client.name }}</q-item-label>
            <q-item-label caption>{{ formatUsdFromCents(balanceFor(client.id)) }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-expansion-item
          v-for="invoice in invoicesFor(client.id)"
          :key="invoice.id"
          :data-testid="`tt-invoice-${invoice.id}`"
        >
          <template #header>
            <q-item-section>
              <q-item-label>#{{ invoice.invoiceNumber }}</q-item-label>
              <q-item-label caption>
                {{ formatUsdFromCents(invoice.invoiceTotalCents) }} · {{ paymentStatus(invoice) }}
              </q-item-label>
            </q-item-section>
          </template>
          <div
            v-for="group in expansionFor(invoice).projects"
            :key="group.id"
            class="q-px-md q-pb-sm"
          >
            <div class="text-subtitle2">{{ group.name }}</div>
            <div
              v-for="entry in group.timeEntries"
              :key="entry.id"
              class="text-caption text-grey-5"
            >
              {{ formatDurationMs(entry.durationMs) }} · {{ formatUsdFromCents(entry.amountCents) }}
              <span v-if="entry.description"> · {{ entry.description }}</span>
            </div>
          </div>
          <div class="row q-gutter-sm q-px-md q-pb-md">
            <q-btn
              dense
              outline
              data-testid="tt-invoice-pay"
              @click="workspace.updateInvoicePaid(invoice.id, invoice.invoiceTotalCents)"
            />
            <q-btn
              dense
              outline
              data-testid="tt-invoice-unpay"
              @click="workspace.updateInvoicePaid(invoice.id, 0)"
            />
            <q-btn dense outline data-testid="tt-invoice-delete" @click="workspace.removeInvoice(invoice.id)" />
          </div>
        </q-expansion-item>
        <div class="row q-gutter-sm q-px-md q-pb-sm">
          <q-btn dense unelevated color="primary" data-testid="tt-invoice-generate" @click="onGenerate(client.id)" />
          <q-btn dense outline data-testid="tt-client-pay-all" @click="workspace.payAllForClient(client.id)" />
          <q-btn dense outline data-testid="tt-client-copy-link" @click="copyLink(client)" />
          <q-btn dense outline data-testid="tt-client-regen-link" @click="workspace.regenerateClientLink(client.id)" />
        </div>
      </div>
    </div>
    <div class="row justify-end q-pa-md">
      <q-btn fab color="primary" icon="add" data-testid="tt-client-add" @click="openAdd" />
    </div>

    <q-dialog v-model="editorOpen">
      <q-card class="tt-dialog-card">
        <q-card-section>
          <q-input v-model="draftName" outlined dense data-testid="tt-client-name" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn v-if="editingId" flat color="negative" data-testid="tt-client-delete" @click="onDelete" />
          <q-btn flat v-close-popup />
          <q-btn unelevated color="primary" data-testid="tt-client-save" @click="onSave" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { inject, ref } from 'vue'
import { useRouter } from 'vue-router'
import { TIME_TRACKER_WORKSPACE_KEY } from '../composables/trackerSurfaces.js'
import { paymentStatus, unpaidBalanceCents } from '../domain/invoices.js'
import { formatDurationMs, formatUsdFromCents } from '../formatDisplay.js'
import { invoiceExpansionViewModel } from '../invoices/invoiceExpansionViewModel.js'

const workspace = inject(TIME_TRACKER_WORKSPACE_KEY)
const state = workspace.state
const router = useRouter()
const editorOpen = ref(false)
const editingId = ref(null)
const draftName = ref('')

function invoicesFor(clientId) {
  return state.invoices.filter((invoice) => invoice.clientId === clientId)
}

function balanceFor(clientId) {
  return unpaidBalanceCents(invoicesFor(clientId))
}

function expansionFor(invoice) {
  return invoiceExpansionViewModel({
    invoice,
    projects: state.projects,
    timeEntries: state.timeEntries,
  })
}

function openAdd() {
  editingId.value = null
  draftName.value = ''
  editorOpen.value = true
}

function openEdit(client) {
  editingId.value = client.id
  draftName.value = client.name
  editorOpen.value = true
}

async function onSave() {
  if (editingId.value) await workspace.renameClient(editingId.value, draftName.value)
  else await workspace.createClient({ name: draftName.value })
  editorOpen.value = false
}

async function onDelete() {
  if (!editingId.value) return
  await workspace.removeClient(editingId.value)
  editorOpen.value = false
}

async function onGenerate(clientId) {
  await workspace.generateInvoice({ clientId })
}

function copyLink(client) {
  const href = router.resolve({
    path: `/projects/time-tracker/c/${client.invoiceLinkSecret}`,
  }).href
  const absolute = new URL(href, window.location.origin).toString()
  void navigator.clipboard.writeText(absolute)
}
</script>
