// The members of a save (UI 009 T012, research R6): only changed values after trimming; a
// creation sends the filled members.
import { describe, expect, it } from 'vitest'

import {
  bareEtag,
  changedMembers,
  filledMembers,
  valueText,
} from '@/features/routing/logic/changed-fields'

describe('changed fields', () => {
  it('sends only the members whose trimmed value changed', () => {
    const opened = { host: 'relay.example', active: true, username: null as string | null }
    expect(
      changedMembers(opened, { host: ' relay.example ', active: true }, ['host', 'active']),
    ).toEqual({})
    expect(
      changedMembers(opened, { host: 'other.example ', active: false }, ['host', 'active']),
    ).toEqual({
      host: 'other.example',
      active: false,
    })
    expect(changedMembers(opened, { username: '' }, ['username'])).toEqual({ username: '' })
    expect(changedMembers(opened, {}, ['host'])).toEqual({})
  })

  it('leaves empty members out of a creation and strips version quotes', () => {
    expect(
      filledMembers({
        destination: ' a.example ',
        username: '',
        password: undefined,
        active: false,
      }),
    ).toEqual({
      destination: 'a.example',
      active: false,
    })
    expect(bareEtag('"abc"')).toBe('abc')
    expect(valueText(null)).toBe('')
    expect(valueText(3)).toBe('3')
    expect(valueText(['a'])).toBe('["a"]')
  })
})
