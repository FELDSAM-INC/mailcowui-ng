<script setup lang="ts">
// The "Pushover" tab of the classic mailbox page (#mpushover), read-only in its legacy position
// until UI 005 makes it editable (docs/conventions.md "Detail pages"): whether push notifications
// are active. The "Rate limit" tab (#mrl) is UI 006's section (`@/features/rate-limits`).
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import EditableSection from '@/shared/components/EditableSection.vue'
import ValueList from '@/shared/components/ValueList.vue'

import type { Mailbox } from '../../types'

defineProps<{ mailbox: Mailbox; section: 'pushover' }>()
const { t } = useI18n()
</script>

<template>
  <EditableSection
    section-id="pushover"
    :title="lt('edit.pushover')"
    :editable="false"
    :editing="false"
  >
    <ValueList
      :items="[
        {
          key: 'pushover',
          label: lt('edit.active'),
          value: t(mailbox.pushNotificationsActive ? 'domains.values.yes' : 'domains.values.no'),
        },
      ]"
    />
  </EditableSection>
</template>
