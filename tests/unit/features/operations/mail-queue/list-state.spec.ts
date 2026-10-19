// UI 011 (FR-050, data-model §5, T090): the queue's address holds the search, the sort, the page
// and the page size; legacy's search is the only filter (decision 18), oldest first by default.
import { describe, expect, it } from 'vitest'

import {
  MAIL_QUEUE_SORTS,
  mailQueueListSchema,
  queueParams,
} from '@/features/operations/mail-queue/list-state'

describe('mail queue list state', () => {
  it('sorts by the legacy columns, arrival time ascending by default', () => {
    expect(MAIL_QUEUE_SORTS).toEqual(['arrivalTime', 'size', 'sender', 'queue', 'id'])
    expect(mailQueueListSchema.sort?.default).toBe('arrivalTime')
    expect(mailQueueListSchema.sort?.defaultOrder('arrivalTime')).toBe('asc')
    expect(Object.keys(mailQueueListSchema.filters)).toEqual(['q'])
  })

  it('maps the state to the request parameters', () => {
    expect(
      queueParams({
        filters: { q: 'partner.example' },
        sort: 'size',
        order: 'desc',
        page: 3,
        size: 50,
      }),
    ).toEqual({ q: 'partner.example', sort: 'size', order: 'desc', limit: 50, offset: 100 })
    expect(
      queueParams({
        filters: { q: undefined },
        sort: 'arrivalTime',
        order: 'asc',
        page: 1,
        size: 25,
      }),
    ).toEqual({ sort: 'arrivalTime', order: 'asc', limit: 25, offset: 0 })
  })
})
