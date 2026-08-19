<template>
  <div class="tt-surface" data-testid="tt-surface-clients">
    <div class="tt-surface__scroll q-pa-md">
      <q-card
            v-for="client in state.clients"
            :key="client.id"
            flat
            bordered
            class="q-mb-md"
          >
            <q-item clickable v-ripple :data-testid="`tt-client-${client.id}`" @click="openEdit(client)">
              <q-item-section>
                <q-item-label>{{ client.name }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-markup-table flat dense separator="none">
              <thead>
                <tr>
                  <th
                    v-for="row in moneyRows(client.id)"
                    :key="`${client.id}-${row.key}-h`"
                    class="text-left text-caption text-grey-5 text-weight-regular"
                  >
                    {{ row.label }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr :data-testid="`tt-client-money-${client.id}`">
                  <td
                    v-for="row in moneyRows(client.id)"
                    :key="row.key"
                    :data-testid="`tt-client-money-${client.id}-${row.key}`"
                  >
                    {{ formatUsdFromCents(row.cents) }}
                  </td>
                </tr>
              </tbody>
            </q-markup-table>
            <q-list>
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
                <q-list dense>
                  <q-item v-for="group in expansionFor(invoice).projects" :key="group.id">
                    <q-item-section>
                      <q-item-label>{{ group.name }}</q-item-label>
                      <q-item-label
                        v-for="entry in group.timeEntries"
                        :key="entry.id"
                        caption
                      >
                        {{ formatDurationMs(entry.durationMs) }} · {{ formatUsdFromCents(entry.amountCents) }}
                        <span v-if="entry.description"> · {{ entry.description }}</span>
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
                <q-card-actions>
                  <q-btn
                    dense
                    outline
                    no-caps
                    label="Mark paid"
                    data-testid="tt-invoice-pay"
                    @click="workspace.updateInvoicePaid(invoice.id, invoice.invoiceTotalCents)"
                  />
                  <q-btn
                    dense
                    outline
                    no-caps
                    label="Mark unpaid"
                    data-testid="tt-invoice-unpay"
                    @click="workspace.updateInvoicePaid(invoice.id, 0)"
                  />
                  <q-btn
                    dense
                    outline
                    no-caps
                    label="Delete invoice"
                    data-testid="tt-invoice-delete"
                    @click="workspace.removeInvoice(invoice.id)"
                  />
                </q-card-actions>
              </q-expansion-item>
            </q-list>
            <q-card-actions>
              <q-btn
                dense
                unelevated
                no-caps
                color="primary"
                label="Generate invoice"
                data-testid="tt-invoice-generate"
                @click="onGenerate(client.id)"
              />
              <q-btn
                dense
                outline
                no-caps
                label="Mark all as paid"
                data-testid="tt-client-pay-all"
                @click="workspace.payAllForClient(client.id)"
              />
              <q-space />
              <q-btn
                dense
                round
                outline
                icon="link"
                aria-label="Copy link"
                data-testid="tt-client-copy-link"
                @click="copyLink(client)"
              />
              <q-btn
                dense
                round
                flat
                size="sm"
                icon="refresh"
                aria-label="New link"
                data-testid="tt-client-regen-link"
                @click="onRegenLink(client)"
              />
            </q-card-actions>
          </q-card>
    </div>
    <div class="tt-actions-bar row items-center justify-end q-px-md q-pt-sm">
      <q-btn fab color="primary" icon="add" data-testid="tt-client-add" @click="openAdd" />
    </div>

    <q-dialog v-model="editorOpen" persistent>
      <q-card class="tt-dialog-card">
        <q-card-section>
          <q-input v-model="draftName" outlined dense label="Name" data-testid="tt-client-name" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn
            v-if="editingId"
            flat
            no-caps
            color="negative"
            label="Delete"
            data-testid="tt-client-delete"
            @click="onDelete"
          />
          <q-btn flat no-caps color="grey" label="Cancel" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Save"
            data-testid="tt-client-save"
            :disable="!draftName.trim()"
            :loading="saving"
            @click="onSave"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { inject, ref } from 'vue'
import { copyToClipboard, useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { TIME_TRACKER_WORKSPACE_KEY } from '../composables/trackerSurfaces.js'
import { clientMoneySummary, paymentStatus } from '../domain/invoices.js'
import { formatDurationMs, formatUsdFromCents } from '../formatDisplay.js'
import { invoiceExpansionViewModel } from '../invoices/invoiceExpansionViewModel.js'

const $q = useQuasar()
const workspace = inject(TIME_TRACKER_WORKSPACE_KEY)
const state = workspace.state
const router = useRouter()
const editorOpen = ref(false)
const editingId = ref(null)
const draftName = ref('')
const saving = ref(false)

function invoicesFor(clientId) {
  return state.invoices.filter((invoice) => invoice.clientId === clientId)
}

function moneyRows(clientId) {
  const summary = clientMoneySummary({
    clientId,
    invoices: state.invoices,
    timeEntries: state.timeEntries,
    projects: state.projects,
  })
  return [
    { key: 'total', label: 'Total', cents: summary.totalCents },
    { key: 'paid', label: 'Paid', cents: summary.paidCents },
    { key: 'unpaid', label: 'Unpaid', cents: summary.unpaidCents },
    { key: 'uninvoiced', label: 'Uninvoiced', cents: summary.uninvoicedCents },
  ]
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

async function runEditorAction(action) {
  saving.value = true
  try {
    await action()
    editorOpen.value = false
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err instanceof Error ? err.message : 'Could not save client',
    })
  } finally {
    saving.value = false
  }
}

function onSave() {
  if (!draftName.value.trim()) return
  return runEditorAction(() =>
    editingId.value
      ? workspace.renameClient(editingId.value, draftName.value)
      : workspace.createClient({ name: draftName.value }),
  )
}

function onDelete() {
  if (!editingId.value) return
  return runEditorAction(() => workspace.removeClient(editingId.value))
}

async function onGenerate(clientId) {
  try {
    await workspace.generateInvoice({ clientId })
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err instanceof Error ? err.message : 'Could not generate invoice',
    })
  }
}

function invoiceLinkHref(secret) {
  const href = router.resolve({
    path: `/projects/time-tracker/c/${secret}`,
  }).href
  return new URL(href, window.location.origin).toString()
}

async function copyInvoiceLink(secret) {
  await copyToClipboard(invoiceLinkHref(secret))
}

async function copyLink(client) {
  try {
    await copyInvoiceLink(client.invoiceLinkSecret)
    $q.notify({ type: 'positive', message: 'Invoice link copied' })
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err instanceof Error ? err.message : 'Could not copy invoice link',
    })
  }
}

async function onRegenLink(client) {
  try {
    const secret = await workspace.regenerateClientLink(client.id)
    try {
      await copyInvoiceLink(secret)
      $q.notify({ type: 'positive', message: 'New invoice link created and copied' })
    } catch {
      $q.notify({
        type: 'negative',
        message: 'New invoice link created, but it could not be copied',
      })
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err instanceof Error ? err.message : 'Could not create a new invoice link',
    })
  }
}
</script>
