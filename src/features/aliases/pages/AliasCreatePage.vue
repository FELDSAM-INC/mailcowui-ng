<script setup lang="ts">
// "Add alias" (US2, FR-018 to FR-025), the classic `#addAliasModal` as a full-screen form, in its
// order and with its texts: alias addresses, goto addresses with the three goto checkboxes, SOGo
// visible (only with the groupware), internal, allowed to send, active, "Add". It waits for the
// capabilities (FR-071). Every address is one request, one after another (research R9): one
// created address opens the new alias with legacy's `success.alias_added`; several show a result
// per address, and the refused and unprocessed ones stay in the field. Refusals use legacy's
// messages at their fields (legacy form map part 2). The input survives a session expiry in this
// tab (research R10), and leaving with input asks first.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import type { Alias, AliasCapabilities, ApiProblem } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import { lt, text } from '@/i18n'
import { useProblemMessages } from '@/i18n/problems'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import EntryListField from '@/shared/components/EntryListField.vue'
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
import { isCatchAll, joinEntries, parseEntryList } from '@/shared/validation/entry-list'

import {
  classifyAliasRefusal,
  createFormDefaults,
  toCreateRequest,
  type AliasCreateForm,
} from '../alias-form'
import { CapabilitiesGate, feature004Permissions } from '@/features/aliases-common'

import { createAlias } from '../api'
import AliasCreateResults from '../components/AliasCreateResults.vue'
import AliasOptionsFields from '../components/AliasOptionsFields.vue'
import DestinationField from '../components/DestinationField.vue'
import { setAliasFlash } from '../flash'

const ADDRESSES_ID = 'alias-addresses'
const GOTO_ID = 'alias-goto'

const { t } = useI18n()
const router = useRouter()
const queryClient = useQueryClient()
const identity = useIdentityQuery()
const { problemMessage, violationMessageIn } = useProblemMessages()

useStickyBarFocus()

const form = ref<AliasCreateForm>(createFormDefaults())
const run = useSequentialCreate<Alias>()
const results = ref<EntryResult<Alias>[] | null>(null)
/** The request being answered, for the values its field errors name. */
const sent = ref<{ address: string; destinations: string[] }>({ address: '', destinations: [] })

const problems = useProblemForm({
  formKey: 'aliases.form',
  fieldId: (path) =>
    path === 'address' ? ADDRESSES_ID : path.split('.')[0] === 'destinations' ? GOTO_ID : null,
  valueAt: (path) => {
    if (path === 'address') return sent.value.address
    const match = /^destinations\.(\d+)$/.exec(path)
    return match ? sent.value.destinations[Number(match[1])] : undefined
  },
  problemFields: { 'address-in-use': 'address', 'domain-alias-limit-reached': 'address' },
  problemParams: () => ({ address: sent.value.address }),
})

const entryCount = computed(() => parseEntryList(form.value.destinationsText).length)
const gotoEntryErrors = computed(() => {
  const errors: Record<number, string[]> = {}
  for (let index = 0; index < entryCount.value; index += 1) {
    const messages = problems.errorsFor(`destinations.${index}`)
    if (messages.length > 0) errors[index] = messages
  }
  return errors
})

const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(createFormDefaults()))
const guard = useLeaveGuard(dirty, { messageKey: 'leaveGuard.body' })
const draft = useFormDraft('alias-create', {
  capture: () => ({ ...form.value }),
  restore: (value: AliasCreateForm) => {
    form.value = { ...createFormDefaults(), ...value }
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

function update<K extends keyof AliasCreateForm>(key: K, value: AliasCreateForm[K]) {
  form.value = { ...form.value, [key]: value }
}

/** The client checks of FR-019, as input aids; the server decides everything else. */
function check(capabilities: AliasCapabilities): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  if (parseEntryList(form.value.addressesText).length === 0) {
    errors.address = [text('aliases.form.errors.address.required')]
  }
  if (form.value.gotoAction === 'none') {
    const destinations = parseEntryList(form.value.destinationsText).map((entry) => entry.value)
    if (destinations.length === 0) {
      errors.destinations = [text('aliases.form.errors.destinations.required')]
    } else if (destinations.join(',').length > capabilities.destinationsMaxLength) {
      errors.destinations = [t('validation.tooLong', { max: capabilities.destinationsMaxLength })]
    }
  }
  return errors
}

/** `attribute-not-permitted` names the refused destinations: legacy's message on each entry. */
function attributeErrors(problem: ApiProblem): Record<string, string[]> | null {
  if (!problem.is('attribute-not-permitted')) return null
  const attributes = problem.extensions.attributes
  if (!Array.isArray(attributes)) return null
  const errors: Record<string, string[]> = {}
  for (const path of attributes.map(String)) {
    const match = /^destinations\.(\d+)$/.exec(path)
    if (!match) continue
    errors[path] = [
      text('aliases.form.errors.destinations.attributeNotPermitted', {
        entry: sent.value.destinations[Number(match[1])],
      }),
    ]
  }
  return Object.keys(errors).length > 0 ? errors : null
}

async function show(problem: ApiProblem) {
  const entries = attributeErrors(problem)
  if (entries) await problems.setClientMessages(entries)
  else await problems.setProblem(problem)
}

/** The message of a refused address in the results (legacy's message with the address). */
function refusalMessage(result: EntryResult<Alias>): string {
  const problem = result.problem
  if (!problem) return ''
  const violation = problem.fieldErrors.get('address')?.[0]
  if (violation) {
    return violationMessageIn(violation, {
      formKey: 'aliases.form',
      path: 'address',
      valueAt: () => result.entry.value,
    })
  }
  return problemMessage(problem, { params: { address: result.entry.value } })
}

async function submit(capabilities: AliasCapabilities) {
  if (run.running.value) return
  results.value = null
  const errors = check(capabilities)
  if (Object.keys(errors).length > 0) {
    await problems.setClientMessages(errors)
    return
  }
  problems.clear()
  const entries = parseEntryList(form.value.addressesText)
  const options = { groupwareEnabled: capabilities.groupwareEnabled }
  const outcome = await run.run(
    entries,
    (entry) => {
      const body = toCreateRequest(form.value, entry.value, options)
      sent.value = { address: entry.value, destinations: body.destinations ?? [] }
      return createAlias(queryClient, body)
    },
    classifyAliasRefusal,
  )

  if (entries.length === 1) {
    const [only] = outcome
    if (only?.outcome === 'created' && only.data) {
      const message = lt('success.alias_added', only.data.address, only.data.id)
      setAliasFlash(only.data.id, message)
      announce(message)
      draft.clear()
      guard.disarm()
      await router.push({ name: 'alias-detail', params: { aliasId: only.data.id } })
      return
    }
    const problem = only?.problem ?? run.stopProblem.value
    if (problem) await show(problem)
    return
  }

  results.value = outcome
  const kept = outcome.filter((result) => result.outcome !== 'created')
  update('addressesText', joinEntries(kept.map((result) => result.entry.value)))
  if (kept.length === 0) draft.clear()
  const stop = run.stopProblem.value
  if (stop) {
    const stopped = outcome.find((result) => result.problem === stop)
    if (stopped) sent.value = { ...sent.value, address: stopped.entry.value }
    await show(stop)
  }
}

const permissions = computed(
  () => (capabilities: AliasCapabilities) =>
    feature004Permissions(identity.data.value, capabilities),
)
const catchAll = (value: string) => (isCatchAll(value) ? lt('mailbox.catch_all') : null)
const retryable = computed(() => problems.formProblem.value?.kind === 'network')
</script>

<template>
  <section class="mx-auto flex w-full max-w-3xl flex-col gap-4">
    <PageHeader :title="lt('mailbox.add_alias')" />
    <CapabilitiesGate v-slot="{ capabilities }">
      <AliasCreateResults
        v-if="results"
        :key="results.map((result) => result.entry.value).join()"
        :results="results"
        :message="refusalMessage"
      />
      <form
        data-alias-form
        class="flex min-w-0 flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
        novalidate
        @submit.prevent="submit(capabilities)"
      >
        <ErrorSummary :id="problems.summaryId" :items="problems.summary.value" />
        <ProblemMessage
          :problem="problems.formProblem.value"
          :retry="retryable"
          @retry="submit(capabilities)"
        />
        <EntryListField
          :id="ADDRESSES_ID"
          :model-value="form.addressesText"
          :errors="problems.errorsFor('address')"
          :marker="catchAll"
          @update:model-value="update('addressesText', $event)"
        >
          <template #label>{{ lt('add.alias_address') }}</template>
          <template #help><LegacyText k="add.alias_address_info" /></template>
        </EntryListField>
        <DestinationField
          :id="GOTO_ID"
          label-key="add.target_address"
          help-key="add.target_address_info"
          :destinations-text="form.destinationsText"
          :goto-action="form.gotoAction"
          :restricted="permissions(capabilities).externalDestinationsRestricted"
          :errors="problems.errorsFor('destinations')"
          :entry-errors="gotoEntryErrors"
          @update:destinations-text="update('destinationsText', $event)"
          @update:goto-action="update('gotoAction', $event)"
        />
        <hr class="border-gray-200 dark:border-gray-800" />
        <AliasOptionsFields
          id-prefix="alias-create"
          mode="add"
          :groupware-enabled="capabilities.groupwareEnabled"
          :groupware-visible="form.groupwareVisible"
          :internal="form.internal"
          :sender-allowed="form.senderAllowed"
          @update:groupware-visible="update('groupwareVisible', $event)"
          @update:internal="update('internal', $event)"
          @update:sender-allowed="update('senderAllowed', $event)"
        />
        <label class="inline-flex min-h-11 items-center gap-3 text-gray-800 dark:text-gray-200">
          <input
            id="alias-create-active"
            type="checkbox"
            class="size-5 accent-accent"
            :checked="form.active"
            @change="update('active', ($event.target as HTMLInputElement).checked)"
          />
          {{ lt('add.active') }}
        </label>
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
