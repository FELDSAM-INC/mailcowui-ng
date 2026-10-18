// JSON Merge Patches of the changed members only (UI 002 T022, research D11, FR-030).
import { describe, expect, it } from 'vitest'

import { buildPatch, TEMPLATE_READ_ONLY } from '@/features/domains/patch'

const base = {
  description: 'Alpha',
  maxMailboxes: 10,
  domainQuota: 10_737_418_240,
  tags: ['a', 'B'],
  name: 'alpha.example',
  etag: '"1"',
}

describe('buildPatch', () => {
  it('sends only the changed members of the section', () => {
    expect(
      buildPatch(base, { ...base, description: 'New', maxMailboxes: 10 }, [
        'description',
        'maxMailboxes',
      ]),
    ).toEqual({ description: 'New' })
  })

  it('sends the whole tag set when it changed, nothing when only order or case differ', () => {
    expect(buildPatch(base, { ...base, tags: ['b', 'A'] }, ['tags'])).toEqual({})
    expect(buildPatch(base, { ...base, tags: ['B', 'c'] }, ['tags'])).toEqual({ tags: ['B', 'c'] })
  })

  it('compares quotas in bytes', () => {
    expect(buildPatch(base, { ...base, domainQuota: 10 * 1024 ** 3 }, ['domainQuota'])).toEqual({})
    expect(buildPatch(base, { ...base, domainQuota: 20 * 1024 ** 3 }, ['domainQuota'])).toEqual({
      domainQuota: 21_474_836_480,
    })
  })

  it('never includes read-only members', () => {
    const fields = ['description', 'name', 'etag'] as never[]
    expect(buildPatch(base, { ...base, name: 'other', etag: '"2"' }, fields)).toEqual({})
  })

  it('sends a template name, but never its read-only members', () => {
    const template = { id: 2, name: 'Small', isDefault: false, etag: '"t"' }
    const fields = ['id', 'name', 'isDefault', 'etag'] as never[]
    expect(
      buildPatch(
        template,
        { ...template, id: 3, name: 'Smaller', isDefault: true, etag: '"u"' },
        fields,
        {},
        TEMPLATE_READ_ONLY,
      ),
    ).toEqual({ name: 'Smaller' })
  })
})
