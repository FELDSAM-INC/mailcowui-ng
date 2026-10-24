<script setup lang="ts">
import SettingsPage from '@/shared/components/SettingsPage.vue'
import { computed } from 'vue'
import { lt } from '@/i18n'
import AclReadOnlyNote from '@/shared/components/AclReadOnlyNote.vue'
import MailboxContextHeader from '../components/layout/MailboxContextHeader.vue'
import PushNotificationsForm from '../components/push/PushNotificationsForm.vue'
import { useSectionAccess } from '../composables/useSectionAccess'
const props = defineProps<{ mailbox?: string; embedded?: boolean }>()
const access = useSectionAccess(() => 'pushNotifications')
const owner = computed(() => props.mailbox ?? access.context.mailbox.value)
const mailboxContext = computed(() => access.context.kind.value === 'mailbox')
</script>
<template>
  <component
    :is="embedded ? 'section' : SettingsPage"
    :id="embedded ? 'pushover' : undefined"
    :class="embedded ? 'surface flex flex-col gap-6' : undefined"
  >
    <h2 v-if="embedded" class="text-lg font-semibold text-gray-900 dark:text-white">
      {{ lt('edit.pushover') }}
    </h2>
    <template v-if="!embedded" #header
      ><MailboxContextHeader :title="lt('edit.pushover')"
    /></template>
    <AclReadOnlyNote
      v-if="embedded && access.mailbox.value.mode === 'readOnly'"
      id="push-read-only"
      :flag="access.mailbox.value.flag"
    />
    <PushNotificationsForm
      v-if="owner"
      :key="owner"
      :mailbox="owner"
      :mailbox-context="mailboxContext"
      :can-change="access.canChange.value"
    />
  </component>
</template>
