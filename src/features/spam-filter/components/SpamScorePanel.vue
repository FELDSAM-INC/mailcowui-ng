<script setup lang="ts">
// The spam score of a mailbox (UI 006 US4, US5-AS4, FR-042 to FR-044; legacy form map screen 5 and
// D5): under legacy's heading `user.spamfilter_behavior`, the two decimal fields "Junk folder from"
// and "Reject from" (tenths, in the user's number format) replace legacy's two-handle slider; below
// them legacy's three zones with their ranges, which follow the typed values as legacy's follow the
// slider; then the server defaults the API adds (D17), and legacy's "Save changes" and "Reset to
// server default" (no confirmation, D13). A junk value above the reject value, or a value outside
// the capabilities' range, is refused before sending. A save refused as outdated keeps the typed
// values, lists the values saved meanwhile, and offers "Save again" or "Discard my changes"; a
// refused reset reloads the score and is pressed again. Without the right to change the score, the
// values are text with legacy's "Prohibited by ACL" note.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, reactive, ref, shallowRef, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { problemOf, type ApiProblem, type FieldViolation, type SpamScore } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import { canChangeSpamScore, missingFlag, useQuarantineCapabilities } from '@/features/quarantine'
import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import { DEFAULT_LOCALE, isAppLocale } from '@/i18n/locales'
import { fromTenths, toTenths } from '@/i18n/parse'
import { useProblemMessages } from '@/i18n/problems'
import AclReadOnlyNote from '@/shared/components/AclReadOnlyNote.vue'
import type { SectionChange } from '@/shared/components/editable-section'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import LocaleNumberField from '@/shared/components/LocaleNumberField.vue'
import OutcomeAlert from '@/shared/components/OutcomeAlert.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { changedSince, useVersionedSave } from '@/shared/composables/useVersionedSave'
import { WarningIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { resetSpamScore, setSpamScore, useSpamScore } from '../api'
import { validatePair, type ScoreField } from '../spam-score'
import ScoreBand from './ScoreBand.vue'

const props = withDefaults(
  defineProps<{
    mailbox: string
    headingLevel?: 2 | 3
    /** The History of the spam score (administrators). */
    history?: boolean
  }>(),
  { headingLevel: 2, history: false },
)

const { t, locale } = useI18n()
const { violationMessageIn } = useProblemMessages()
const client = useQueryClient()
const identity = useIdentityQuery()
const capabilities = useQuarantineCapabilities()
const query = useSpamScore(() => props.mailbox)
const score = computed(() => query.data.value)

const uid = useId()
const headingId = `spam-score-${uid}-title`
const formId = `spam-score-${uid}-form`
const fieldId: Record<ScoreField, string> = {
  junkScore: `spam-score-${uid}-junk`,
  rejectScore: `spam-score-${uid}-reject`,
}
const LABEL_KEY: Record<ScoreField, string> = {
  junkScore: 'spamFilter.score.junkScore',
  rejectScore: 'spamFilter.score.rejectScore',
}
const labelFor = (field: string) => (field in LABEL_KEY ? t(LABEL_KEY[field as ScoreField]) : field)

const canChange = computed(() => canChangeSpamScore(identity.data.value, props.mailbox))
const deniedBy = computed(() => missingFlag(identity.data.value, 'changeSpamScore'))

/** The score the form was filled from; its version tag goes with the save. */
const base = shallowRef<SpamScore | null>(null)
const junk = ref<number | null>(null)
const reject = ref<number | null>(null)
const valid = reactive<Record<ScoreField, boolean>>({ junkScore: true, rejectScore: true })
const errors = ref<Record<ScoreField, string[]>>({ junkScore: [], rejectScore: [] })
const outdated = shallowRef<SectionChange[] | null>(null)
const status = ref<{ id: number; message: string } | null>(null)
const problem = shallowRef<ApiProblem | null>(null)
const resetting = ref(false)
let statuses = 0

const versioned = useVersionedSave<SpamScore>({
  current: () => base.value,
  refetch: async () => (await query.refetch()).data,
})
const busy = computed(() => versioned.pending.value || resetting.value)

function fill(value: SpamScore) {
  base.value = value
  junk.value = toTenths(value.junkScore)
  reject.value = toTenths(value.rejectScore)
  valid.junkScore = true
  valid.rejectScore = true
}

const dirty = computed(
  () =>
    !!base.value &&
    (junk.value !== toTenths(base.value.junkScore) ||
      reject.value !== toTenths(base.value.rejectScore)),
)

// A score read or reloaded while nothing is typed fills the fields.
watch(
  score,
  (value) => {
    if (value && !busy.value && (!dirty.value || !base.value)) fill(value)
  },
  { immediate: true },
)

useLeaveGuard(() => canChange.value && dirty.value, { messageKey: 'leaveGuard.body' })

const shownJunk = computed(() => junk.value ?? toTenths(score.value?.junkScore ?? 0))
const shownReject = computed(() => reject.value ?? toTenths(score.value?.rejectScore ?? 0))
const appLocale = computed(() => (isAppLocale(locale.value) ? locale.value : DEFAULT_LOCALE))
const number = (value: number) => formatNumber(value, appLocale.value, { maximumFractionDigits: 1 })

function report(message: string) {
  statuses += 1
  status.value = { id: statuses, message }
}

function clearMessages() {
  status.value = null
  problem.value = null
  errors.value = { junkScore: [], rejectScore: [] }
}

function showViolations(byField: Partial<Record<string, FieldViolation[]>>) {
  const next: Record<ScoreField, string[]> = { junkScore: [], rejectScore: [] }
  for (const field of ['junkScore', 'rejectScore'] as const) {
    next[field] = (byField[field] ?? []).map((violation) =>
      violationMessageIn(violation, { labelFor }),
    )
  }
  errors.value = next
  const first = (['junkScore', 'rejectScore'] as const).find((field) => next[field].length > 0)
  if (first) document.getElementById(fieldId[first])?.focus()
}

async function save() {
  if (busy.value || !base.value) return
  clearMessages()
  const range = capabilities.data.value?.spamScore
  if (!valid.junkScore || !valid.rejectScore || junk.value === null || reject.value === null) {
    const first = !valid.junkScore || junk.value === null ? 'junkScore' : 'rejectScore'
    document.getElementById(fieldId[first])?.focus()
    return
  }
  if (!range) return
  const violations = validatePair(junk.value, reject.value, range)
  if (violations.length > 0) {
    const byField: Partial<Record<string, FieldViolation[]>> = {}
    for (const violation of violations) {
      ;(byField[violation.field] ??= []).push({
        code: violation.code,
        message: '',
        params: violation.params,
      })
    }
    showViolations(byField)
    return
  }
  const from = base.value
  const result = await versioned.save(
    { junkScore: fromTenths(junk.value), rejectScore: fromTenths(reject.value) },
    (body, ifMatch) => setSpamScore(client, props.mailbox, body, ifMatch),
  )
  if (result.status === 'saved') {
    outdated.value = null
    fill(result.result)
    report(lt('success.mailbox_modified', props.mailbox))
  } else if (result.status === 'outdated') {
    const latest = result.latest ?? from
    outdated.value = changedSince(from, latest, ['junkScore', 'rejectScore'] as const).map(
      (change) => ({
        field: change.field,
        label: labelFor(change.field),
        saved: number(change.savedValue),
      }),
    )
    base.value = latest
  } else if (result.status === 'failed') {
    if (result.problem.status === 422 && result.problem.fieldErrors.size > 0) {
      showViolations(Object.fromEntries(result.problem.fieldErrors))
    } else problem.value = result.problem
  }
}

function discard() {
  const latest = score.value ?? base.value
  outdated.value = null
  clearMessages()
  if (latest) fill(latest)
}

async function reset() {
  const current = score.value
  if (busy.value || !current) return
  clearMessages()
  outdated.value = null
  resetting.value = true
  try {
    await resetSpamScore(client, props.mailbox, current.etag)
    const fresh = (await query.refetch()).data
    if (fresh) fill(fresh)
    report(lt('success.mailbox_modified', props.mailbox))
  } catch (error) {
    const failure = problemOf(error)!
    if (failure.status === 412) {
      const latest = (await query.refetch()).data
      if (latest) fill(latest)
    }
    problem.value = failure
  } finally {
    resetting.value = false
  }
}

const BUTTON_TEXT = 'h-auto min-h-11 max-w-full whitespace-normal text-start'
</script>

<template>
  <section :aria-labelledby="headingId" data-spam-score class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-2">
      <component
        :is="`h${headingLevel}`"
        :id="headingId"
        tabindex="-1"
        class="me-auto font-semibold text-gray-900 focus:outline-none dark:text-white"
        :class="headingLevel === 2 ? 'text-lg' : 'text-base'"
      >
        {{ lt('user.spamfilter_behavior') }}
      </component>
      <HistoryLink v-if="history" target-type="spamScore" :target-id="mailbox" />
    </div>

    <p
      v-if="!score && query.isPending.value"
      role="status"
      class="text-sm text-gray-600 dark:text-gray-400"
    >
      {{ lt('datatables.loadingRecords') }}
    </p>
    <ProblemMessage
      v-else-if="!score"
      :problem="problemOf(query.error.value)"
      retry
      @retry="query.refetch()"
    />
    <template v-else>
      <AclReadOnlyNote
        v-if="!canChange && deniedBy"
        :id="`spam-score-${uid}-acl`"
        :flag="deniedBy"
      />
      <OutcomeAlert
        v-if="status"
        :key="status.id"
        :message="status.message"
        @dismiss="status = null"
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
          <ul class="mt-2 list-disc ps-5 text-sm">
            <li v-for="change in outdated" :key="change.field" class="break-words">
              {{ t('sections.outdated.savedAs', { field: change.label, value: change.saved }) }}
            </li>
          </ul>
        </div>
      </div>

      <form
        v-if="canChange"
        :id="formId"
        novalidate
        class="grid gap-4 sm:grid-cols-2"
        @submit.prevent="save"
      >
        <LocaleNumberField
          :id="fieldId.junkScore"
          v-model="junk"
          :label="t('spamFilter.score.junkScore')"
          :errors="errors.junkScore"
          required
          @update:valid="valid.junkScore = $event"
        />
        <LocaleNumberField
          :id="fieldId.rejectScore"
          v-model="reject"
          :label="t('spamFilter.score.rejectScore')"
          :errors="errors.rejectScore"
          required
          @update:valid="valid.rejectScore = $event"
        />
      </form>
      <dl v-else data-score-values class="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt class="font-medium text-gray-700 dark:text-gray-300">
            {{ t('spamFilter.score.junkScore') }}
          </dt>
          <dd class="text-gray-900 tabular-nums dark:text-white">{{ number(score.junkScore) }}</dd>
        </div>
        <div>
          <dt class="font-medium text-gray-700 dark:text-gray-300">
            {{ t('spamFilter.score.rejectScore') }}
          </dt>
          <dd class="text-gray-900 tabular-nums dark:text-white">
            {{ number(score.rejectScore) }}
          </dd>
        </div>
      </dl>

      <ScoreBand :junk="shownJunk" :reject="shownReject" />

      <div data-score-defaults class="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
        <p class="font-medium text-gray-900 dark:text-white">
          {{ lt('user.spamfilter_default_score') }}
        </p>
        <dl class="flex flex-wrap gap-x-6 gap-y-1">
          <div class="flex gap-2">
            <dt>{{ t('spamFilter.score.junkScore') }}</dt>
            <dd class="font-medium tabular-nums">{{ number(score.defaults.junkScore) }}</dd>
          </div>
          <div class="flex gap-2">
            <dt>{{ t('spamFilter.score.rejectScore') }}</dt>
            <dd class="font-medium tabular-nums">{{ number(score.defaults.rejectScore) }}</dd>
          </div>
        </dl>
        <p v-if="!score.custom" data-using-defaults>{{ t('spamFilter.score.usingDefaults') }}</p>
        <p v-if="score.defaults.fallback" data-fallback>{{ t('spamFilter.score.fallback') }}</p>
      </div>

      <ProblemMessage v-if="problem" :problem="problem" />

      <div v-if="canChange" class="flex flex-wrap gap-2">
        <template v-if="outdated">
          <button
            type="button"
            :class="buttonVariants({ variant: 'outline', class: BUTTON_TEXT })"
            :disabled="busy"
            @click="discard"
          >
            {{ t('sections.discard') }}
          </button>
          <button
            type="submit"
            :form="formId"
            :class="buttonVariants({ variant: 'default', class: BUTTON_TEXT })"
            :disabled="busy"
          >
            {{ t('sections.saveAgain') }}
          </button>
        </template>
        <template v-else>
          <button
            type="submit"
            :form="formId"
            data-save
            :class="buttonVariants({ variant: 'default', class: BUTTON_TEXT })"
            :disabled="busy"
          >
            {{ versioned.pending.value ? t('sections.saving') : lt('user.save_changes') }}
          </button>
          <button
            type="button"
            data-reset
            :class="buttonVariants({ variant: 'outline', class: BUTTON_TEXT })"
            :disabled="busy"
            @click="reset"
          >
            {{ lt('user.spam_score_reset') }}
          </button>
        </template>
      </div>
    </template>
  </section>
</template>
