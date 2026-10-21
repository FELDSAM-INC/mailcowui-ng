<script setup lang="ts">
// The regex filters (FR-071, FR-072, plan decisions 16, 18, 21 and 22), as legacy's collapsible
// legend `admin.f2b_filter` (collapsed by default) with `admin.f2b_regex_info` and the table of
// rules: ID ("+" for an added row) and RegExp, "Remove row", then Save, "Reset to default" and
// "Add row". Saving replaces the whole list with the version tag that was read; the client checks
// the number and length of the rules from the capabilities, and a refused rule shows its reason on
// its row (the compiler's message verbatim). An outdated save keeps the rows, reloads, and offers
// "Save again" or "Discard". The reset asks legacy's `admin.ays`; when the ban service does not
// restore the defaults in time, legacy's `danger.reset_f2b_regex` with Refresh, never a second
// reset. No reordering (legacy has none).
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  type ApiProblem,
  isApiProblem,
  type Fail2BanRules,
  type MonitoringCapabilities,
} from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import { useProblemMessages } from '@/i18n/problems'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import RowControls from '@/shared/components/RowControls.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import PlainText from '@/shared/components/PlainText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { confirm } from '@/shared/composables/useConfirm'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useVersionedSave } from '@/shared/composables/useVersionedSave'
import { ChevronDownIcon, PlusIcon, WarningIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { fetchRules, replaceRules, resetRules, writeRules } from '../api'
import { RestartIcon } from '../../icons'

const props = defineProps<{
  rules: Fail2BanRules
  capabilities: MonitoringCapabilities | null
}>()
const emit = defineEmits<{ dirty: [dirty: boolean] }>()

const { t } = useI18n()
const fmt = useFormat()
const client = useQueryClient()
const { violationMessage } = useProblemMessages()
const id = useId()

interface Row {
  key: number
  /** The rule's number when it was read; null for an added row ("+"). */
  number: number | null
  pattern: string
}

let nextKey = 1
const toRows = (rules: Fail2BanRules): Row[] =>
  rules.rules.map((rule) => ({ key: nextKey++, number: rule.number, pattern: rule.pattern }))

const expanded = ref(false)
const base = shallowRef<Fail2BanRules>(props.rules)
const current = shallowRef<Fail2BanRules>(props.rules)
const rows = ref<Row[]>(toRows(props.rules))
const status = ref<string | null>(null)
const notRecorded = ref(false)
const outdated = ref(false)
const resetProblem = shallowRef<ApiProblem | null>(null)

const patterns = computed(() => rows.value.map((row) => row.pattern))
const dirty = computed(
  () => JSON.stringify(patterns.value) !== JSON.stringify(base.value.rules.map((r) => r.pattern)),
)
watch(dirty, (value) => emit('dirty', value), { immediate: true })

// New rules from the server (a save elsewhere, a reload) replace the rows while nothing is edited.
watch(
  () => props.rules,
  (rules) => {
    if (dirty.value || outdated.value) return
    base.value = rules
    current.value = rules
    rows.value = toRows(rules)
  },
)

const versioned = useVersionedSave<Fail2BanRules>({
  current: () => current.value,
  refetch: async () => {
    const latest = await fetchRules()
    writeRules(client, latest)
    return latest
  },
})

const inputId = (index: number) => `${id}-rule-${index}`
const problems = useProblemForm({
  fieldId: (path) => {
    const [field, index] = path.split('.')
    if (field !== 'rules') return null
    return index === undefined ? `${id}-add` : inputId(Number(index))
  },
})

function clientErrors(): Record<string, string[]> {
  const messages: Record<string, string[]> = {}
  const limits = props.capabilities?.limits
  if (rows.value.length === 0) messages.rules = [t('validation.required')]
  else if (limits && rows.value.length > limits.fail2banRulesMax) {
    messages.rules = [t('validation.tooMany', { max: fmt.number(limits.fail2banRulesMax) })]
  }
  rows.value.forEach((row, index) => {
    if (row.pattern.length === 0) {
      messages[`rules.${index}`] = [t('validation.tooShort', { min: fmt.number(1) })]
    } else if (limits && row.pattern.length > limits.fail2banRuleMaxLength) {
      messages[`rules.${index}`] = [
        t('validation.tooLong', { max: fmt.number(limits.fail2banRuleMaxLength) }),
      ]
    }
  })
  return messages
}

/** The compiler's message of a refused rule, shown verbatim below its row. */
const compilerMessages = shallowRef<Record<number, string>>({})

function serverMessages(problem: ApiProblem): Record<string, string[]> {
  const messages: Record<string, string[]> = {}
  const compiler: Record<number, string> = {}
  for (const [path, violations] of problem.fieldErrors) {
    for (const violation of violations) {
      const params = (violation.params ?? {}) as Record<string, unknown>
      const [, index] = path.split('.')
      if (violation.code === 'invalidRegex' && index !== undefined) {
        if (typeof params.error === 'string') compiler[Number(index)] = params.error
        ;(messages[path] ??= []).push(t('validation.invalidRegex'))
      } else if (violation.code === 'missingCaptureGroup') {
        ;(messages[path] ??= []).push(t('validation.missingCaptureGroup'))
      } else {
        ;(messages[path] ??= []).push(violationMessage(violation))
      }
    }
  }
  compilerMessages.value = compiler
  return messages
}

function clearMessages() {
  status.value = null
  notRecorded.value = false
  resetProblem.value = null
  compilerMessages.value = {}
  problems.clear()
}

async function save() {
  clearMessages()
  const errors = clientErrors()
  if (Object.keys(errors).length > 0) {
    await problems.setClientMessages(errors)
    return
  }
  const result = await versioned.save([...patterns.value], (rules, ifMatch) =>
    replaceRules(rules, ifMatch),
  )
  if (result.status === 'saved') {
    const saved = result.result.result
    writeRules(client, saved)
    notRecorded.value = !result.result.auditRecorded
    base.value = saved
    current.value = saved
    rows.value = toRows(saved)
    outdated.value = false
    status.value = lt('success.object_modified', '')
    announce(status.value)
  } else if (result.status === 'outdated') {
    if (result.latest) current.value = result.latest
    outdated.value = true
  } else if (result.status === 'failed') {
    if (result.problem.fieldErrors.size > 0) {
      await problems.setClientMessages(serverMessages(result.problem))
    } else {
      await problems.setProblem(result.problem)
    }
  }
}

function discard() {
  const latest = versioned.discard() ?? current.value
  base.value = latest
  current.value = latest
  rows.value = toRows(latest)
  outdated.value = false
  clearMessages()
}

async function reset() {
  clearMessages()
  const ask = () =>
    confirm({
      title: lt('admin.reset_default'),
      description: lt('admin.ays'),
      confirmLabel: lt('admin.reset_default'),
      destructive: true,
    })
  if (!(await ask())) return
  const result = await versioned.remove((ifMatch) => resetRules(ifMatch), ask)
  if (result.status === 'saved') {
    const saved = result.result.result
    writeRules(client, saved)
    notRecorded.value = !result.result.auditRecorded
    base.value = saved
    current.value = saved
    rows.value = toRows(saved)
    outdated.value = false
    status.value = lt('success.f2b_modified')
    announce(status.value)
  } else if (result.status === 'failed') {
    resetProblem.value = result.problem
    if (!result.problem.auditRecorded) notRecorded.value = true
    // The stored rules were removed: what is stored now is read again, never reset again.
    if (result.problem.is('outcome-unknown')) void reload()
  }
}

async function reload() {
  const latest = await fetchRules()
  writeRules(client, latest)
  base.value = latest
  current.value = latest
  rows.value = toRows(latest)
  outdated.value = false
}

function reloadAfterReset() {
  resetProblem.value = null
  void reload()
}

function addRow() {
  rows.value = [...rows.value, { key: nextKey++, number: null, pattern: '' }]
}

function removeRow(key: number) {
  rows.value = rows.value.filter((row) => row.key !== key)
}

const headingId = `${id}-heading`
const regexpHeaderId = `${id}-regexp`
const panelId = `${id}-panel`
const isNotRestored = computed(
  () => isApiProblem(resetProblem.value) && resetProblem.value.is('ban-rules-not-restored'),
)
</script>

<template>
  <section
    :aria-labelledby="headingId"
    data-rules
    class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
  >
    <div class="flex flex-wrap items-center gap-2">
      <h2 :id="headingId" class="me-auto text-lg font-semibold text-gray-900 dark:text-white">
        <button
          type="button"
          class="inline-flex min-h-11 items-center gap-2 text-start"
          :aria-expanded="expanded ? 'true' : 'false'"
          :aria-controls="panelId"
          @click="expanded = !expanded"
        >
          <ChevronDownIcon class="size-5" :class="expanded ? 'rotate-180' : ''" />
          {{ lt('admin.f2b_filter') }}
        </button>
      </h2>
      <HistoryLink target-type="fail2banRules" />
    </div>
    <div v-if="expanded" :id="panelId" class="mt-3 flex flex-col gap-3">
      <LegacyText
        k="admin.f2b_regex_info"
        as="p"
        class="text-sm text-gray-600 dark:text-gray-400"
      />
      <div
        v-if="outdated"
        data-outdated
        role="alert"
        class="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
      >
        <WarningIcon class="mt-0.5 size-5 shrink-0" />
        <div class="min-w-0">
          <p class="font-semibold">{{ t('sections.outdated.title') }}</p>
          <p class="mt-1 text-sm">{{ t('sections.outdated.body') }}</p>
        </div>
      </div>
      <p
        v-if="status"
        role="status"
        data-rules-status
        class="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
      >
        {{ status }}
      </p>
      <p
        v-if="notRecorded"
        role="status"
        class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
      >
        {{ t('operations.notRecorded') }}
      </p>
      <div v-if="resetProblem" data-reset-problem class="flex flex-col items-start gap-2">
        <ProblemMessage :problem="resetProblem" />
        <button
          v-if="isNotRestored"
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          @click="reloadAfterReset"
        >
          <RestartIcon />
          {{ lt('admin.refresh') }}
        </button>
      </div>
      <ErrorSummary :id="problems.summaryId" :items="problems.summary.value" />
      <ProblemMessage :problem="problems.formProblem.value" />
      <p
        v-for="message in problems.errorsFor('rules')"
        :id="`${id}-add-error`"
        :key="message"
        class="text-sm text-red-700 dark:text-red-300"
      >
        {{ message }}
      </p>
      <div class="table-frame">
        <table class="data-table w-full table-auto text-sm">
          <thead class="text-start">
            <tr>
              <th scope="col" class="w-14 px-1 py-2 text-start">
                {{ t('operations.fail2ban.ruleId') }}
              </th>
              <th :id="regexpHeaderId" scope="col" class="px-1 py-2 text-start">
                {{ t('operations.fail2ban.ruleRegexp') }}
              </th>
              <th scope="col" class="table-controls-cell px-1 py-2">
                <span class="sr-only">{{ lt('admin.remove_row') }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in rows" :key="row.key" :data-rule="index" class="align-top">
              <td :id="`${id}-number-${row.key}`" class="px-1 py-1 text-center font-mono">
                {{ row.number ?? '+' }}
              </td>
              <td class="px-1 py-1">
                <input
                  :id="inputId(index)"
                  v-model="row.pattern"
                  type="text"
                  autocomplete="off"
                  autocapitalize="none"
                  autocorrect="off"
                  spellcheck="false"
                  :aria-labelledby="`${regexpHeaderId} ${id}-number-${row.key}`"
                  :aria-invalid="
                    problems.errorsFor(`rules.${index}`).length > 0 ? 'true' : undefined
                  "
                  :aria-describedby="
                    problems.errorsFor(`rules.${index}`).length > 0
                      ? `${inputId(index)}-error`
                      : undefined
                  "
                  class="form-control font-mono text-sm"
                />
                <div
                  v-if="problems.errorsFor(`rules.${index}`).length > 0"
                  :id="`${inputId(index)}-error`"
                  class="mt-1 text-sm text-red-700 dark:text-red-300"
                >
                  <p v-for="message in problems.errorsFor(`rules.${index}`)" :key="message">
                    {{ message }}
                  </p>
                  <PlainText
                    v-if="compilerMessages[index]"
                    :value="compilerMessages[index]"
                    as="p"
                    class="font-mono text-xs"
                  />
                </div>
              </td>
              <td class="table-controls-cell px-1 py-1">
                <RowControls
                  ><button
                    type="button"
                    :class="buttonVariants({ variant: 'outline' })"
                    :aria-describedby="`${id}-number-${row.key}`"
                    @click="removeRow(row.key)"
                  >
                    {{ lt('admin.remove_row') }}
                  </button></RowControls
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex flex-wrap gap-2">
        <template v-if="outdated">
          <button
            type="button"
            :class="buttonVariants({ variant: 'outline' })"
            :disabled="versioned.pending.value"
            @click="discard"
          >
            {{ t('sections.discard') }}
          </button>
          <button
            type="button"
            :class="buttonVariants({ variant: 'default' })"
            :disabled="versioned.pending.value"
            @click="save"
          >
            {{ t('sections.saveAgain') }}
          </button>
        </template>
        <button
          v-else
          type="button"
          :class="buttonVariants({ variant: 'default' })"
          :disabled="versioned.pending.value"
          @click="save"
        >
          {{ lt('admin.save') }}
        </button>
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          :disabled="versioned.pending.value"
          @click="reset"
        >
          {{ lt('admin.reset_default') }}
        </button>
        <button
          :id="`${id}-add`"
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          @click="addRow"
        >
          <PlusIcon />
          {{ lt('admin.add_row') }}
        </button>
      </div>
    </div>
  </section>
</template>
