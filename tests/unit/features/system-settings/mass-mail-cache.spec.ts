import { useQuery } from '@tanstack/vue-query'
import { effectScope } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createQueryClient, queryKeys } from '@/api'
import {
  cancelJob,
  createJob,
  jobListOptions,
  jobOptions,
} from '@/features/system-settings/api/mass-mail'
import { mockState, useScenario } from '../../../mocks/node'

describe('Mass mail content lifetime (FR108)', () => {
  it('removes bodies and selection after the final job view leaves, preserving summaries', async () => {
    useScenario('mass-mail-running')
    const client = createQueryClient(),
      id = mockState().massMail.jobs[0]!.id
    const list = await client.fetchQuery(jobListOptions({}))
    const scope = effectScope()
    const detail = scope.run(() => useQuery(jobOptions(id), client))!
    const stop = () => scope.stop()
    await detail.refetch()
    const second = effectScope()
    second.run(() => useQuery(jobOptions(id), client))
    const stopSecond = () => second.stop()
    try {
      expect(client.getQueryData(queryKeys.massMailJobs.detail(id))).toHaveProperty('textBody')
      const cancelled = await cancelJob(id, client)
      expect(detail.data.value?.status).toBe('cancelled')
      expect(cancelled.counts.pending).toBe(0)
      stop()
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(client.getQueryData(queryKeys.massMailJobs.detail(id))).toHaveProperty('selection')
      stopSecond()
      await vi.waitFor(
        () => expect(client.getQueryData(queryKeys.massMailJobs.detail(id))).toBeUndefined(),
        { timeout: 200, interval: 10 },
      )
      const summary = client.getQueryData<typeof list>(queryKeys.massMailJobs.list({}))
      expect(summary).toBeDefined()
      expect(summary?.data[0]).not.toHaveProperty('textBody')
      expect(summary?.data[0]).not.toHaveProperty('htmlBody')
      expect(summary?.data[0]?.selection).toEqual(list.data[0]?.selection)
    } finally {
      stop()
      stopSecond()
      client.clear()
    }
  })
  it('does not retain an unobserved response primed by creation or cancellation', async () => {
    useScenario('mass-mail-120')
    const client = createQueryClient()
    try {
      const job = await createJob(
        {
          sender: 'noreply@mail.example.org',
          subject: 'Private notice',
          textBody: 'Private body',
          htmlBody: null,
          selection: {},
          expectedRecipients: 120,
        },
        client,
      )
      await vi.waitFor(
        () => expect(client.getQueryData(queryKeys.massMailJobs.detail(job.id))).toBeUndefined(),
        { timeout: 200, interval: 10 },
      )
      const cancelled = await cancelJob(job.id, client)
      expect(cancelled.status).toBe('cancelled')
      await vi.waitFor(
        () => expect(client.getQueryData(queryKeys.massMailJobs.detail(job.id))).toBeUndefined(),
        { timeout: 200, interval: 10 },
      )
    } finally {
      client.clear()
    }
  })
})
