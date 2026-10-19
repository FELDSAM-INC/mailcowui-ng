<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { quarantineItemActionValues } from '@/api'
import { lt, text } from '@/i18n'
import ActiveFilterChips, { type FilterChip } from '@/shared/components/ActiveFilterChips.vue'
import DomainPicker from '@/shared/components/DomainPicker.vue'
import FilterPanel from '@/shared/components/FilterPanel.vue'
import FormField from '@/shared/components/FormField.vue'
import LocaleNumberField from '@/shared/components/LocaleNumberField.vue'

import { quarantineDomainSource } from '../../api'
import {
  activeFilterCount,
  dayRangeInverted,
  NO_FILTERS,
  RECIPIENT_FILTER_MAX_LENGTH,
  RECIPIENT_PATTERN,
  scoreFromTenths,
  scoreRangeInverted,
  scoreToTenths,
  type QuarantineListFilters,
} from '../../list-state'

const props = defineProps<{ filters: QuarantineListFilters; scoped: boolean }>()
const emit = defineEmits<{ apply: [filters: QuarantineListFilters] }>()
const { t } = useI18n()
const copy = () => ({ ...props.filters, action: [...props.filters.action] })
const draft = ref(copy())
const validMin = ref(true)
const validMax = ref(true)
function resetDraft() {
  draft.value = copy()
  validMin.value = validMax.value = true
}
watch(() => props.filters, resetDraft)
const source = [quarantineDomainSource()]
const count = computed(() => activeFilterCount(props.filters, props.scoped))
const recipientErrors = computed(() =>
  props.scoped && draft.value.recipient && !RECIPIENT_PATTERN.test(draft.value.recipient)
    ? [t('validation.format.email')]
    : [],
)
const dayErrors = computed(() =>
  dayRangeInverted(draft.value)
    ? [
        t('validation.mustNotExceed', {
          field: t('quarantineUi.filters.receivedTo'),
          value: draft.value.to,
        }),
      ]
    : [],
)
const scoreErrors = computed(() =>
  scoreRangeInverted(draft.value)
    ? [
        t('validation.mustNotExceed', {
          field: t('quarantineUi.filters.scoreMax'),
          value: draft.value.maxScore,
        }),
      ]
    : [],
)
const invalid = computed(
  () =>
    !validMin.value ||
    !validMax.value ||
    recipientErrors.value.length > 0 ||
    dayErrors.value.length > 0 ||
    scoreErrors.value.length > 0,
)
const labels = computed<Record<string, string>>(() => ({
  recipient: lt('quarantine.rcpt'),
  domain: lt('mailbox.domain'),
  virus: lt('quarantine.danger'),
  notified: lt('quarantine.notified'),
  from: `${lt('quarantine.received')} · ${t('quarantineUi.filters.receivedFrom')}`,
  to: `${lt('quarantine.received')} · ${t('quarantineUi.filters.receivedTo')}`,
  minScore: t('quarantineUi.filters.scoreMin'),
  maxScore: t('quarantineUi.filters.scoreMax'),
}))
const chips = computed<FilterChip[]>(() => {
  const filters = props.filters
  const result: FilterChip[] = filters.action.map((action) => ({
    key: `action:${action}`,
    label: text(`enums.quarantineItemAction.${action}`),
  }))
  for (const key of Object.keys(labels.value)) {
    if (!props.scoped && (key === 'recipient' || key === 'domain')) continue
    const value = filters[key]
    if (typeof value !== 'string' || value === '') continue
    const displayed =
      key === 'virus'
        ? lt(value === 'true' ? 'quarantine.high_danger' : 'quarantine.neutral_danger')
        : key === 'notified'
          ? t(value === 'true' ? 'lists.filters.yes' : 'lists.filters.no')
          : value
    result.push({ key, label: `${labels.value[key]}: ${displayed}` })
  }
  return result
})
function clear() {
  emit('apply', { ...NO_FILTERS, action: [], q: props.filters.q })
}
function remove(key: string) {
  const next = copy()
  if (key.startsWith('action:'))
    next.action = next.action.filter((action) => `action:${action}` !== key)
  else Object.assign(next, { [key]: undefined })
  emit('apply', next)
}
const CONTROL =
  'h-11 min-w-0 max-w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white'
</script>

<template>
  <FilterPanel
    id="quarantine-filters"
    :active-count="count"
    :apply-disabled="invalid"
    @open="resetDraft"
    @apply="emit('apply', { ...draft, action: [...draft.action] })"
    @clear="clear"
  >
    <fieldset class="flex flex-col gap-1">
      <legend class="text-sm font-medium text-gray-800 dark:text-gray-200">
        {{ lt('quarantine.rspamd_result') }}
      </legend>
      <label
        v-for="action in quarantineItemActionValues"
        :key="action"
        class="flex min-h-11 items-center gap-2 text-sm text-gray-800 dark:text-gray-200"
      >
        <input v-model="draft.action" type="checkbox" :value="action" class="size-5 shrink-0" />{{
          text(`enums.quarantineItemAction.${action}`)
        }}
      </label>
    </fieldset>
    <FormField id="quarantine-virus" v-slot="control" :label="lt('quarantine.danger')">
      <select v-bind="control" v-model="draft.virus" :class="CONTROL">
        <option :value="undefined">{{ t('lists.filters.all') }}</option>
        <option value="true">{{ lt('quarantine.high_danger') }}</option>
        <option value="false">{{ lt('quarantine.neutral_danger') }}</option>
      </select>
    </FormField>
    <FormField id="quarantine-notified" v-slot="control" :label="lt('quarantine.notified')">
      <select v-bind="control" v-model="draft.notified" :class="CONTROL">
        <option :value="undefined">{{ t('lists.filters.all') }}</option>
        <option value="true">{{ t('lists.filters.yes') }}</option>
        <option value="false">{{ t('lists.filters.no') }}</option>
      </select>
    </FormField>
    <FormField id="quarantine-from" v-slot="control" :label="labels.from!" :errors="dayErrors">
      <input v-bind="control" v-model="draft.from" type="date" :class="CONTROL" />
    </FormField>
    <FormField id="quarantine-to" v-slot="control" :label="labels.to!">
      <input v-bind="control" v-model="draft.to" type="date" :class="CONTROL" />
    </FormField>
    <LocaleNumberField
      id="quarantine-min-score"
      :model-value="scoreToTenths(draft.minScore)"
      :label="labels.minScore!"
      optional
      :errors="scoreErrors"
      @update:model-value="draft.minScore = scoreFromTenths($event)"
      @update:valid="validMin = $event"
    />
    <LocaleNumberField
      id="quarantine-max-score"
      :model-value="scoreToTenths(draft.maxScore)"
      :label="labels.maxScore!"
      optional
      @update:model-value="draft.maxScore = scoreFromTenths($event)"
      @update:valid="validMax = $event"
    />
    <template v-if="scoped">
      <FormField
        id="quarantine-recipient"
        v-slot="control"
        :label="labels.recipient!"
        :errors="recipientErrors"
      >
        <input
          v-bind="control"
          v-model.trim="draft.recipient"
          type="email"
          :maxlength="RECIPIENT_FILTER_MAX_LENGTH"
          autocomplete="off"
          :class="CONTROL"
        />
      </FormField>
      <DomainPicker
        id="quarantine-domain"
        :label="labels.domain!"
        :sources="source"
        :model-value="draft.domain ?? null"
        @update:model-value="draft.domain = typeof $event === 'string' ? $event : undefined"
      />
    </template>
  </FilterPanel>
  <ActiveFilterChips :chips="chips" @remove="remove" @clear="clear" />
</template>
