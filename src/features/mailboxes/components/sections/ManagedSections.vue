<script setup lang="ts">
// The "Pushover" and "Rate limit" tabs of the classic mailbox page (#mpushover, #mrl), read-only in
// their legacy positions until UI 005 and UI 006 make them editable (docs/conventions.md "Detail
// pages"): whether push notifications are active, and the mailbox's own rate limit (legacy's tab
// shows the mailbox's, not the domain's) with legacy's help.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import EditableSection from '@/shared/components/EditableSection.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import ValueList from '@/shared/components/ValueList.vue'

import type { Mailbox } from '../../types'
import { FRAME_KEYS } from '../fields/options'

const props = defineProps<{ mailbox: Mailbox; section: 'pushover' | 'rateLimit' }>()
const { t } = useI18n()
const fmt = useFormat()

const rateLimit = computed(() => {
  const limit = props.mailbox.rateLimitSource === 'mailbox' ? props.mailbox.rateLimit : null
  return limit
    ? t('domains.values.rateLimit', {
        value: fmt.number(limit.value),
        frame: lt(FRAME_KEYS[limit.frame]),
      })
    : lt('ratelimit.disabled')
})
</script>

<template>
  <EditableSection
    v-if="section === 'pushover'"
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
  <EditableSection
    v-else
    section-id="rateLimit"
    :title="lt('edit.ratelimit')"
    :editable="false"
    :editing="false"
  >
    <ValueList :items="[{ key: 'rateLimit', label: lt('acl.ratelimit'), value: rateLimit }]" />
    <LegacyText
      k="edit.mbox_rl_info"
      as="p"
      class="mt-3 text-sm text-gray-600 dark:text-gray-400"
    />
  </EditableSection>
</template>
