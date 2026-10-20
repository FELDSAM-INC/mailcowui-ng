<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import type { RspamdSettingsRule, SettingsCapabilities } from '@/api'
import { lt } from '@/i18n'
import PageHeader from '@/shared/components/PageHeader.vue'
import RuleForm from '../../components/spam/RuleForm.vue'
defineProps<{ capabilities: SettingsCapabilities }>()
const router = useRouter()
function saved(item: RspamdSettingsRule) {
  void router.replace({ name: 'rspamd-rule-detail', params: { ruleId: item.id } })
}
</script>
<template>
  <section class="min-w-0 space-y-5">
    <RouterLink
      :to="{ name: 'rspamd-rules' }"
      class="inline-flex min-h-11 items-center underline"
      >{{ lt('admin.rspamd_settings_map') }}</RouterLink
    >
    <PageHeader :title="lt('admin.add_settings_rule')" />
    <RuleForm :max-bytes="capabilities.limits.rspamdRuleContentMaxBytes" @saved="saved" />
  </section>
</template>
