<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { MailboxMailSettings } from '@/api'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useMailSettingChange } from '../../composables/useMailSettingChange'
import TaggedMailSetting from './TaggedMailSetting.vue'
import TlsPolicySetting from './TlsPolicySetting.vue'
const props = defineProps<{
  stored: MailboxMailSettings
  tagged: boolean
  tls: boolean
  showWarning: boolean
  reload: () => Promise<unknown>
}>()
const { t } = useI18n()
const change = useMailSettingChange({
  stored: () => props.stored,
  canChange: () => props.tagged || props.tls,
  reload: () => props.reload(),
})
</script>
<template>
  <div class="flex flex-col gap-6">
    <TaggedMailSetting
      v-if="tagged"
      :value="stored.taggedMailHandling"
      :pending="change.pending.value"
      @change="change.save({ taggedMailHandling: $event })"
    />
    <TlsPolicySetting
      v-if="tls"
      :inbound="stored.tlsEnforceInbound"
      :outbound="stored.tlsEnforceOutbound"
      :pending="change.pending.value"
      :show-warning="showWarning"
      @change="change.save($event)"
    />
    <p v-if="change.notice.value" role="status">{{ change.notice.value }}</p>
    <p v-if="change.outdated.value" data-outdated role="alert">
      {{ t('account.mailSettings.changedElsewhere') }}
    </p>
    <ProblemMessage :problem="change.problem.value" />
  </div>
</template>
