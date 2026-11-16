<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { takeSyncSourceReturn } from './oauth-capture'
import { api, problemOf, requireData } from '@/api'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
const { t } = useI18n()
const pending = ref(true),
  success = ref(false),
  denied = ref(false),
  failure = ref<ReturnType<typeof problemOf>>(null)
onMounted(async () => {
  const { code, state, error } = takeSyncSourceReturn() ?? {}
  if (error || typeof code !== 'string' || typeof state !== 'string') {
    denied.value = true
    pending.value = false
    return
  }
  try {
    requireData(await api.POST('/sync-sources/oauth/complete', { body: { code, state } }))
    success.value = true
  } catch (e) {
    failure.value = problemOf(e)
  } finally {
    pending.value = false
  }
})
</script>
<template>
  <section class="space-y-4">
    <PageHeader :title="t('syncSources.connections')" />
    <p v-if="pending" role="status">{{ t('syncSources.connecting') }}</p>
    <p v-if="success" role="status">{{ t('syncSources.connected') }}</p>
    <p v-if="denied" role="alert">{{ t('syncSources.cancelled') }}</p>
    <ProblemMessage :problem="failure" />
  </section>
</template>
