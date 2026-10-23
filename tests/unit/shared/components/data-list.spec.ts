import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { createDataList } from '@/shared/composables/useDataList'
import { localStore } from '@/shared/platform/storage'

describe('shared data-list presentation', () => {
  beforeEach(() => localStorage.clear())

  it('can hide default columns, reveal optional columns and retain choices per list', () => {
    const list = createDataList('mailboxes')
    list.columns.value = [
      { id: 'name', label: 'Name' },
      { id: 'quota', label: 'Quota' },
      { id: 'created', label: 'Created', defaultVisible: false },
    ]
    expect(list.visible('quota')).toBe(true)
    list.setVisible('quota', false)
    list.setVisible('created', true)
    expect(list.visible('quota')).toBe(false)
    expect(list.visible('created')).toBe(true)
    const restored = createDataList('mailboxes')
    restored.columns.value = list.columns.value
    expect(restored.visible('quota')).toBe(false)
    expect(restored.visible('created')).toBe(true)
    const domains = createDataList('domains')
    domains.columns.value = list.columns.value
    expect(domains.visible('quota')).toBe(true)
  })

  it('keeps preferences separate when a reused page changes lists', () => {
    const scope = effectScope()
    scope.run(() => {
      const key = ref('admins')
      const list = createDataList(key)
      list.columns.value = [
        { id: 'name', label: 'Name' },
        { id: 'created', label: 'Created' },
      ]
      list.setVisible('created', false)
      key.value = 'domain-admins'
      expect(list.visible('created')).toBe(true)
      list.setVisible('name', false)
      key.value = 'admins'
      expect(list.visible('name')).toBe(true)
      expect(list.visible('created')).toBe(false)
    })
    scope.stop()
  })

  it('keeps one data column visible and continues working with corrupt or blocked storage', () => {
    localStore.set('mailcowui-ng.table-columns', 'invalid')
    const list = createDataList('domains')
    list.columns.value = [
      { id: 'name', label: 'Name' },
      { id: 'count', label: 'Count' },
    ]
    list.setVisible('count', false)
    list.setVisible('name', false)
    expect(list.visible('name')).toBe(true)
    const save = vi.spyOn(localStore, 'set').mockReturnValue(false)
    list.setVisible('count', true)
    expect(list.visible('count')).toBe(true)
    save.mockRestore()
  })

  it('toggles the same sort key and starts a different column in ascending order', () => {
    const list = createDataList('aliases')
    const change = vi.fn()
    list.sorting.value = { key: 'name', order: 'asc', change }
    list.sort('name')
    expect(change).toHaveBeenLastCalledWith('name', 'desc')
    list.sort('created')
    expect(change).toHaveBeenLastCalledWith('created', 'asc')
  })
})
