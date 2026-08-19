<template>
  <q-page class="tt-invoice-page column fit no-wrap" data-testid="tt-client-invoice-page">
    <div v-if="loading" class="col flex flex-center">
      <q-circular-progress indeterminate size="32px" color="primary" />
    </div>
    <div v-else-if="!payload" class="col flex flex-center q-pa-md text-body2 text-grey-5">
      This invoice link is not valid.
    </div>
    <div v-else class="col tt-surface__scroll q-pa-md">
      <div class="text-h6 q-mb-xs">{{ payload.lookup.clientName || payload.lookup.clientId }}</div>
      <div class="text-caption text-grey-5 q-mb-md">
        {{ payload.invoices[0]?.issuerName || '' }}
      </div>
      <div class="text-subtitle1 q-mb-md" data-testid="tt-client-unpaid-balance">
        {{ formatUsdFromCents(unpaidBalanceCents(payload.invoices)) }}
      </div>
      <q-btn
        class="q-mb-md"
        unelevated
        color="primary"
        data-testid="tt-client-page-pay-all"
        @click="onPayAll"
      />
      <q-expansion-item
        v-for="invoice in payload.invoices"
        :key="invoice.id"
        :data-testid="`tt-client-invoice-${invoice.id}`"
      >
        <template #header>
          <q-item-section>
            <q-item-label>#{{ invoice.invoiceNumber }}</q-item-label>
            <q-item-label caption>
              {{ formatUsdFromCents(invoice.invoiceTotalCents) }} · {{ paymentStatus(invoice) }}
            </q-item-label>
          </q-item-section>
        </template>
        <div class="q-px-md q-pb-md">
          <div v-for="group in expansionFor(invoice).projects" :key="group.id" class="q-mb-sm">
            <div class="text-subtitle2">{{ group.name }}</div>
            <div v-for="entry in group.timeEntries" :key="entry.id" class="text-caption text-grey-5">
              {{ formatDurationMs(entry.durationMs) }} · {{ formatUsdFromCents(entry.amountCents) }}
              <span v-if="entry.description"> · {{ entry.description }}</span>
            </div>
          </div>
          <div class="row q-gutter-sm">
            <q-btn dense outline @click="onPaid(invoice.id, invoice.invoiceTotalCents)" />
            <q-btn dense outline @click="onPaid(invoice.id, 0)" />
          </div>
        </div>
      </q-expansion-item>
    </div>
  </q-page>
</template>

<script setup>
import { onMounted, ref } from 'vue'
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
const loading = ref(true)
const payload = ref(null)

async function reload() {
  const secret = String(route.params.secret || '')
  const lookup = await getInvoiceLink(secret)
  if (!lookup?.ownerUid) {
    payload.value = null
    return
  }
  const invoices = await listInvoicesForLinkSecret(lookup.ownerUid, secret)
  payload.value = { lookup, invoices, secret }
}

onMounted(async () => {
  try {
    await reload()
  } finally {
    loading.value = false
  }
})

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
