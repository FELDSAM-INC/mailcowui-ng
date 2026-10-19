// Write-only credentials (UI 009 T029, research R7): the patch rules table and the derived notes.
import { describe, expect, it } from 'vitest'

import {
  credentialCreate,
  credentialIntent,
  credentialPatch,
  removalPending,
  willRemoveWithUsername,
} from '@/features/routing/logic/credentials'

const stored = credentialIntent({ username: 'relay', passwordSet: true })

describe('credentials', () => {
  it.each([
    ['left empty', {}, {}],
    ['a typed password', { password: 'New-1' }, { password: 'New-1' }],
    ['"Remove password"', { removePassword: true }, { password: '' }],
    ['a changed username', { username: ' other ' }, { username: 'other' }],
    ['a cleared username', { username: '' }, { username: '' }],
  ])('%s', (_name, change, patch) => {
    expect(credentialPatch({ ...stored, ...change })).toEqual(patch)
  })

  it('creates with what is filled and derives the notes', () => {
    expect(credentialCreate({ ...credentialIntent(null), username: ' u ', password: 'p' })).toEqual(
      {
        username: 'u',
        password: 'p',
      },
    )
    expect(credentialCreate(credentialIntent(null))).toEqual({})
    expect(willRemoveWithUsername({ ...stored, username: '' })).toBe(true)
    expect(willRemoveWithUsername({ ...stored, username: '', password: 'x' })).toBe(false)
    expect(willRemoveWithUsername({ ...stored, username: '', removePassword: true })).toBe(false)
    expect(removalPending({ ...stored, removePassword: true })).toBe(true)
    expect(removalPending({ ...credentialIntent(null), removePassword: true })).toBe(false)
    expect(credentialPatch({ ...credentialIntent(null), removePassword: true })).toEqual({})
  })
})
