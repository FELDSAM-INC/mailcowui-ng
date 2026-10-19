<script setup lang="ts">
// Adding a pattern to the Allowlist or the Denylist (UI 006 FR-048, FR-049, US4-AS6, US4-AS7;
// legacy form map screen 5): legacy's field with the placeholder `*@example.org` and its "Add item"
// button. The pattern is trimmed and lower-cased, then checked against the capabilities' rules
// before anything is sent; legacy's messages say what is wrong (`danger.policy_list_from_invalid`,
// `danger.policy_list_from_exists`, D6), on the field. After a creation the field is emptied and
// focused for the next entry, and the list shows legacy's success alert.
import { useQueryClient } from '@tanstack/vue-query'
import { nextTick, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { problemOf, type ApiProblem, type SpamPolicyEntry, type SpamPolicyList } from '@/api'
import { lt, text } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import { useProblemMessages } from '@/i18n/problems'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { PlusIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { createEntry } from '../api'
import type { PolicyOwner } from '../owner'
import { normalisePattern, patternError, type SenderPatternRules } from '../pattern'

const props = defineProps<{
  owner: PolicyOwner
  list: SpamPolicyList
  rules: SenderPatternRules | undefined
  /** The ID of the list's heading, which names the field together with the button. */
  headingId: string
  inputId: string
}>()
const emit = defineEmits<{ added: [entry: SpamPolicyEntry] }>()

const { t, locale } = useI18n()
const { problemMessage, violationMessage } = useProblemMessages()
const client = useQueryClient()

const value = ref('')
const error = ref<string | null>(null)
const problem = shallowRef<ApiProblem | null>(null)
const pending = ref(false)
const input = ref<HTMLInputElement | null>(null)
const buttonId = `${props.inputId}-add`
const errorId = `${props.inputId}-error`

function ruleMessage(rule: NonNullable<ReturnType<typeof patternError>>): string {
  switch (rule) {
    case 'required':
      return t('validation.required')
    case 'invalidFormat':
      return text('validation.format.senderPattern')
    case 'tooLong':
      return t('validation.tooLong', {
        max: formatNumber(props.rules?.maxLength ?? 0, locale.value as AppLocale),
      })
  }
}

function refuse(message: string) {
  error.value = message
  input.value?.focus()
}

async function submit() {
  if (pending.value || !props.rules) return
  error.value = null
  problem.value = null
  const pattern = normalisePattern(value.value)
  const rule = patternError(pattern, props.rules)
  if (rule) {
    refuse(ruleMessage(rule))
    return
  }
  pending.value = true
  try {
    const entry = await createEntry(client, props.owner, { list: props.list, pattern })
    value.value = ''
    emit('added', entry)
    await nextTick()
    input.value?.focus()
  } catch (caught) {
    const failure = problemOf(caught)!
    const violations = failure.fieldErrors.get('pattern')
    if (failure.is('spam-policy-entry-exists')) refuse(problemMessage(failure))
    else if (failure.status === 422 && violations?.length) {
      refuse(violations.map((violation) => violationMessage(violation)).join(' '))
    } else problem.value = failure
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <form novalidate class="flex flex-col gap-2" data-add-entry @submit.prevent="submit">
    <div class="flex gap-2">
      <input
        :id="inputId"
        ref="input"
        v-model="value"
        type="text"
        inputmode="email"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        :placeholder="t('spamFilter.lists.patternPlaceholder')"
        :aria-labelledby="`${headingId} ${buttonId}`"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error ? errorId : undefined"
        class="h-11 w-full min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
      />
      <button
        :id="buttonId"
        type="submit"
        :class="buttonVariants({ variant: 'outline', class: 'shrink-0' })"
        :disabled="pending || !rules"
      >
        <PlusIcon />
        {{ lt('user.spamfilter_table_add') }}
      </button>
    </div>
    <p
      v-if="error"
      :id="errorId"
      role="alert"
      data-field-error
      class="text-sm break-words text-red-700 dark:text-red-400"
    >
      {{ error }}
    </p>
    <ProblemMessage v-if="problem" :problem="problem" />
  </form>
</template>
