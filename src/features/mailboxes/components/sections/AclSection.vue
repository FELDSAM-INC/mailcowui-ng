<script setup lang="ts">
// The "ACL" tab of the classic mailbox page (#macl) as one section: the multi-select of the user
// permissions the API returns for the caller, in legacy order with the `acl.*` labels, and the save
// (`edit.save`). Only the permissions that changed are sent (FR-037); a domain administrator does
// not see those their own flags lack (FR-042), as in legacy.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import EditableSection from '@/shared/components/EditableSection.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'

import { PERMISSION_LABEL_KEYS, presentPermissions } from '../../acl'
import { useMailboxSection, type MailboxSectionProps } from '../../composables/useMailboxSection'
import { permissionsPatch } from '../../patch'
import type { Mailbox, Permission } from '../../types'
import MultiSelectField from '../fields/MultiSelectField.vue'

const props = withDefaults(defineProps<MailboxSectionProps>(), {
  editing: false,
  editDisabledReason: null,
  capabilities: undefined,
  identity: null,
})
const emit = defineEmits<{
  edit: []
  close: []
  dirty: [value: boolean]
  saved: [mailbox: Mailbox]
}>()
const { t } = useI18n()
const fmt = useFormat()

const s = useMailboxSection<Permission[]>(props, emit as never, {
  id: 'acl',
  fields: ['userPermissions'],
  toForm: (mailbox) =>
    presentPermissions(mailbox.userPermissions).filter((key) => mailbox.userPermissions[key]),
  fieldId: () => 'section-acl-permissions',
  makePatch: (opened, selected) => {
    const patch = permissionsPatch(opened.userPermissions, selected)
    return patch ? { userPermissions: patch } : {}
  },
})

const options = computed(() =>
  presentPermissions(props.mailbox.userPermissions).map((key) => ({
    value: key,
    label: lt(PERMISSION_LABEL_KEYS[key]),
  })),
)
const granted = computed(() =>
  presentPermissions(props.mailbox.userPermissions)
    .filter((key) => props.mailbox.userPermissions[key])
    .map((key) => lt(PERMISSION_LABEL_KEYS[key])),
)
</script>

<template>
  <EditableSection
    section-id="acl"
    :title="lt('edit.acl')"
    :editable="true"
    :editing="editing"
    :edit-disabled-reason="editDisabledReason"
    :saving="s.pending.value"
    :status="s.status.value"
    :outdated="s.outdated.value"
    :save-label="lt('edit.save')"
    @edit="emit('edit')"
    @cancel="s.cancel"
    @save="s.save"
    @save-again="s.saveAgain"
    @discard="s.discard"
  >
    <p class="text-sm text-gray-900 dark:text-white">
      {{ granted.length > 0 ? fmt.list(granted) : t('domains.values.none') }}
    </p>
    <template #form>
      <ErrorSummary :id="s.problemForm.summaryId" :items="s.problemForm.summary.value" />
      <ProblemMessage :problem="s.problem.value" />
      <MultiSelectField
        id="section-acl-permissions"
        :model-value="s.form.value"
        :label="t('mailboxes.acl.label')"
        :options="options"
        :size="10"
        :errors="s.errorsFor('userPermissions')"
        @update:model-value="s.form.value = $event as Permission[]"
      />
    </template>
  </EditableSection>
</template>
