// UI 006 T060: domain scope, exact recipient/domain filters and shareable sorting/paging.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'

const scopedItems = [
  { id: 1, recipient: 'alice@example.org' },
  { id: 2, recipient: 'erik@example.com' },
  { id: 3, recipient: 'gina@other.example' },
  { id: 4, recipient: 'hank@shop.example' },
  { id: 5, recipient: 'gone@alpha.example' },
]

const ids = (page: Page) =>
  page
    .locator('[data-quarantine-item]')
    .evaluateAll((items) => items.map((item) => Number(item.getAttribute('data-quarantine-item'))))
async function filters(page: Page) {
  if (!(await page.locator('[data-filter-panel]').isVisible()))
    await page.locator('[data-filter-toggle]').click()
}
const apply = (page: Page) => page.locator('[data-filter-panel] button[type="submit"]').click()

test('US2-AS1 domain administrators choose only their identity domains without a domains request', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('quarantine-domain-admin', { quarantine: { items: { replace: scopedItems } } })
  await page.goto('quarantine')
  await expect.poll(() => ids(page)).toEqual([2, 1])
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await page.locator('[data-quarantine-item="2"] summary').click()
  } else {
    await expect(page.getByRole('columnheader', { name: 'Recipient', exact: true })).toBeVisible()
  }
  await expect(page.locator('[data-quarantine-item="2"]')).toContainText('erik@example.com')
  await expectNoHorizontalScroll()
  await filters(page)
  await expect(page.locator('select#quarantine-domain option')).toHaveText([
    'All',
    'example.org',
    'example.com',
  ])
  await page.locator('#quarantine-domain').selectOption('example.com')
  await expectAccessible()
  await apply(page)
  await expect.poll(() => ids(page)).toEqual([2])
  await expect(page).toHaveURL(/domain=example.com/)
  expect(await mockApi.countRequests('listDomains')).toBe(0)
})

test('US2 an empty domain-administrator scope offers no server domain picker', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('quarantine-domain-admin', {
    accounts: { reseller: { scope: { type: 'domains', domains: [] } } },
  })
  await page.goto('quarantine')
  await expect(page.locator('[data-empty]')).toBeVisible()
  await filters(page)
  await expect(page.locator('select#quarantine-domain option')).toHaveText(['All'])
  await expect(page.locator('#quarantine-domain[role="combobox"]')).toHaveCount(0)
  expect(await mockApi.countRequests('listDomains')).toBe(0)
})

test('US2 administrators search domains through the shared picker and apply the chosen domain', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('quarantine-admin', { quarantine: { items: { replace: scopedItems } } })
  await page.goto('quarantine')
  await expect.poll(() => ids(page)).toEqual([5, 4, 3, 2, 1])
  await filters(page)
  const domain = page.locator('#quarantine-domain')
  await expect(domain).toHaveAttribute('role', 'combobox')
  await domain.fill('example.com')
  await page.getByRole('option', { name: 'example.com', exact: true }).click()
  await expectAccessible()
  await apply(page)
  await expect.poll(() => ids(page)).toEqual([2])
  const searches = (await mockApi.requests()).filter(
    (request) => request.operationId === 'listDomains',
  )
  expect(
    searches.some(
      (request) => new URL(request.path, 'http://mock').searchParams.get('q') === 'example.com',
    ),
  ).toBe(true)
})

test('US2 the recipient filter matches an exact address', async ({ page, mockApi }) => {
  await mockApi.use('quarantine-admin', {
    quarantine: {
      items: {
        replace: [
          { id: 1, recipient: 'bob@example.org' },
          { id: 2, recipient: 'bob+tag@example.org' },
          { id: 3, recipient: 'notbob@example.org' },
        ],
      },
    },
  })
  await page.goto('quarantine')
  await expect.poll(() => ids(page)).toEqual([3, 2, 1])
  await filters(page)
  await page.locator('#quarantine-recipient').fill('bob@example.org')
  await apply(page)
  await expect.poll(() => ids(page)).toEqual([1])
  expect(new URL(page.url()).searchParams.get('recipient')).toBe('bob@example.org')
})

test('US2-AS2 action, danger, score order and page survive reload and a shared address', async ({
  page,
  context,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('quarantine-admin', {
    quarantine: {
      items: {
        replace: [
          ...Array.from({ length: 60 }, (_, index) => ({
            id: 101 + index,
            recipient: 'alice@example.org',
            action: 'junk' as const,
            virus: true,
            score: index + 0.5,
          })),
          { id: 201, recipient: 'alice@example.org', action: 'rejected', virus: true, score: 100 },
          { id: 202, recipient: 'alice@example.org', action: 'junk', virus: false, score: 100 },
        ],
      },
    },
  })
  await page.goto('quarantine')
  await expect(page.locator('[data-quarantine-item]')).toHaveCount(25)
  await filters(page)
  await page.locator('[data-filter-panel] input[value="junk"]').check()
  await page.locator('#quarantine-virus').selectOption('true')
  await apply(page)
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await page.locator('#quarantine-sort').selectOption('score')
    await page.locator('#quarantine-order').selectOption('desc')
  } else {
    await page.getByRole('columnheader', { name: 'Score', exact: true }).getByRole('button').click()
  }
  await expect.poll(async () => (await ids(page))[0]).toBe(160)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  const expected = Array.from({ length: 25 }, (_, index) => 135 - index)
  await expect.poll(() => ids(page)).toEqual(expected)
  const shared = page.url()
  const query = new URL(shared).searchParams
  expect(query.getAll('action')).toEqual(['junk'])
  expect(query.get('virus')).toBe('true')
  expect(query.get('sort')).toBe('score')
  expect(query.get('page')).toBe('2')
  await page.reload()
  await expect.poll(() => ids(page)).toEqual(expected)
  await expectAccessible()
  const other = await context.newPage()
  try {
    await other.goto(shared)
    await expect.poll(() => ids(other)).toEqual(expected)
    await filters(other)
    await expect(other.locator('[data-filter-panel] input[value="junk"]')).toBeChecked()
    await expect(other.locator('#quarantine-virus')).toHaveValue('true')
  } finally {
    await other.close()
  }
})

test('US2 mailbox users have no recipient/domain controls and supplied scope parameters are ignored', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('quarantine-mailbox-user')
  await page.goto('quarantine?recipient=bob%40example.org&domain=other.example')
  await expect(page.locator('[data-quarantine-item]')).toHaveCount(25)
  if ((page.viewportSize()?.width ?? 0) < 768) {
    const item = page.locator('[data-quarantine-item]').first()
    await item.locator('summary').click()
    await expect(item.getByText('Recipient', { exact: true })).toHaveCount(0)
  } else {
    await expect(page.getByRole('columnheader', { name: 'Recipient', exact: true })).toHaveCount(0)
  }
  await filters(page)
  await expect(page.locator('#quarantine-recipient, #quarantine-domain')).toHaveCount(0)
  const requests = (await mockApi.requests()).filter(
    (request) => request.operationId === 'listQuarantineItems',
  )
  expect(requests.length).toBeGreaterThan(0)
  for (const request of requests) {
    const params = new URL(request.path, 'http://mock').searchParams
    expect(params.has('recipient')).toBe(false)
    expect(params.has('domain')).toBe(false)
  }
  expect(await mockApi.countRequests('listDomains')).toBe(0)
})

test('US2 all ten sort fields send the requested ordering and render its results', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('quarantine-admin', {
    quarantine: {
      items: {
        replace: [
          {
            id: 101,
            queueId: 'C',
            subject: 'C',
            sender: 'c@example.org',
            recipient: 'carol@example.org',
            action: 'subjectRewritten',
            virus: true,
            score: 9.3,
            notified: true,
            arrivedAt: '2026-10-03T10:00:00Z',
          },
          {
            id: 102,
            queueId: 'A',
            subject: 'A',
            sender: 'a@example.org',
            recipient: 'alice@example.org',
            action: 'junk',
            virus: false,
            score: 1.2,
            notified: false,
            arrivedAt: '2026-10-01T10:00:00Z',
          },
          {
            id: 103,
            queueId: 'B',
            subject: 'B',
            sender: 'b@example.org',
            recipient: 'bob@example.org',
            action: 'rejected',
            virus: false,
            score: 5.1,
            notified: true,
            arrivedAt: '2026-10-02T10:00:00Z',
          },
        ],
      },
    },
  })
  await page.goto('quarantine')
  await expect(page.locator('[data-quarantine-item]')).toHaveCount(3)
  const fields = [
    ['id', 'ID'],
    ['queueId', 'Rspamd QID'],
    ['sender', 'Sender (SMTP)'],
    ['subject', 'Subject'],
    ['action', 'Rspamd result'],
    ['recipient', 'Recipient'],
    ['virus', 'Danger'],
    ['score', 'Score'],
    ['notified', 'Notified'],
    ['arrivedAt', 'Received'],
  ] as const
  for (const [field, label] of fields) {
    await test.step(`sort ${field} ascending`, async () => {
      if ((page.viewportSize()?.width ?? 0) < 768) {
        await page.locator('#quarantine-sort').selectOption(field)
        await page.locator('#quarantine-order').selectOption('asc')
      } else {
        const header = page.getByRole('columnheader', { name: label, exact: true })
        await header.getByRole('button').click()
        await expect(header).toHaveAttribute('aria-sort', /^(ascending|descending)$/)
        if ((await header.getAttribute('aria-sort')) !== 'ascending')
          await header.getByRole('button').click()
        await expect(header).toHaveAttribute('aria-sort', 'ascending')
      }
      await expect
        .poll(() => ids(page))
        .toEqual(
          field === 'id' ? [101, 102, 103] : field === 'virus' ? [103, 102, 101] : [102, 103, 101],
        )
    })
  }
  const requests = (await mockApi.requests()).filter(
    (request) => request.operationId === 'listQuarantineItems',
  )
  for (const [field] of fields)
    expect(
      requests.some((request) => {
        const params = new URL(request.path, 'http://mock').searchParams
        return params.get('sort') === field && params.get('order') === 'asc'
      }),
    ).toBe(true)
  await expectAccessible()
})
