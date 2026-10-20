<script setup lang="ts">
// The audit filters (FR-073, data-model §6): time range (presets or a custom start and end in the
// device's local time), event types (several at once), outcome, actor and client address. The
// address and the range are checked before they are applied; server field errors of the list
// request appear on the matching filter. The section is collapsible, and starts collapsed below
// the md breakpoint.
import { computed, reactive, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { ApiProblem, auditEventTypeValues, auditOutcomeValues, auditTargetTypeValues } from '@/api'
import { hasMessage } from '@/i18n'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { ChevronDownIcon, FilterIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible'
import { isIpNetwork } from '@/shared/validation/ip-network'
import {
  AUDIT_ACTOR_MAX_LENGTH,
  AUDIT_TARGET_ID_MAX_LENGTH,
  AUDIT_ADDRESS_MAX_LENGTH,
} from '@/shared/validation/limits'

import { auditLabelKey, useAuditLabels } from '../labels'
import type { AuditFilterValues } from '../list-state'
import {
  AUDIT_RANGES,
  isoToLocalInput,
  localInputToIso,
  validateCustomRange,
  type AuditRange,
} from '../time-range'

const props = defineProps<{
  filters: AuditFilterValues
  /** The problem of the list request, for field errors on the filters. */
  problem: ApiProblem | null
  /** Overrides the breakpoint (tests). */
  defaultOpen?: boolean
}>()
const emit = defineEmits<{
  apply: [values: Partial<AuditFilterValues>]
  clear: []
}>()

const { t } = useI18n()
const { label } = useAuditLabels()
const wide = useMediaQuery('(min-width: 768px)')
const open = ref(props.defaultOpen ?? wide.value)
const ids = {
  range: useId(),
  from: useId(),
  to: useId(),
  outcome: useId(),
  actor: useId(),
  address: useId(),
  targetType: useId(),
  targetId: useId(),
}

interface Draft {
  range: AuditRange | ''
  from: string
  to: string
  event: string[]
  outcome: string
  actor: string
  address: string
  targetType: string
  targetId: string
}

const draft = reactive<Draft>({
  range: '',
  from: '',
  to: '',
  event: [],
  outcome: '',
  actor: '',
  address: '',
  targetType: '',
  targetId: '',
})
// The target types offered are those this version labels, plus a selected one (UI 002 US8).
const targetTypes = computed(() =>
  auditTargetTypeValues.filter(
    (type) => hasMessage(auditLabelKey('targetType', type)) || draft.targetType === type,
  ),
)
// The event types offered as filters are those this version labels, plus any selected in the
// address. The contract lists the event types of every API feature (161 at UI 002's pin), and the
// ones without a label would all read "unknown event" (UI 002 research D2).
const eventTypes = computed(() =>
  auditEventTypeValues.filter(
    (type) => hasMessage(auditLabelKey('eventType', type)) || draft.event.includes(type),
  ),
)

watch(
  () => props.filters,
  (filters) => {
    draft.range = filters.range ?? ''
    draft.from = isoToLocalInput(filters.from)
    draft.to = isoToLocalInput(filters.to)
    draft.event = [...filters.event]
    draft.outcome = filters.outcome ?? ''
    draft.actor = filters.actor ?? ''
    draft.address = filters.address ?? ''
    draft.targetType = filters.targetType ?? ''
    draft.targetId = filters.targetId ?? ''
  },
  { immediate: true, deep: true },
)

const FIELDS: Record<string, string> = {
  from: ids.from,
  to: ids.to,
  outcome: ids.outcome,
  actor: ids.actor,
  address: ids.address,
  clientAddress: ids.address,
  targetType: ids.targetType,
  targetId: ids.targetId,
}
const form = useProblemForm({ fieldId: (path) => FIELDS[path] ?? null })
/** The address field shows client errors (`address`) and server errors (`clientAddress`). */
const addressErrors = () => [...form.errorsFor('address'), ...form.errorsFor('clientAddress')]

watch(
  () => props.problem,
  (problem) => {
    if (problem?.is('validation-failed') && problem.fieldErrors.size > 0) {
      open.value = true
      void form.setProblem(problem)
    }
  },
  { immediate: true },
)

/** A client-side violation with parameters, translated like a server one. */
function violation(path: string, code: 'tooLong', params: Record<string, unknown>): ApiProblem {
  return ApiProblem.fromParts({
    kind: 'problem',
    status: 422,
    type: '/api/v2/problems/validation-failed',
    fieldErrors: new Map([[path, [{ code, params, message: '' }]]]),
  })
}

async function submit() {
  const actor = draft.actor.trim()
  const address = draft.address.trim()
  const custom = draft.range === 'custom'
  const errors: Record<string, string[]> = {}
  if (custom) {
    for (const [path, key] of Object.entries(validateCustomRange(draft.from, draft.to))) {
      errors[path] = [key]
    }
  }
  if (address && (address.length > AUDIT_ADDRESS_MAX_LENGTH || !isIpNetwork(address))) {
    errors.address = ['validation.format.ipNetwork']
  }
  const targetId = draft.targetId.trim()
  const actorTooLong = actor.length > AUDIT_ACTOR_MAX_LENGTH
  const targetTooLong = targetId.length > AUDIT_TARGET_ID_MAX_LENGTH
  if (Object.keys(errors).length > 0 || actorTooLong || targetTooLong) {
    await form.setClientErrors(errors)
    if (actorTooLong) {
      await form.setProblem(violation('actor', 'tooLong', { max: AUDIT_ACTOR_MAX_LENGTH }))
    }
    if (targetTooLong) {
      await form.setProblem(violation('targetId', 'tooLong', { max: AUDIT_TARGET_ID_MAX_LENGTH }))
    }
    return
  }
  form.clear()
  emit('apply', {
    range: draft.range || undefined,
    from: custom ? (localInputToIso(draft.from) ?? undefined) : undefined,
    to: custom ? (localInputToIso(draft.to) ?? undefined) : undefined,
    event: auditEventTypeValues.filter((type) => draft.event.includes(type)),
    outcome: auditOutcomeValues.find((value) => value === draft.outcome),
    actor: actor || undefined,
    address: address || undefined,
    targetType: auditTargetTypeValues.find((value) => value === draft.targetType),
    targetId: targetId || undefined,
  })
}

function clear() {
  form.clear()
  emit('clear')
}
</script>

<template>
  <section class="surface">
    <Collapsible v-model:open="open">
      <CollapsibleTrigger
        class="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg font-semibold text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-white"
      >
        <span class="flex items-center gap-2">
          <FilterIcon class="size-5 shrink-0" />
          {{ t('auditLog.filters.title') }}
        </span>
        <ChevronDownIcon
          class="size-5 shrink-0 motion-safe:transition-transform"
          :class="open ? 'rotate-180' : ''"
        />
      </CollapsibleTrigger>
      <CollapsibleContent class="motion-reduce:animate-none">
        <form
          novalidate
          :aria-label="t('auditLog.filters.title')"
          class="mt-4 flex flex-col gap-4"
          @submit.prevent="submit"
        >
          <ErrorSummary :id="form.summaryId" :items="form.summary.value" />
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FormField :id="ids.range" v-slot="field" :label="t('auditLog.filters.range')">
              <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- labelled by FormField (for/id) -->
              <select v-bind="field" v-model="draft.range" class="form-control">
                <option value="">{{ t('auditLog.filters.ranges.any') }}</option>
                <option v-for="range in AUDIT_RANGES" :key="range" :value="range">
                  {{ t(`auditLog.filters.ranges.${range}`) }}
                </option>
              </select>
            </FormField>
            <template v-if="draft.range === 'custom'">
              <FormField
                :id="ids.from"
                v-slot="field"
                :label="t('auditLog.filters.from')"
                :errors="form.errorsFor('from')"
              >
                <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- labelled by FormField (for/id) -->
                <input
                  v-bind="field"
                  v-model="draft.from"
                  type="datetime-local"
                  class="form-control"
                />
              </FormField>
              <FormField
                :id="ids.to"
                v-slot="field"
                :label="t('auditLog.filters.to')"
                :errors="form.errorsFor('to')"
              >
                <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- labelled by FormField (for/id) -->
                <input
                  v-bind="field"
                  v-model="draft.to"
                  type="datetime-local"
                  class="form-control"
                />
              </FormField>
            </template>
            <FormField
              :id="ids.outcome"
              v-slot="field"
              :label="t('auditLog.filters.outcome')"
              :errors="form.errorsFor('outcome')"
            >
              <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- labelled by FormField (for/id) -->
              <select v-bind="field" v-model="draft.outcome" class="form-control">
                <option value="">{{ t('auditLog.filters.anyOutcome') }}</option>
                <option v-for="outcome in auditOutcomeValues" :key="outcome" :value="outcome">
                  {{ label('outcome', outcome) }}
                </option>
              </select>
            </FormField>
            <FormField
              :id="ids.actor"
              v-slot="field"
              :label="t('auditLog.filters.actor')"
              :description="t('auditLog.filters.actorHelp')"
              :errors="form.errorsFor('actor')"
            >
              <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- labelled by FormField (for/id) -->
              <input
                v-bind="field"
                v-model="draft.actor"
                type="text"
                :maxlength="AUDIT_ACTOR_MAX_LENGTH"
                autocapitalize="none"
                spellcheck="false"
                class="form-control"
              />
            </FormField>
            <FormField
              :id="ids.address"
              v-slot="field"
              :label="t('auditLog.filters.address')"
              :description="t('auditLog.filters.addressHelp')"
              :errors="addressErrors()"
            >
              <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- labelled by FormField (for/id) -->
              <input
                v-bind="field"
                v-model="draft.address"
                type="text"
                :maxlength="AUDIT_ADDRESS_MAX_LENGTH"
                autocapitalize="none"
                spellcheck="false"
                class="form-control"
              />
            </FormField>
            <FormField
              :id="ids.targetType"
              v-slot="field"
              :label="t('auditLog.filters.targetType')"
            >
              <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- labelled by FormField (for/id) -->
              <select v-bind="field" v-model="draft.targetType" class="form-control">
                <option value="">{{ t('auditLog.filters.anyTargetType') }}</option>
                <option v-for="type in targetTypes" :key="type" :value="type">
                  {{ label('targetType', type) }}
                </option>
              </select>
            </FormField>
            <FormField
              :id="ids.targetId"
              v-slot="field"
              :label="t('auditLog.filters.targetId')"
              :errors="form.errorsFor('targetId')"
            >
              <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- labelled by FormField (for/id) -->
              <input
                v-bind="field"
                v-model="draft.targetId"
                type="text"
                :maxlength="AUDIT_TARGET_ID_MAX_LENGTH"
                autocapitalize="none"
                spellcheck="false"
                class="form-control"
              />
            </FormField>
          </div>
          <fieldset>
            <legend class="mb-1 text-sm font-medium text-gray-800 dark:text-gray-200">
              {{ t('auditLog.filters.eventTypes') }}
            </legend>
            <div class="grid sm:grid-cols-2 lg:grid-cols-4">
              <label
                v-for="type in eventTypes"
                :key="type"
                class="flex min-h-11 items-center gap-3 text-gray-800 dark:text-gray-200"
              >
                <input
                  v-model="draft.event"
                  type="checkbox"
                  :value="type"
                  class="size-5 shrink-0 accent-accent"
                />
                <span class="min-w-0 wrap-anywhere">{{ label('eventType', type) }}</span>
              </label>
            </div>
          </fieldset>
          <div class="flex flex-wrap gap-3">
            <button type="submit" :class="buttonVariants({})">
              {{ t('auditLog.filters.apply') }}
            </button>
            <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="clear">
              {{ t('auditLog.filters.clear') }}
            </button>
          </div>
        </form>
      </CollapsibleContent>
    </Collapsible>
  </section>
</template>
