<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { problemOf } from '@/api'
import { lt } from '@/i18n'
import CodeEditor from '@/shared/components/code-editor/CodeEditor.vue'
import CopyButton from '@/shared/components/CopyButton.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SettingsLoading from '../../components/common/SettingsLoading.vue'

import { effectiveMapOptions } from '../../api/rspamd-rules'
import RspamdMapNavigation from '../../components/spam/RspamdMapNavigation.vue'
import RefreshButton from '@/shared/components/RefreshButton.vue'
const { t } = useI18n()
const query = useQuery(effectiveMapOptions())
const container = ref<HTMLElement>()
</script>
<template>
  <section class="min-w-0 space-y-5">
    <RspamdMapNavigation />

    <PageHeader :title="lt('admin.active_rspamd_settings_map')">
      <template #actions
        ><RefreshButton :pending="query.isFetching.value" @refresh="query.refetch()"
      /></template>
    </PageHeader>
    <SettingsLoading v-if="query.isPending.value" editor :fields="0" />
    <ProblemMessage
      v-else-if="query.isError.value"
      :problem="problemOf(query.error.value)"
      retry
      @retry="query.refetch()"
    />
    <div v-else-if="query.data.value" ref="container" class="min-w-0 space-y-3">
      <CopyButton
        :text="query.data.value.content"
        :label="`${t('secrets.copy')}: ${lt('admin.active_rspamd_settings_map')}`"
        :select-target="container?.querySelector('textarea')"
      />
      <CodeEditor
        id="effective-settings-map"
        :model-value="query.data.value.content"
        :label="lt('admin.active_rspamd_settings_map')"
        :max-bytes="Number.MAX_SAFE_INTEGER"
        readonly
      />
    </div>
  </section>
</template>
