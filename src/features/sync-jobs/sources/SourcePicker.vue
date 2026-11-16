<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useIdentityQuery } from '@/app/session/queries'
import DomainPicker, { type DomainPickerSource } from '@/shared/components/DomainPicker.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { problemOf } from '@/api'
import { sourceKey, fetchSources, sourceOptions } from './api'
import type { SyncJobFormValues } from '../form-model'
import SourceConnections from './SourceConnections.vue'
const props = defineProps<{ id: string; editing: boolean; errors: readonly string[] }>()
const values = defineModel<SyncJobFormValues>({ required: true })
const { t } = useI18n(),
  identity = useIdentityQuery()
const owner = computed(
  () =>
    values.value.mailbox ||
    (identity.data.value?.role === 'mailboxUser' ? identity.data.value.username : ''),
)
const query = useQuery(
  computed(() => ({
    ...sourceOptions(values.value.sourceId ?? 0),
    enabled: !!values.value.sourceId,
  })),
)
const sources: DomainPickerSource = {
  id: 'sync-sources',
  queryKey: (q) => [...sourceKey, 'picker', q],
  async fetchPage(params) {
    const result = await fetchSources(params)
    return {
      total: result.meta.total,
      items: result.data.map((s) => ({
        name: String(s.id),
        nameUnicode: s.name,
        detail: `${s.remoteHost}:${s.remotePort} · ${s.authMechanism.toUpperCase()}`,
        relay: !s.active,
      })),
    }
  },
}
const labels = computed(() =>
  query.data.value ? { [String(query.data.value.id)]: query.data.value.name } : {},
)
watch(
  () => query.data.value,
  (source) => {
    if (!source || source.id !== values.value.sourceId) return
    values.value.sourceOAuth = source.authMechanism === 'xoauth2'
    values.value.remoteHost = source.remoteHost
    values.value.remotePort = String(source.remotePort)
    values.value.encryption = source.encryption
    if (values.value.sourceOAuth) values.value.remotePassword = ''
  },
)
function choose(value: string | string[] | null) {
  if (typeof value !== 'string' && props.editing) return
  values.value.sourceId = typeof value === 'string' ? Number(value) : undefined
  values.value.sourceOAuth = false
  values.value.remotePassword = ''
}
</script>
<template>
  <div class="space-y-3">
    <DomainPicker
      :id="id"
      :label="t('syncSources.fields.sourceId')"
      :model-value="values.sourceId ? String(values.sourceId) : null"
      :sources="[sources]"
      :labels="labels"
      :errors="errors"
      :description="editing ? t('syncSources.chooseHelp') : t('syncSources.optionalSource')"
      :disabled-reason="(option) => (option.relay ? t('syncSources.inactive') : null)"
      @update:model-value="choose"
    /><ProblemMessage :problem="problemOf(query.error.value)" />
    <p v-if="query.data.value" class="text-sm text-muted">
      {{ query.data.value.remoteHost }}:{{ query.data.value.remotePort }} ·
      {{ query.data.value.authMechanism.toUpperCase() }}
    </p>
    <SourceConnections
      v-if="owner && query.data.value?.oauth?.flow === 'authorization_code'"
      :source-id="query.data.value.id"
      :mailbox="owner"
      allow-select
      @select="values.remoteUser = $event"
    />
  </div>
</template>
