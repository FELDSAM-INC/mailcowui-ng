// The resource forms (T095, data-model §2): the creation request of the classic add form (the
// booking limit only for a hard limit) and the patch of the edit form (only changed members).
import { describe, expect, it } from 'vitest'

import {
  buildResourcePatch,
  createFormDefaults,
  editFormFrom,
  toCreateRequest,
} from '@/features/resources/resource-form'

import { resource } from './resource-fixture'

describe('toCreateRequest', () => {
  it("sends legacy's defaults, and the limit only for a hard limit", () => {
    const form = {
      ...createFormDefaults(),
      description: ' Room ',
      domain: 'example.org',
      kind: 'thing' as const,
    }
    expect(form.bookingRule).toBe('unlimited')
    expect(toCreateRequest(form)).toEqual({
      description: 'Room',
      domain: 'example.org',
      kind: 'thing',
      bookingRule: 'unlimited',
      active: true,
    })
    expect(
      toCreateRequest({ ...form, bookingRule: 'limited', bookingLimitText: '3' }),
    ).toMatchObject({ bookingRule: 'limited', bookingLimit: 3 })
    expect(toCreateRequest({ ...form, bookingLimitText: '3' })).not.toHaveProperty('bookingLimit')
  })
})

describe('buildResourcePatch', () => {
  const read = resource({ bookingRule: 'limited', bookingLimit: 2 })

  it('is null without changes and holds only the changed members', () => {
    expect(buildResourcePatch(read, editFormFrom(read))).toBeNull()
    expect(buildResourcePatch(read, { ...editFormFrom(read), active: false })).toEqual({
      active: false,
    })
    expect(buildResourcePatch(read, { ...editFormFrom(read), bookingLimitText: '5' })).toEqual({
      bookingLimit: 5,
    })
    expect(buildResourcePatch(read, { ...editFormFrom(read), bookingRule: 'alwaysFree' })).toEqual({
      bookingRule: 'alwaysFree',
    })
    expect(
      buildResourcePatch(resource(), {
        ...editFormFrom(resource()),
        bookingRule: 'limited',
        bookingLimitText: '4',
      }),
    ).toEqual({ bookingRule: 'limited', bookingLimit: 4 })
  })
})
