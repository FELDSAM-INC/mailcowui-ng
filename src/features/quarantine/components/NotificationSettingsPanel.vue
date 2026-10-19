<script setup lang="ts">
// The quarantine notification settings of a mailbox as a section with its own save (UI 006 US3,
// FR-039, FR-040, legacy form map screen 3, D4, D10, D12): legacy's two option groups with their
// `user.*` labels and help, read-only members with "Prohibited by ACL" and the permission, a save
// of the changed members with `If-Match` (`user.save_changes`), UI 002's outdated handling, and
// legacy's `success.mailbox_modified`. A mailbox without a stored category has no option selected.
// Used by the interim Notifications page of mailbox users (D10) and exported for UI 005's mail
// settings page. On the mailbox page the two groups are part of UI 003's "Mailbox" section instead
// (D9, `useNotificationEditor` as its companion).
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useIdentityQuery } from '@/app/session/queries'
import { lt } from '@/i18n'
import AclReadOnlyNote from '@/shared/components/AclReadOnlyNote.vue'
import type { SectionStatus } from '@/shared/components/editable-section'
import EditableSection from '@/shared/components/EditableSection.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'

import {
  NOTIFICATION_FIELDS,
  NOTIFICATION_FIELD_INFO,
  notificationValueLabel,
  useNotificationEditor,
  type NotificationField,
} from '../composables/useNotificationEditor'
import { canChangeCategory, canChangeFrequency, canSeeHistory } from '../permissions'
import NotificationOptionGroup from './NotificationOptionGroup.vue'

const props = withDefaults(
  defineProps<{
    /** The mailbox address. */
    mailbox: string
    /** The section's heading (legacy's card heading of the host page). */
    title?: string
    sectionId?: string
  }>(),
  { title: undefined, sectionId: 'quarantine-notifications' },
)
/** Whether the open form holds unsaved changes, for the host page's leave guard. */
const emit = defineEmits<{ dirty: [value: boolean] }>()

const { t } = useI18n()
const identity = useIdentityQuery()
const who = computed(() => identity.data.value)
const canChange = (field: NotificationField) =>
  field === 'frequency'
    ? canChangeFrequency(who.value, props.mailbox)
    : canChangeCategory(who.value, props.mailbox)

const editor = useNotificationEditor({ mailbox: () => props.mailbox, canChange })
const editing = ref(false)
const status = ref<SectionStatus | null>(null)
const settings = computed(() => editor.query.data.value ?? null)
const loadFailed = computed(() => editor.query.isError.value && !settings.value)

function setStatus(next: SectionStatus | null) {
  status.value = next
  if (next) announce(next.message)
}

function edit() {
  editor.open()
  setStatus(null)
  editing.value = true
}

function cancel() {
  editing.value = false
  editor.close()
}

async function save() {
  setStatus(null)
  const outcome = await editor.save()
  if (outcome === 'saved' || outcome === 'unchanged') {
    if (outcome === 'saved') {
      setStatus({ kind: 'success', message: lt('success.mailbox_modified', props.mailbox) })
    }
    editing.value = false
    editor.close()
  } else if (outcome === 'failed' && editor.failureText.value) {
    setStatus({ kind: 'error', message: editor.failureText.value })
  }
}

function discard() {
  editor.discard()
}

const valueOf = (field: NotificationField) =>
  field === 'frequency' ? editor.frequency.value : editor.category.value
const storedOf = (field: NotificationField) =>
  settings.value ? (field === 'frequency' ? settings.value.frequency : settings.value.category) : null

watch(
  () => editing.value && editor.dirty(),
  (value) => emit('dirty', value),
)
</script>

<template>
  <EditableSection
    :section-id="sectionId"
    :title="title ?? lt('user.quarantine_notification')"
    :editable="!!settings && editor.anyEditable.value"
    :editing="editing"
    :saving="editor.pending.value"
    :status="status"
    :outdated="editor.changes.value.length > 0 ? editor.changes.value : null"
    :save-label="lt('user.save_changes')"
    @edit="edit"
    @cancel="cancel"
    @save="save"
    @save-again="save"
    @discard="discard"
  >
    <template #header-actions>
      <HistoryLink
        target-type="quarantineNotificationSettings"
        :target-id="mailbox"
        :allowed="canSeeHistory(who)"
      />
    </template>

    <p
      v-if="editor.query.isPending.value"
      role="status"
      class="text-sm text-gray-700 dark:text-gray-300"
    >
      {{ lt('datatables.loadingRecords') }}
    </p>
    <div v-else-if="loadFailed" class="flex flex-col gap-2">
      <p class="text-sm text-gray-900 dark:text-white">{{ t('states.detail.error') }}</p>
      <ProblemMessage
        :problem="editor.query.error.value as never"
        retry
        @retry="editor.query.refetch()"
      />
    </div>
    <dl v-else class="flex flex-col gap-4 text-sm">
      <div v-for="field in NOTIFICATION_FIELDS" :key="field" :data-value="field">
        <dt class="text-gray-600 dark:text-gray-400">
          {{ lt(NOTIFICATION_FIELD_INFO[field].labelKey) }}
        </dt>
        <dd class="text-gray-900 dark:text-white">
          {{ notificationValueLabel(field, storedOf(field)) }}
          <AclReadOnlyNote
            v-if="!editor.editable(field)"
            :id="`${sectionId}-${field}-acl-read`"
            :flag="NOTIFICATION_FIELD_INFO[field].flag"
            class="mt-1"
          />
        </dd>
      </div>
    </dl>

    <template #form>
      <NotificationOptionGroup
        v-for="field in NOTIFICATION_FIELDS"
        :key="field"
        :id-prefix="sectionId"
        :field="field"
        :model-value="valueOf(field)"
        :readonly="!editor.editable(field)"
        @update:model-value="(value) => editor.choose(field, value)"
      />
    </template>
  </EditableSection>
</template>
