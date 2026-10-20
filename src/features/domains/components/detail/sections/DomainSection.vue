<script setup lang="ts">
// The "Edit domain" tab of the classic domain page (`templates/edit/domain.twig` #dedit) as one
// section with its own save (owner rule 1:1, docs/conventions.md "Detail pages"): domain,
// description (read-only without the `domain_desc` permission), tags, the relayhost (UI 009's
// choice, shown with the `domain_relayhost` permission and saved with the section), then, for
// administrators only, the limits, the quotas in MiB and the relay options, then the Global Address
// List, active (administrators only) and the creation and modification times. The default mailbox
// quota is left out (owner decision, docs/conventions.md "Follow the legacy form"). The client rules of
// data-model §6 apply before sending; saving says legacy's `success.domain_modified`.
import { computed } from 'vue'
import { lt } from '@/i18n'
import type { Domain, Identity } from '@/api'
import { RelayhostAssignmentField, useRelayhostAssignment } from '@/features/routing'
import EditableSection from '@/shared/components/EditableSection.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import { QUOTA_MAX_BYTES } from '@/shared/validation/limits'

import {
  useEditableSection,
  type SectionEmits,
  type SectionProps,
} from '../../../composables/useEditableSection'
import { useTagSuggestions } from '../../../composables/useTagSuggestions'
import {
  add,
  checkLength,
  checkLimit,
  checkQuotaOrder,
  checkTags,
  checkWhole,
  type ClientErrors,
} from '../../../form-rules'
import { useDomainFormat } from '../../../format'
import type { RelayOptions } from '../../../relay'
import LimitField from '../../fields/LimitField.vue'
import RelayOptionsField from '../../fields/RelayOptionsField.vue'
import TagSetInput from '@/shared/components/TagSetInput.vue'
import SectionProblem from '../SectionProblem.vue'
import ValueList from '@/shared/components/ValueList.vue'

const props = withDefaults(defineProps<SectionProps & { identity?: Identity | null }>(), {
  editing: false,
  editDisabledReason: null,
  capabilities: undefined,
  identity: null,
})
const emit = defineEmits<SectionEmits>()
const format = useDomainFormat()
const suggestions = useTagSuggestions()

const MIB = 1_048_576
const QUOTA_RANGE = { min: 1, max: Math.floor(QUOTA_MAX_BYTES / MIB) }

interface DomainForm {
  description: string
  tags: string[]
  maxAliases: string
  maxMailboxes: string
  maxMailboxQuota: string
  domainQuota: string
  relay: RelayOptions
  globalAddressList: boolean
  active: boolean
}

const toForm = (domain: Domain): DomainForm => ({
  description: domain.description,
  tags: [...domain.tags],
  maxAliases: String(domain.maxAliases),
  maxMailboxes: String(domain.maxMailboxes),
  maxMailboxQuota: String(domain.maxMailboxQuota / MIB),
  domainQuota: String(domain.domainQuota / MIB),
  relay: {
    backupMx: domain.backupMx,
    relayAllRecipients: domain.relayAllRecipients,
    relayUnknownOnly: domain.relayUnknownOnly,
  },
  globalAddressList: domain.globalAddressList,
  active: domain.active,
})

const whole = (value: string) => Number(value.trim())

function validate(form: DomainForm, base: Domain): ClientErrors {
  const errors: ClientErrors = {}
  checkLength(
    errors,
    'description',
    form.description.trim(),
    props.capabilities?.maxDescriptionLength ?? 255,
    format,
  )
  checkTags(errors, form.tags, base.tags, props.capabilities?.taggingLimit ?? 25, format)
  if (!s.canEdit('maxAliases')) return errors
  const aliases = checkLimit(errors, 'maxAliases', form.maxAliases, format)
  const mailboxes = checkLimit(errors, 'maxMailboxes', form.maxMailboxes, format)
  const quota = (path: 'maxMailboxQuota' | 'domainQuota') => {
    const value = checkWhole(errors, path, form[path], QUOTA_RANGE, format)
    return value === null ? null : value * MIB
  }
  const quotas = {
    maxMailboxQuota: quota('maxMailboxQuota'),
    domainQuota: quota('domainQuota'),
  }
  const below = (
    path: string,
    value: number | null,
    stored: number,
    used: number,
    inUse: string,
  ) => {
    if (value !== null && value !== stored && value < used) {
      add(errors, path, { key: 'validation.belowInUse', params: { inUse } })
    }
  }
  const usage = base.usage
  below('maxAliases', aliases, base.maxAliases, usage.aliases, format.count(usage.aliases))
  below(
    'maxMailboxes',
    mailboxes,
    base.maxMailboxes,
    usage.mailboxes,
    format.count(usage.mailboxes),
  )
  below(
    'maxMailboxQuota',
    quotas.maxMailboxQuota,
    base.maxMailboxQuota,
    usage.largestMailboxQuota,
    format.size(usage.largestMailboxQuota),
  )
  below(
    'domainQuota',
    quotas.domainQuota,
    base.domainQuota,
    usage.quotaAllocated,
    format.size(usage.quotaAllocated),
  )
  if (!errors.maxMailboxQuota && !errors.domainQuota) {
    checkQuotaOrder(errors, quotas, format)
  }
  return errors
}

const showRelayhost = computed(
  () => props.identity?.role === 'admin' || !!props.identity?.permissions.domainRelayhost,
)
// UI 009: the relayhost is saved through its own operation after the section's patch.
const relayhostField = useRelayhostAssignment({
  kind: 'domain',
  name: () => props.domain.name,
  enabled: () => showRelayhost.value,
})

const s = useEditableSection(props, emit, {
  id: 'domain',
  companion: relayhostField.companion,
  fields: [
    'description',
    'tags',
    'maxAliases',
    'maxMailboxes',
    'maxMailboxQuota',
    'domainQuota',
    'backupMx',
    'relayAllRecipients',
    'relayUnknownOnly',
    'globalAddressList',
    'active',
  ],
  toForm,
  toValues: (form) => ({
    description: form.description.trim(),
    tags: [...form.tags],
    maxAliases: whole(form.maxAliases),
    maxMailboxes: whole(form.maxMailboxes),
    maxMailboxQuota: whole(form.maxMailboxQuota) * MIB,
    domainQuota: whole(form.domainQuota) * MIB,
    ...form.relay,
    globalAddressList: form.globalAddressList,
    active: form.active,
  }),
  validate,
})

/** Administrators: the limits, quotas and relay options are theirs alone, as in legacy. */
const admin = computed(() => s.canEdit('maxAliases') || props.identity?.role === 'admin')
const relayhost = computed(() =>
  props.domain.relayhost
    ? props.domain.relayhost.hostname
      ? `ID ${props.domain.relayhost.id}: ${props.domain.relayhost.hostname}`
      : `ID ${props.domain.relayhost.id}`
    : lt('edit.none_inherit'),
)
const mib = (bytes: number) => format.count(bytes / MIB)

const items = computed(() => [
  { key: 'domain', label: lt('mailbox.domain'), value: props.domain.unicodeName },
  { key: 'description', label: lt('edit.description'), value: props.domain.description },
  {
    key: 'tags',
    label: lt('add.tags'),
    value: props.domain.tags.length > 0 ? format.list(props.domain.tags) : '',
  },
  ...(showRelayhost.value
    ? [{ key: 'relayhost', label: lt('edit.relayhost'), value: relayhost.value }]
    : []),
  ...(admin.value
    ? [
        {
          key: 'maxAliases',
          label: lt('edit.max_aliases'),
          value: format.count(props.domain.maxAliases),
        },
        {
          key: 'maxMailboxes',
          label: lt('edit.max_mailboxes'),
          value: format.count(props.domain.maxMailboxes),
        },
        {
          key: 'maxMailboxQuota',
          label: lt('edit.max_quota'),
          value: mib(props.domain.maxMailboxQuota),
        },
        {
          key: 'domainQuota',
          label: lt('edit.domain_quota'),
          value: mib(props.domain.domainQuota),
        },
        {
          key: 'backupMx',
          label: lt('edit.relay_domain'),
          value: format.yesNo(props.domain.backupMx),
        },
        {
          key: 'relayAllRecipients',
          label: lt('edit.relay_all'),
          value: format.yesNo(props.domain.relayAllRecipients),
        },
        {
          key: 'relayUnknownOnly',
          label: lt('edit.relay_unknown_only'),
          value: format.yesNo(props.domain.relayUnknownOnly),
        },
      ]
    : []),
  {
    key: 'globalAddressList',
    label: lt('edit.gal'),
    value: format.yesNo(props.domain.globalAddressList),
  },
  { key: 'active', label: lt('edit.active'), value: format.yesNo(props.domain.active) },
])

const times = computed(() => [
  `${lt('edit.created_on')}: ${format.time(props.domain.createdAt)}`,
  `${lt('edit.last_modified')}: ${props.domain.modifiedAt ? format.time(props.domain.modifiedAt) : lt('user.never')}`,
])
const INPUT =
  'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-red-500 read-only:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:read-only:bg-gray-950'
const LIMITS = [
  ['maxAliases', 'edit.max_aliases'],
  ['maxMailboxes', 'edit.max_mailboxes'],
  ['maxMailboxQuota', 'edit.max_quota'],
  ['domainQuota', 'edit.domain_quota'],
] as const
</script>

<template>
  <EditableSection
    section-id="domain"
    :title="lt('edit.domain')"
    :editable="s.editable.value"
    :editing="editing"
    :edit-disabled-reason="editDisabledReason"
    :saving="s.section.pending.value"
    :status="s.status.value"
    :outdated="s.outdated.value"
    :can-save="s.canSave.value"
    :save-label="lt('admin.save')"
    @edit="emit('edit')"
    @cancel="s.cancel"
    @save="s.save"
    @save-again="s.saveAgain"
    @discard="s.discard"
  >
    <ValueList :items="items" />
    <p class="mt-3 text-sm text-gray-600 italic dark:text-gray-400">
      <span v-for="line in times" :key="line" class="block">{{ line }}</span>
    </p>
    <template #form>
      <ErrorSummary :id="s.section.form.summaryId" :items="s.section.form.summary.value" />
      <SectionProblem :problem="s.section.problem.value" @retry="s.save" />
      <ValueList :items="[items[0]!]" />
      <FormField
        id="section-domain-description"
        :label="lt('edit.description')"
        :errors="s.errorsFor('description')"
      >
        <template #default="control">
          <input
            v-bind="control"
            v-model="s.form.value.description"
            type="text"
            autocomplete="off"
            :readonly="!s.canEdit('description')"
            :class="INPUT"
          />
        </template>
      </FormField>
      <TagSetInput
        id="section-domain-tags"
        v-model="s.form.value.tags"
        :label="lt('add.tags')"
        :max-length="capabilities?.maxTagLength ?? 255"
        :errors="s.errorsFor('tags')"
        :suggestions="suggestions.suggestions.value"
        :suggestions-state="suggestions.state.value"
        @search="suggestions.search"
      />
      <RelayhostAssignmentField
        v-if="showRelayhost"
        id="section-domain-relayhost"
        :field="relayhostField"
      />
      <template v-if="admin">
        <LimitField
          v-for="[field, labelKey] in LIMITS"
          :id="`section-domain-${field}`"
          :key="field"
          v-model="s.form.value[field]"
          :label="lt(labelKey)"
          :errors="s.errorsFor(field)"
        />
        <RelayOptionsField v-model="s.form.value.relay" id-prefix="section-domain-relay" />
      </template>
      <div class="flex flex-col">
        <label
          class="flex min-h-11 cursor-pointer items-center gap-3 text-gray-800 dark:text-gray-200"
        >
          <input
            id="section-domain-globalAddressList"
            v-model="s.form.value.globalAddressList"
            type="checkbox"
            class="size-5 shrink-0 accent-accent"
            aria-describedby="section-domain-gal-help"
            :disabled="!s.canEdit('globalAddressList')"
          />
          <span>{{ lt('edit.gal') }}</span>
        </label>
        <LegacyText
          id="section-domain-gal-help"
          k="edit.gal_info"
          as="p"
          class="ms-8 text-sm text-gray-600 dark:text-gray-400"
        />
      </div>
      <label
        class="flex min-h-11 cursor-pointer items-center gap-3 text-gray-800 dark:text-gray-200"
      >
        <input
          id="section-domain-active"
          v-model="s.form.value.active"
          type="checkbox"
          class="size-5 shrink-0 accent-accent"
          :disabled="!s.canEdit('active')"
        />
        <span>{{ lt('edit.active') }}</span>
      </label>
    </template>
  </EditableSection>
</template>
