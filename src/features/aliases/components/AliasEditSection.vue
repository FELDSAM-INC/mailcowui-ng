<script setup lang="ts">
// The "Edit alias" form of the classic alias page (`templates/edit/alias.twig`) as one section with
// its own save (legacy form map; docs/conventions.md "a legacy tab becomes one section"): the
// address, the goto addresses with legacy's three goto checkboxes, SOGo visible (only with the
// groupware), internal, allowed to send, the private and public comment and active, then "Save
// changes". Closed, it shows the same values read-only.
// - A save sends only the members that differ from the alias as opened, with its version tag
//   (FR-022, FR-026); destinations and comments stored by another tool are never sent back
//   unedited, and a comment is checked only when it changed. Legacy's `success.alias_modified`.
// - 412: the input is kept, the alias reloaded and the changed values listed; "Save again" or
//   "Discard my changes" (FR-027).
// - 404: the alias no longer exists or left the scope; the page returns to the list (FR-028).
// - Refusals show legacy's messages at their fields (legacy form map part 2); a refused external
//   destination is marked on its entry.
// - Deactivating asks nothing (legacy has no confirmation; plan part 3, item 7).
// The input survives a session expiry in this tab (research R10).
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  problemOf,
  queryKeys,
  type Alias,
  type AliasCapabilities,
  type AliasPatch,
  type ApiProblem,
  type Identity,
} from '@/api'
import { lt, text, type LegacyKey } from '@/i18n'
import { useFormat } from '@/i18n/format'
import EditableSection from '@/shared/components/EditableSection.vue'
import type { SectionChange, SectionStatus } from '@/shared/components/editable-section'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useFormDraft } from '@/shared/composables/useFormDraft'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useVersionedSave } from '@/shared/composables/useVersionedSave'
import { sanitizeLegacyHtml } from '@/shared/security/sanitize'
import { utf8ByteLength } from '@/shared/validation/utf8'
import { parseEntryList } from '@/shared/validation/entry-list'

import { feature004Permissions } from '@/features/aliases-common'

import { buildAliasPatch, editFormFrom, type AliasEditForm } from '../alias-form'
import { fetchAlias, updateAlias } from '../api'
import AliasOptionsFields from './AliasOptionsFields.vue'
import AliasValues from './AliasValues.vue'
import DestinationField from './DestinationField.vue'

const props = withDefaults(
  defineProps<{
    alias: Alias
    editing?: boolean
    editDisabledReason?: string | null
    capabilities?: AliasCapabilities
    identity?: Identity | null
  }>(),
  { editing: false, editDisabledReason: null, capabilities: undefined, identity: null },
)
const emit = defineEmits<{ edit: []; close: []; dirty: [value: boolean]; gone: [] }>()

const ID = 'alias-edit'
const ADDRESS_ID = `${ID}-address`
const GOTO_ID = `${ID}-goto`

const { t } = useI18n()
const fmt = useFormat()
const queryClient = useQueryClient()

const groupwareEnabled = computed(() => props.capabilities?.groupwareEnabled)
const permissions = computed(() => feature004Permissions(props.identity, props.capabilities))

const base = shallowRef<Alias | null>(null)
/** The version the form was opened with; the patch holds the user's changes against it. */
const opened = shallowRef<Alias>(props.alias)
const form = ref<AliasEditForm>(editFormFrom(props.alias))
const status = ref<SectionStatus | null>(null)
const outdated = shallowRef<SectionChange[] | null>(null)
const pending = ref(false)
const sent = shallowRef<AliasPatch>({})

const versioned = useVersionedSave<Alias>({
  current: () => base.value,
  refetch: async () => {
    const latest = await fetchAlias(props.alias.id)
    queryClient.setQueryData(queryKeys.aliases.detail(latest.id), latest)
    return latest
  },
})

const problems = useProblemForm({
  formKey: 'aliases.form',
  fieldId: (path) => {
    const field = path.split('.')[0]
    if (field === 'address') return ADDRESS_ID
    if (field === 'destinations' || field === 'destinationType') return GOTO_ID
    if (field === 'privateComment' || field === 'publicComment') return `${ID}-${field}`
    return null
  },
  valueAt: (path) => {
    if (path === 'address') return sent.value.address ?? opened.value.address
    const match = /^destinations\.(\d+)$/.exec(path)
    return match ? sent.value.destinations?.[Number(match[1])] : undefined
  },
  problemFields: { 'address-in-use': 'address', 'domain-alias-limit-reached': 'address' },
  problemParams: () => ({ address: sent.value.address ?? opened.value.address }),
})

function open(alias: Alias) {
  base.value = alias
  opened.value = alias
  form.value = editFormFrom(alias)
  outdated.value = null
}

watch(
  () => props.editing,
  (on) => {
    if (!on) return
    open(props.alias)
    status.value = null
    problems.clear()
    versioned.discard()
  },
  { immediate: true },
)

const dirty = computed(
  () => props.editing && JSON.stringify(form.value) !== JSON.stringify(editFormFrom(opened.value)),
)
watch(dirty, (value) => emit('dirty', value), { immediate: true })

const draft = useFormDraft(ID, {
  capture: () => ({ ...form.value }),
  restore: (value: AliasEditForm) => {
    if (props.editing) form.value = { ...form.value, ...value }
  },
  dirty: () => dirty.value,
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

/** The client checks, as input aids for what the user changed; the server decides the rest. */
function check(): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  const read = opened.value
  if (form.value.address.trim() === '') {
    errors.address = [text('aliases.form.errors.address.required')]
  }
  if (form.value.gotoAction === 'none') {
    const destinations = parseEntryList(form.value.destinationsText).map((entry) => entry.value)
    const max = props.capabilities?.destinationsMaxLength
    if (destinations.length === 0) {
      errors.destinations = [text('aliases.form.errors.destinations.required')]
    } else if (max !== undefined && destinations.join(',').length > max) {
      errors.destinations = [t('validation.tooLong', { max })]
    }
  }
  const limit = props.capabilities?.commentMaxBytes
  for (const field of ['privateComment', 'publicComment'] as const) {
    if (limit === undefined || form.value[field] === read[field]) continue
    if (utf8ByteLength(form.value[field]) > limit) {
      errors[field] = [text(`aliases.form.errors.${field}.tooLong`)]
    }
  }
  return errors
}

/** A legacy label as plain text, for the outdated notice. */
function plain(key: LegacyKey): string {
  const holder = document.createElement('template')
  holder.innerHTML = sanitizeLegacyHtml(lt(key))
  return holder.content.textContent?.trim() ?? ''
}

const ACTIONS: Record<Exclude<Alias['destinationType'], 'addresses'>, LegacyKey> = {
  discard: 'add.goto_null',
  learnSpam: 'mailbox.goto_spam',
  learnHam: 'mailbox.goto_ham',
}

/** The values that changed elsewhere, with their new saved values (FR-027). */
function changes(before: Alias, after: Alias): SectionChange[] {
  const list: SectionChange[] = []
  const yesNo = (value: boolean) => (value ? t('lists.filters.yes') : t('lists.filters.no'))
  if (before.address !== after.address) {
    list.push({ field: 'address', label: lt('edit.alias'), saved: after.addressUnicode })
  }
  if (
    before.destinationType !== after.destinationType ||
    before.destinations.join() !== after.destinations.join()
  ) {
    list.push({
      field: 'destinations',
      label: lt('mailbox.target_address'),
      saved:
        after.destinationType === 'addresses'
          ? fmt.list(after.destinationsUnicode) || '-'
          : plain(ACTIONS[after.destinationType]),
    })
  }
  const flags: [keyof Alias & ('groupwareVisible' | 'internal' | 'senderAllowed'), LegacyKey][] = [
    ['groupwareVisible', 'edit.sogo_visible'],
    ['internal', 'edit.internal'],
    ['senderAllowed', 'edit.sender_allowed'],
  ]
  for (const [field, key] of flags) {
    if (field === 'groupwareVisible' && !groupwareEnabled.value) continue
    if (before[field] !== after[field]) {
      list.push({ field, label: lt(key), saved: yesNo(after[field]) })
    }
  }
  for (const [field, key] of [
    ['privateComment', 'edit.private_comment'],
    ['publicComment', 'edit.public_comment'],
  ] as const) {
    if (before[field] !== after[field]) {
      list.push({ field, label: lt(key), saved: after[field] || '-' })
    }
  }
  if (before.active !== after.active) {
    list.push({ field: 'active', label: lt('edit.active'), saved: yesNo(after.active) })
  }
  return list
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
        entry: sent.value.destinations?.[Number(match[1])],
      }),
    ]
  }
  return Object.keys(errors).length > 0 ? errors : null
}

async function showFailure(problem: ApiProblem) {
  if (problem.status === 404) {
    draft.clear()
    emit('dirty', false)
    emit('gone')
    return
  }
  const entries = attributeErrors(problem)
  if (entries) await problems.setClientMessages(entries)
  else await problems.setProblem(problem)
}

async function run() {
  if (!base.value || pending.value) return
  const patch = buildAliasPatch(opened.value, form.value, {
    groupwareEnabled: groupwareEnabled.value,
  })
  if (!patch) {
    emit('dirty', false)
    emit('close')
    return
  }
  pending.value = true
  sent.value = patch
  problems.clear()
  status.value = null
  try {
    const result = await versioned
      .save(patch, (body, ifMatch) => updateAlias(queryClient, props.alias.id, body, ifMatch))
      // The reload after a 412 can find the alias gone.
      .catch((error: unknown) => ({ status: 'failed' as const, problem: problemOf(error)! }))
    if (result.status === 'saved') {
      open(result.result)
      const message = lt('success.alias_modified', result.result.address)
      status.value = { kind: 'success', message }
      announce(message)
      draft.clear()
      emit('dirty', false)
      emit('close')
      return
    }
    if (result.status === 'outdated') {
      outdated.value = changes(base.value, result.latest ?? base.value)
      return
    }
    if (result.status === 'failed') await showFailure(result.problem)
  } finally {
    pending.value = false
  }
}

async function save() {
  const errors = check()
  if (Object.keys(errors).length > 0) {
    await problems.setClientMessages(errors)
    return
  }
  await run()
}

/** "Save again" after a 412: the reloaded version becomes the base; the user's changes stay. */
async function saveAgain() {
  const latest = versioned.latest.value
  if (latest) base.value = latest
  outdated.value = null
  await save()
}

/** "Discard my changes" after a 412: the form takes the reloaded values. */
function discard() {
  const latest = versioned.discard() ?? base.value
  if (latest) open(latest)
  problems.clear()
}

const retryable = computed(() => problems.formProblem.value?.kind === 'network')
const INPUT =
  'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white'
</script>

<template>
  <EditableSection
    section-id="alias"
    :title="lt('edit.alias')"
    :editable="permissions.canManageAliases"
    :editing="editing"
    :edit-disabled-reason="editDisabledReason"
    :saving="pending"
    :status="status"
    :outdated="outdated"
    :save-label="lt('edit.save')"
    @edit="emit('edit')"
    @cancel="emit('close')"
    @save="save"
    @save-again="saveAgain"
    @discard="discard"
  >
    <AliasValues :alias="alias" :groupware-enabled="groupwareEnabled" />
    <template #form>
      <ErrorSummary :id="problems.summaryId" :items="problems.summary.value" />
      <ProblemMessage :problem="problems.formProblem.value" :retry="retryable" @retry="save" />
      <FormField :id="ADDRESS_ID" :label="lt('edit.alias')" :errors="problems.errorsFor('address')">
        <template #default="control">
          <input
            v-bind="control"
            v-model="form.address"
            type="text"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
            :class="INPUT"
          />
        </template>
      </FormField>
      <DestinationField
        :id="GOTO_ID"
        label-key="edit.target_address"
        :destinations-text="form.destinationsText"
        :goto-action="form.gotoAction"
        :restricted="permissions.externalDestinationsRestricted"
        :errors="problems.errorsFor('destinations')"
        :entry-errors="gotoEntryErrors"
        @update:destinations-text="form.destinationsText = $event"
        @update:goto-action="form.gotoAction = $event"
      />
      <hr v-if="groupwareEnabled" class="border-gray-200 dark:border-gray-800" />
      <AliasOptionsFields
        :id-prefix="ID"
        mode="edit"
        :groupware-enabled="groupwareEnabled"
        :groupware-visible="form.groupwareVisible"
        :internal="form.internal"
        :sender-allowed="form.senderAllowed"
        @update:groupware-visible="form.groupwareVisible = $event"
        @update:internal="form.internal = $event"
        @update:sender-allowed="form.senderAllowed = $event"
      />
      <hr class="border-gray-200 dark:border-gray-800" />
      <FormField
        :id="`${ID}-privateComment`"
        :label="lt('edit.private_comment')"
        :errors="problems.errorsFor('privateComment')"
      >
        <template #default="control">
          <input
            v-bind="control"
            v-model="form.privateComment"
            type="text"
            :maxlength="capabilities?.commentMaxBytes"
            :class="INPUT"
          />
        </template>
      </FormField>
      <FormField
        :id="`${ID}-publicComment`"
        :label="lt('edit.public_comment')"
        :errors="problems.errorsFor('publicComment')"
      >
        <template #default="control">
          <input
            v-bind="control"
            v-model="form.publicComment"
            type="text"
            :maxlength="capabilities?.commentMaxBytes"
            :class="INPUT"
          />
        </template>
      </FormField>
      <hr class="border-gray-200 dark:border-gray-800" />
      <label class="inline-flex min-h-11 items-center gap-3 text-gray-800 dark:text-gray-200">
        <input
          :id="`${ID}-active`"
          v-model="form.active"
          type="checkbox"
          class="size-5 accent-brand-500"
        />
        {{ lt('edit.active') }}
      </label>
    </template>
  </EditableSection>
</template>
