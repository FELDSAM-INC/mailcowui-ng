import { describe, expect, it } from 'vitest'
import { createQueryClient, queryKeys } from '@/api'
import {
  previewRecipients,
  createJob,
  jobOptions,
  jobListOptions,
  recipientOptions,
  cancelJob,
} from '@/features/system-settings/api/mass-mail'
import { mockState, useScenario } from '../../../mocks/node'

const message = {
  sender: 'noreply@mail.example.org',
  subject: 'Maintenance',
  textBody: 'Service notice',
  htmlBody: null,
  selection: {},
  expectedRecipients: 120,
}
describe('mass mail contract round trips', () => {
  it('previews only receiving mailboxes, pages and searches without changing the confirmed count', async () => {
    useScenario('mass-mail-120')
    const first = await previewRecipients({}, { limit: 25, offset: 0 })
    expect(first.data).toHaveLength(25)
    expect(first.meta).toMatchObject({ recipientCount: 120, total: 120 })
    const search = await previewRecipients({}, { q: 'user001@', limit: 25, offset: 0 })
    expect(search.meta).toMatchObject({ recipientCount: 120, total: 1 })
    const included = await previewRecipients({ include: ['user001@example.org'] }, {})
    expect(included.meta.recipientCount).toBe(1)
    await expect(previewRecipients({ exclude: ['missing@example.org'] }, {})).rejects.toMatchObject(
      { status: 422 },
    )
    await expect(
      previewRecipients({ include: ['inactive@example.org'] }, {}),
    ).rejects.toMatchObject({ status: 422 })
  })
  it('refuses changed counts and simultaneous jobs, omits bodies from lists, cancels pending recipients', async () => {
    useScenario('mass-mail-120')
    const client = createQueryClient()
    await expect(createJob({ ...message, expectedRecipients: 119 }, client)).rejects.toMatchObject({
      status: 409,
      extensions: { actualRecipients: 120 },
    })
    expect(mockState().massMail.jobs).toHaveLength(0)
    const job = await createJob(message, client)
    expect(client.getQueryData(queryKeys.massMailJobs.detail(job.id))).toEqual(job)
    await expect(createJob(message, client)).rejects.toMatchObject({
      status: 409,
      extensions: { runningJobId: job.id },
    })
    const list = await client.fetchQuery(jobListOptions({}))
    expect(list.data[0]).not.toHaveProperty('textBody')
    expect(list.data[0]).not.toHaveProperty('htmlBody')
    const cancelled = await cancelJob(job.id, client)
    expect(cancelled).toMatchObject({ status: 'cancelled', counts: { pending: 0, skipped: 120 } })
    const recipients = await client.fetchQuery(recipientOptions(job.id, { outcome: 'skipped' }))
    expect(recipients.meta.total).toBe(120)
    expect(await cancelJob(job.id, client)).toEqual(cancelled)
    client.clear()
  })
  it('reports stable failure codes and refuses cancellation of completed jobs', async () => {
    useScenario('mass-mail-completed')
    const client = createQueryClient(),
      id = mockState().massMail.jobs[0]!.id
    const job = await client.fetchQuery(jobOptions(id))
    expect(job.status).toBe('completed')
    const recipients = await client.fetchQuery(recipientOptions(id, { outcome: 'failed' }))
    expect(recipients.data.map((item) => item.failureCode)).toEqual(
      expect.arrayContaining(['overQuota', 'interrupted', 'connectionFailed']),
    )
    await expect(cancelJob(id, client)).rejects.toMatchObject({ status: 409 })
    client.clear()
  })
})
