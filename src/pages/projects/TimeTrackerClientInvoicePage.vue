<template>
  <q-page class="tt-invoice-page column fit no-wrap" data-testid="tt-client-invoice-page">
    <div v-if="loading" class="col flex flex-center">
      <q-circular-progress indeterminate size="32px" color="primary" />
    </div>
    <div v-else-if="!payload" class="col flex flex-center q-pa-md text-body2 text-grey-5">
      This invoice link is not valid.
    </div>
    <div v-else class="col column no-wrap tt-surface">
      <q-toolbar class="col-auto">
        <q-toolbar-title>
          {{ payload.lookup.clientName || payload.lookup.clientId }}
        </q-toolbar-title>
      </q-toolbar>
      <div class="col tt-surface__scroll q-pa-md">
        <div class="text-caption text-grey-5 q-mb-md">
          {{ payload.invoices[0]?.issuerName || '' }}
        </div>
        <div class="text-subtitle1 q-mb-md" data-testid="tt-client-unpaid-balance">
          {{ formatUsdFromCents(unpaidBalanceCents(payload.invoices)) }}
        </div>
        <q-btn
          class="q-mb-md"
          unelevated
          no-caps
          color="primary"
          label="Mark all as paid"
          data-testid="tt-client-page-pay-all"
          @click="onPayAll"
        />
        <q-list>
                  <q-expansion-item
                    v-for="invoice in payload.invoices"
                    :key="invoice.id"
                    :data-testid="`tt-client-invoice-${invoice.id}`"
                  >
                    <template #header>
                      <q-item-section>
                        <q-item-label>#{{ invoice.invoiceNumber }}</q-item-label>
                        <q-item-label caption>
                          {{ formatUsdFromCents(invoice.invoiceTotalCents) }} ·
                          {{ paymentStatus(invoice) }}
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
                            {{ formatDurationMs(entry.durationMs) }} ·
                            {{ formatUsdFromCents(entry.amountCents) }}
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
                        @click="onPaid(invoice.id, invoice.invoiceTotalCents)"
                      />
                      <q-btn
                        dense
                        outline
                        no-caps
                        label="Mark unpaid"
                        @click="onPaid(invoice.id, 0)"
                      />
                    </q-card-actions>
                  </q-expansion-item>
                </q-list>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useRoute } from 'vue-router'
import { paymentStatus, payAllInvoices, setAmountPaid, unpaidBalanceCents } from '../../features/time-tracker/domain/invoices.js'
import { formatDurationMs, formatUsdFromCents } from '../../features/time-tracker/formatDisplay.js'
import {
  getInvoiceLink,
  listInvoicesForLinkSecret,
  updateInvoiceAmountPaid,
} from '../../features/time-tracker/firebase/trackerStore.js'
import { invoiceExpansionViewModel } from '../../features/time-tracker/invoices/invoiceExpansionViewModel.js'

const route = useRoute()
const $q = useQuasar()
const loading = ref(true)
const payload = ref(null)

async function reload() {
  const secret = String(route.params.secret || '')
  const lookup = await getInvoiceLink(secret)
  if (!lookup?.ownerUid || !lookup.clientId) {
    payload.value = null
    return
  }
  const invoices = await listInvoicesForLinkSecret(lookup.ownerUid, secret, lookup.clientId)
  payload.value = { lookup, invoices, secret }
}

async function loadPage() {
  loading.value = true
  try {
    await reload()
  } catch (err) {
    payload.value = null
    $q.notify({
      type: 'negative',
      message: err instanceof Error ? err.message : 'Could not load invoices',
    })
  } finally {
    loading.value = false
  }
}

watch(
  () => route.params.secret,
  () => {
    void loadPage()
  },
  { immediate: true },
)

function expansionFor(invoice) {
  return invoiceExpansionViewModel({
    invoice,
    projects: [],
    timeEntries: [],
  })
}

async function persistPaid(invoices) {
  const ownerUid = payload.value.lookup.ownerUid
  await Promise.all(
    invoices.map((invoice) => updateInvoiceAmountPaid(ownerUid, invoice.id, invoice.amountPaidCents)),
  )
  payload.value = { ...payload.value, invoices }
}

async function onPayAll() {
  await persistPaid(payAllInvoices(payload.value.invoices))
}

async function onPaid(invoiceId, amountPaidCents) {
  const invoices = payload.value.invoices.map((invoice) =>
    invoice.id === invoiceId ? setAmountPaid(invoice, amountPaidCents) : invoice,
  )
  await persistPaid(invoices)
}
</script>

<style scoped lang="scss">
.tt-invoice-page {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}
</style>
