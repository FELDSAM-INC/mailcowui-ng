import { HOSTILE_VECTORS } from '../../mocks/factories/hostile-messages'
import { expect, test } from '../fixtures/test'
import { openItem } from './helpers'

for (let offset = 0; offset < HOSTILE_VECTORS.length; offset += 8) {
  const vectors = HOSTILE_VECTORS.slice(offset, offset + 8)
  test(`SC-002 inert message corpus ${offset + 1}–${offset + vectors.length}`, async ({
    page,
    mockApi,
    guardRequests,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    void guardRequests
    await mockApi.use('quarantine-hostile')
    for (const [index, vector] of vectors.entries()) {
      await test.step(vector.name, async () => {
        await openItem(page, 1001 + offset + index)
        await expect(page.locator('[data-item-subject]')).not.toBeEmpty()
        await expect(
          page.locator(
            '[data-content] a, [data-content] img, [data-content] script, [data-content] iframe, [data-content] object, [data-content] form',
          ),
        ).toHaveCount(0)
        expect(
          await page.evaluate(() => (window as unknown as Record<string, unknown>).__xss),
        ).toBeUndefined()
        await expectNoHorizontalScroll()
      })
    }
    await expectAccessible()
  })
}
