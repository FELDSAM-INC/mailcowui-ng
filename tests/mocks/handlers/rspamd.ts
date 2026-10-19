// Rspamd handlers (UI 011 T014, T117): the statistics, and the scan history with its documented
// search (senders, recipients, subject, client address, user, message ID), filters (action, time
// range, score range), sort (time, score, size, scan time; ties by time) and paging.
import type { RspamdHistoryEntry } from '@/api'

import { http } from './context'
import { operationGate } from './operations-context'

const SORT_KEYS: Record<string, (entry: RspamdHistoryEntry) => number> = {
  time: (entry) => Date.parse(entry.time),
  score: (entry) => entry.score,
  size: (entry) => entry.sizeBytes,
  scanTime: (entry) => entry.scanTimeRealSeconds,
}

function searchable(entry: RspamdHistoryEntry): string {
  return [
    entry.envelopeSender,
    entry.headerSender,
    ...entry.envelopeRecipients,
    ...entry.headerRecipients,
    entry.subject,
    entry.clientAddress,
    entry.user,
    entry.messageId,
  ]
    .filter((value): value is string => typeof value === 'string')
    .join('\n')
    .toLowerCase()
}

export const rspamdHandlers = [
  http.get('/rspamd/statistics', async ({ response }) => {
    const gate = await operationGate('getRspamdStatistics')
    if (gate.stop) return response.untyped(gate.stop)
    const statistics = gate.state.operations.rspamd.statistics
    if (!statistics) throw new Error('Rspamd statistics missing from the scenario')
    return gate.finish(response(200).json({ data: statistics }))
  }),
  http.get('/rspamd/history', async ({ query, response }) => {
    const gate = await operationGate('listRspamdHistory')
    if (gate.stop) return response.untyped(gate.stop)
    const q = query.get('q')?.trim().toLowerCase()
    const actions = query.getAll('action')
    const from = query.get('from')
    const to = query.get('to')
    const minScore = query.get('minScore')
    const maxScore = query.get('maxScore')
    const sortKey = SORT_KEYS[query.get('sort') ?? 'time'] ?? SORT_KEYS.time!
    const direction = query.get('order') === 'asc' ? 1 : -1
    const matching = gate.state.operations.rspamd.history
      .filter((entry) => {
        if (q && !searchable(entry).includes(q)) return false
        if (actions.length > 0 && !actions.includes(entry.action)) return false
        if (from && Date.parse(entry.time) < Date.parse(from)) return false
        if (to && Date.parse(entry.time) > Date.parse(to)) return false
        if (minScore !== null && entry.score < Number(minScore)) return false
        if (maxScore !== null && entry.score > Number(maxScore)) return false
        return true
      })
      .sort(
        (a, b) => direction * (sortKey(a) - sortKey(b)) || Date.parse(b.time) - Date.parse(a.time),
      )
    const limit = Number(query.get('limit') ?? 25)
    const offset = Number(query.get('offset') ?? 0)
    return gate.finish(
      response(200).json({
        data: matching.slice(offset, offset + limit),
        meta: { total: matching.length, limit, offset },
      }),
    )
  }),
]
