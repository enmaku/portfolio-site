import { paymentStatus } from '../domain/invoices.js'

/**
 * @param {{
 *   invoice: {
 *     id: string,
 *     invoiceNumber: number,
 *     issuedAt: number,
 *     invoiceTotalCents: number,
 *     totalDurationMs: number,
 *     amountPaidCents: number,
 *     lines: Array<{
 *       timeEntryId: string,
 *       projectId: string,
 *       projectName?: string,
 *       durationMs: number,
 *       amountCents: number,
 *       description?: string,
 *     }>,
 *   },
 *   projects: Array<{ id: string, name: string }>,
 *   timeEntries: Array<{ id: string, startedAt: number, description?: string }>,
 * }} input
 */
export function invoiceExpansionViewModel(input) {
  const projectById = new Map((input.projects ?? []).map((project) => [project.id, project]))
  const entryById = new Map((input.timeEntries ?? []).map((entry) => [entry.id, entry]))
  /** @type {Map<string, { id: string, name: string, durationMs: number, amountCents: number, timeEntries: object[] }>} */
  const groups = new Map()

  for (const line of input.invoice.lines ?? []) {
    let group = groups.get(line.projectId)
    if (!group) {
      const project = projectById.get(line.projectId)
      group = {
        id: line.projectId,
        name: project?.name || line.projectName || line.projectId,
        durationMs: 0,
        amountCents: 0,
        timeEntries: [],
      }
      groups.set(line.projectId, group)
    }
    const entry = entryById.get(line.timeEntryId)
    group.durationMs += line.durationMs
    group.amountCents += line.amountCents
    group.timeEntries.push({
      id: line.timeEntryId,
      startedAt: entry?.startedAt ?? null,
      durationMs: line.durationMs,
      amountCents: line.amountCents,
      description: line.description || entry?.description || '',
    })
  }

  return {
    invoiceId: input.invoice.id,
    invoiceNumber: input.invoice.invoiceNumber,
    issuedAt: input.invoice.issuedAt,
    totalDurationMs: input.invoice.totalDurationMs,
    invoiceTotalCents: input.invoice.invoiceTotalCents,
    amountPaidCents: input.invoice.amountPaidCents,
    paymentStatus: paymentStatus(input.invoice),
    projects: [...groups.values()],
  }
}
