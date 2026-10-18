<script setup lang="ts">
// "Exclude from footer" as the classic tab has it (`templates/edit/domain.twig` #dfooter): one
// multi-select of the domain's mailboxes, aliases ("Alias") and alias domains ("Alias-Domain"), in
// that order, read from the list operations of features 003 and 004. Mailboxes and aliases map to
// `excludedAddresses`, alias domains to `excludedAliasDomains`. Selected entries stay listed even
// when a search or the stored data no longer returns them, so a stale exclusion can be seen and
// removed. When a list has more entries than one page, a search narrows the choice as you type.
import { useQuery } from '@tanstack/vue-query'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'

import { exclusionCandidatesOptions } from '../../api'

const props = withDefaults(
  defineProps<{
    id: string
    domain: string
    addresses: readonly string[]
    aliasDomains: readonly string[]
    errors?: readonly string[]
  }>(),
  { errors: () => [] },
)
const emit = defineEmits<{
  'update:addresses': [value: string[]]
  'update:aliasDomains': [value: string[]]
}>()
const { t } = useI18n()

const SEARCH_DELAY_MS = 300
const search = ref('')
const q = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
function onSearch(event: Event) {
  search.value = (event.target as HTMLInputElement).value
  clearTimeout(timer)
  timer = setTimeout(() => (q.value = search.value.trim()), SEARCH_DELAY_MS)
}
onBeforeUnmount(() => clearTimeout(timer))

const query = useQuery(computed(() => exclusionCandidatesOptions(props.domain, q.value)))
const candidates = computed(() => query.data.value)
const searchable = computed(() => q.value !== '' || !!candidates.value?.more)

interface Option {
  value: string
  label: string
  selected: boolean
}

const lower = (values: readonly string[]) => new Set(values.map((value) => value.toLowerCase()))

const options = computed<Option[]>(() => {
  const selectedAddresses = lower(props.addresses)
  const selectedDomains = lower(props.aliasDomains)
  const mailboxes = candidates.value?.mailboxes ?? []
  const aliases = candidates.value?.aliases ?? []
  const domains = candidates.value?.aliasDomains ?? []
  const listed = lower([...mailboxes, ...aliases])
  const listedDomains = lower(domains)
  const address = (value: string, label = value) => ({
    value: `a:${value}`,
    label,
    selected: selectedAddresses.has(value.toLowerCase()),
  })
  const aliasDomain = (value: string) => ({
    value: `d:${value}`,
    label: `${value} (${t('domains.footer.aliasDomainSubtext')})`,
    selected: selectedDomains.has(value.toLowerCase()),
  })
  return [
    ...mailboxes.map((value) => address(value)),
    ...props.addresses
      .filter((value) => !listed.has(value.toLowerCase()))
      .map((value) => address(value)),
    ...aliases.map((value) => address(value, `${value} (${t('domains.footer.aliasSubtext')})`)),
    ...domains.map(aliasDomain),
    ...props.aliasDomains
      .filter((value) => !listedDomains.has(value.toLowerCase()))
      .map(aliasDomain),
  ]
})

function onChange(event: Event) {
  const chosen = [...(event.target as HTMLSelectElement).selectedOptions].map(
    (option) => option.value,
  )
  emit(
    'update:addresses',
    chosen.filter((value) => value.startsWith('a:')).map((value) => value.slice(2)),
  )
  emit(
    'update:aliasDomains',
    chosen.filter((value) => value.startsWith('d:')).map((value) => value.slice(2)),
  )
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-2">
    <div v-if="searchable" class="flex flex-col gap-1.5">
      <label :for="`${id}-search`" class="text-sm font-medium text-gray-800 dark:text-gray-200">
        {{ lt('datatables.search') }}
      </label>
      <input
        :id="`${id}-search`"
        type="search"
        :value="search"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        :aria-controls="id"
        class="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        @input="onSearch"
      />
    </div>
    <FormField :id="id" :label="lt('edit.footer_exclude')" :errors="errors">
      <template #default="control">
        <select
          v-bind="control"
          multiple
          size="10"
          class="w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          :aria-busy="query.isFetching.value ? 'true' : undefined"
          @change="onChange"
        >
          <option
            v-for="option in options"
            :key="option.value"
            :value="option.value"
            :selected="option.selected"
            class="break-all"
          >
            {{ option.label }}
          </option>
        </select>
      </template>
    </FormField>
    <p v-if="query.isError.value" role="alert" class="text-sm text-red-700 dark:text-red-300">
      {{ t('states.list.error') }}
    </p>
  </div>
</template>
