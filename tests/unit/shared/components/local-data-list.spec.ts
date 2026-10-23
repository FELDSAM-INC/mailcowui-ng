import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { expect, it } from 'vitest'
import { useLocalDataList } from '@/shared/composables/useLocalDataList'

it('searches and sorts a complete collection without changing the configured source order', () => {
  const source = ref([
    { name: 'Host 10', count: 10 },
    { name: 'Host 2', count: 2 },
    { name: 'Other', count: 0 },
  ])
  let list!: ReturnType<typeof useLocalDataList<(typeof source.value)[number]>>
  const wrapper = mount(
    defineComponent({
      setup() {
        list = useLocalDataList('local-test', source, [
          { id: 'name', label: 'Name', value: (item) => item.name },
          { id: 'count', label: 'Count', value: (item) => item.count },
        ])
        return () => null
      },
    }),
  )
  expect(list.rows.value).toEqual(source.value)
  list.table.sort('name')
  expect(list.rows.value.map((row) => row.name)).toEqual(['Host 2', 'Host 10', 'Other'])
  list.search.value = 'host'
  expect(list.rows.value).toHaveLength(2)
  list.table.sort('count')
  expect(list.rows.value.map((row) => row.count)).toEqual([2, 10])
  expect(source.value.map((row) => row.count)).toEqual([10, 2, 0])
  wrapper.unmount()
})
