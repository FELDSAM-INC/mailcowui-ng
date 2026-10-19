// UI 011 (FR-024, T052): a container that stops while the dashboard is shown is announced once.
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import type { Container } from '@/api'
import { useStoppedAnnouncer } from '@/features/operations/dashboard/composables/useStoppedAnnouncer'

const announce = vi.hoisted(() => vi.fn())
vi.mock('@/shared/composables/useAnnouncer', () => ({ announce }))

import { withSetup } from '../../../support/composable'
import { container } from './helpers'

describe('useStoppedAnnouncer', () => {
  it('announces each running → not running transition once, not the first list', async () => {
    const list = ref<Container[] | undefined>([
      container({ name: 'a', running: false }),
      container({ name: 'b' }),
    ])
    withSetup(() => useStoppedAnnouncer(() => list.value))
    await nextTick()
    expect(announce).not.toHaveBeenCalled()
    list.value = [
      container({ name: 'a', running: false }),
      container({ name: 'b', running: false }),
    ]
    await nextTick()
    list.value = [
      container({ name: 'a', running: false }),
      container({ name: 'b', running: false }),
    ]
    await nextTick()
    expect(announce).toHaveBeenCalledTimes(1)
    expect(announce).toHaveBeenCalledWith('b is no longer running.')
  })
})
