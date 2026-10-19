<script setup lang="ts">
// "Add domain alias" (US4, FR-036 to FR-041), the classic `#addAliasDomainModal` as a full-screen
// form, in its order and with its texts: alias domains (textarea with its help), target domain
// (relay domains disabled with legacy's reason), active, then the rate limit (only with
// `ratelimit`), the DKIM selector prefilled with the server default (emptied, no key, as in legacy)
// and the key length, "Add". It waits for the capabilities (FR-071). Without `aliasDomains` it says
// "no access". Every name is one request, one after another (research R9): one created name opens
// the new alias domain with legacy's alerts; several show a result per name, and the refused and
// unprocessed ones stay in the field. Refusals use legacy's messages at their fields. The input
// survives a session expiry in this tab (research R10), and leaving with input asks first.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import type { ApiProblem } from '@/api'
import NoAccessState from '@/app/states/NoAccessState.vue'
import { useIdentityQuery } from '@/app/session/queries'
import { CapabilitiesGate, feature004Permissions, useAliasesCapabilities } from '@/features/aliases'
import { lt } from '@/i18n'
import { useProblemMessages } from '@/i18n/problems'
import DkimFields from '@/shared/components/DkimFields.vue'
import EntryListField from '@/shared/components/EntryListField.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import LegacyRateLimitField from '@/shared/components/LegacyRateLimitField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useFormDraft } from '@/shared/composables/useFormDraft'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useSequentialCreate, type EntryResult } from '@/shared/composables/useSequentialCreate'
import { useStickyBarFocus } from '@/shared/composables/useStickyBarFocus'
import { buttonVariants } from '@/shared/ui/button'
import { joinEntries, parseEntryList } from '@/shared/validation/entry-list'

import {
  classifyAliasDomainRefusal,
  createFormDefaults,
  toCreateRequest,
  type AliasDomainCreateForm,
} from '../alias-domain-form'
import { createAliasDomain, type CreatedAliasDomain } from '../api'
import AliasDomainCreateResults from '../components/AliasDomainCreateResults.vue'
import TargetDomainField from '../components/TargetDomainField.vue'
import { creationAlerts } from '../creation-report'
import { setCreationFlash } from '../flash'

const ID = 'alias-domain'
const NAMES_ID = `${ID}-names`
const TARGET_ID = `${ID}-targetDomain`

useStickyBarFocus()

const { t } = useI18n()
const router = useRouter()
const queryClient = useQueryClient()
const identity = useIdentityQuery()
const capabilitiesQuery = useAliasesCapabilities()
const { problemMessage, violationMessageIn } = useProblemMessages()

const form = ref<AliasDomainCreateForm>(createFormDefaults(null))
const initial = ref<string>(JSON.stringify(form.value))
const labels = ref<Record<string, string>>({})
const run = useSequentialCreate<CreatedAliasDomain>()
const results = ref<EntryResult<CreatedAliasDomain>[] | null>(null)
/** The request being answered, for the values its field errors name. */
const sent = ref<{ name: string; targetDomain: string }>({ name: '', targetDomain: '' })

const problems = useProblemForm({
  formKey: 'aliasDomains.form',
  fieldId: (path) => {
    const field = path.split('.')[0]
    if (field === 'name') return NAMES_ID
    if (field === 'targetDomain') return TARGET_ID
    if (field === 'rateLimit') return `${ID}-rateLimit-value`
    if (field === 'dkimSelector') return `${ID}-dkimSelector`
    if (field === 'dkimKeySize') return `${ID}-dkimKeySize`
    return null
  },
  valueAt: (path) =>
    path === 'name'
      ? sent.value.name
      : path === 'targetDomain'
        ? sent.value.targetDomain
        : undefined,
  problemFields: { 'alias-domain-already-exists': 'name' },
  problemParams: () => ({ name: sent.value.name }),
})

const dirty = computed(() => JSON.stringify(form.value) !== initial.value)

// The DKIM fields start from the server's defaults once the capabilities are read.
watch(
  () => capabilitiesQuery.data.value?.dkimDefaults,
  (defaults) => {
    if (!defaults || dirty.value) return
    form.value = createFormDefaults(defaults)
    initial.value = JSON.stringify(form.value)
  },
  { immediate: true },
)
const guard = useLeaveGuard(dirty, { messageKey: 'leaveGuard.body' })
const draft = useFormDraft('alias-domain-create', {
  capture: () => ({ ...form.value }),
  restore: (value: AliasDomainCreateForm) => {
    form.value = { ...form.value, ...value }
  },
  dirty: () => dirty.value,
})

watch(
  () => run.current.value,
  (current) => {
    if (current > 0 && run.total.value > 1) {
      announce(t('aliases.create.progress', { current, total: run.total.value }))
    } else if (current > 0) announce(t('sections.saving'))
  },
)

function update<K extends keyof AliasDomainCreateForm>(key: K, value: AliasDomainCreateForm[K]) {
  form.value = { ...form.value, [key]: value }
}

/** The client checks, as input aids; the server decides everything else. */
function check(): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  if (parseEntryList(form.value.namesText).length === 0) {
    errors.name = [t('validation.required')]
  }
  if (!form.value.targetDomain) errors.targetDomain = [t('validation.required')]
  const value = form.value.rateLimitValue.trim()
  if (value !== '' && !/^[1-9]\d*$/.test(value)) {
    errors.rateLimit = [t('validation.invalidFormat')]
  }
  return errors
}

/** The message of a refused name in the results (legacy's message with the name). */
function refusalMessage(result: EntryResult<CreatedAliasDomain>): string {
  const problem = result.problem
  if (!problem) return ''
  const violation = problem.fieldErrors.get('name')?.[0]
  if (violation) {
    return violationMessageIn(violation, {
      formKey: 'aliasDomains.form',
      path: 'name',
      valueAt: () => result.entry.value,
    })
  }
  return problemMessage(problem, { params: { name: result.entry.value } })
}

async function show(problem: ApiProblem) {
  await problems.setProblem(problem)
}

async function submit(canSetRateLimit: boolean) {
  if (run.running.value) return
  results.value = null
  const errors = check()
  if (Object.keys(errors).length > 0) {
    await problems.setClientMessages(errors)
    return
  }
  problems.clear()
  const entries = parseEntryList(form.value.namesText)
  const outcome = await run.run(
    entries,
    (entry) => {
      const body = toCreateRequest(form.value, entry.value, { canSetRateLimit })
      sent.value = { name: entry.value, targetDomain: body.targetDomain }
      return createAliasDomain(queryClient, body)
    },
    classifyAliasDomainRefusal,
  )

  if (entries.length === 1) {
    const [only] = outcome
    if (only?.outcome === 'created' && only.data) {
      const { aliasDomain, report } = only.data
      setCreationFlash(aliasDomain.name, creationAlerts(aliasDomain.name, report))
      draft.clear()
      guard.disarm()
      await router.push({ name: 'alias-domain-detail', params: { aliasDomain: aliasDomain.name } })
      return
    }
    const problem = only?.problem ?? run.stopProblem.value
    if (problem) await show(problem)
    return
  }

  results.value = outcome
  const kept = outcome.filter((result) => result.outcome !== 'created')
  update('namesText', joinEntries(kept.map((result) => result.entry.value)))
  if (kept.length === 0) draft.clear()
  const stop = run.stopProblem.value
  if (stop) {
    const stopped = outcome.find((result) => result.problem === stop)
    if (stopped) sent.value = { ...sent.value, name: stopped.entry.value }
    await show(stop)
  }
}

const permissions = computed(() =>
  feature004Permissions(identity.data.value, capabilitiesQuery.data.value),
)
const retryable = computed(() => problems.formProblem.value?.kind === 'network')
</script>

<template>
  <NoAccessState v-if="identity.data.value && !permissions.canAddAliasDomain" data-no-access />
  <section v-else class="mx-auto flex w-full max-w-3xl flex-col gap-4">
    <PageHeader :title="lt('mailbox.add_domain_alias')" />
    <CapabilitiesGate v-slot="{ capabilities }">
      <AliasDomainCreateResults
        v-if="results"
        :key="results.map((result) => result.entry.value).join()"
        :results="results"
        :message="refusalMessage"
      />
      <form
        data-alias-domain-form
        class="flex min-w-0 flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
        novalidate
        @submit.prevent="submit(permissions.canSetInitialRateLimit)"
      >
        <ErrorSummary :id="problems.summaryId" :items="problems.summary.value" />
        <ProblemMessage
          :problem="problems.formProblem.value"
          :retry="retryable"
          @retry="submit(permissions.canSetInitialRateLimit)"
        />
        <EntryListField
          :id="NAMES_ID"
          :model-value="form.namesText"
          :errors="problems.errorsFor('name')"
          @update:model-value="update('namesText', $event)"
        >
          <template #label>{{ lt('add.alias_domain') }}</template>
          <template #help><LegacyText k="add.alias_domain_info" /></template>
        </EntryListField>
        <TargetDomainField
          :id="TARGET_ID"
          label-key="add.target_domain"
          :model-value="form.targetDomain"
          :labels="labels"
          :errors="problems.errorsFor('targetDomain')"
          @pick="labels = { ...labels, [$event.name]: $event.nameUnicode }"
          @update:model-value="update('targetDomain', $event)"
        />
        <label class="inline-flex min-h-11 items-center gap-3 text-gray-800 dark:text-gray-200">
          <input
            :id="`${ID}-active`"
            type="checkbox"
            class="size-5 accent-brand-500"
            :checked="form.active"
            @change="update('active', ($event.target as HTMLInputElement).checked)"
          />
          {{ lt('add.active') }}
        </label>
        <template v-if="permissions.canSetInitialRateLimit">
          <hr class="border-gray-200 dark:border-gray-800" />
          <LegacyRateLimitField
            :id-prefix="`${ID}-rateLimit`"
            label-key="acl.ratelimit"
            :value="form.rateLimitValue"
            :frame="form.rateLimitFrame"
            :frames="capabilities.rateLimitFrames"
            :errors="problems.errorsFor('rateLimit')"
            @update:value="update('rateLimitValue', $event)"
            @update:frame="update('rateLimitFrame', $event)"
          />
        </template>
        <hr class="border-gray-200 dark:border-gray-800" />
        <DkimFields
          :id-prefix="ID"
          :selector="form.dkimSelector"
          :key-size="form.dkimKeySize"
          :key-sizes="capabilities.dkimKeySizes"
          :selector-errors="problems.errorsFor('dkimSelector')"
          :key-size-errors="problems.errorsFor('dkimKeySize')"
          @update:selector="update('dkimSelector', $event)"
          @update:key-size="update('dkimKeySize', $event)"
        />
        <div
          data-sticky-save
          class="sticky bottom-0 z-10 -mx-4 flex flex-wrap gap-3 border-t border-gray-200 bg-white/95 px-4 py-3 sm:-mx-5 sm:px-5 dark:border-gray-800 dark:bg-gray-900/95"
        >
          <button
            type="submit"
            :class="buttonVariants({ variant: 'default' })"
            :disabled="run.running.value"
            :aria-busy="run.running.value ? 'true' : 'false'"
          >
            {{ lt('admin.add') }}
          </button>
        </div>
      </form>
    </CapabilitiesGate>
  </section>
</template>
