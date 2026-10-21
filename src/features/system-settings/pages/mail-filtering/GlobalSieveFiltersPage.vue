<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { problemOf, type SettingsCapabilities } from '@/api'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SettingsLoading from '../../components/common/SettingsLoading.vue'
import { globalFiltersOptions } from '../../api/global-filters'
import GlobalSieveFilterForm from '../../components/mail-filtering/GlobalSieveFilterForm.vue'
defineProps<{ capabilities: SettingsCapabilities }>()
const { t } = useI18n()
const query = useQuery(globalFiltersOptions())
</script>

<template>
  <section class="min-w-0 space-y-4">
    <PageHeader :title="t('systemSettings.globalSieve.title')" />
    <SettingsLoading v-if="query.isPending.value" editor :sections="2" :fields="0" />
    <ProblemMessage
      v-else-if="!query.data.value"
      :problem="problemOf(query.error.value)"
      retry
      @retry="query.refetch()"
    />
    <template v-else>
      <GlobalSieveFilterForm
        v-for="filter in query.data.value"
        :key="filter.id"
        :filter="filter"
        :max-bytes="capabilities.limits.sieveScriptMaxBytes"
      />
    </template>
  </section>
</template>
