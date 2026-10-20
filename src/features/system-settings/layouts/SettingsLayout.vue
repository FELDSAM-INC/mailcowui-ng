<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { problemOf } from '@/api'
import { lt } from '@/i18n'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'

import { useSettingsCapabilities } from '../api/capabilities'

const { t } = useI18n()
const query = useSettingsCapabilities()
</script>

<template>
  <div class="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-4">
    <template v-if="!query.data.value">
      <PageHeader :title="t('nav.system')" />
      <p
        v-if="query.isPending.value"
        role="status"
        aria-busy="true"
        class="text-gray-700 dark:text-gray-300"
      >
        {{ lt('footer.loading') }}
      </p>
      <ProblemMessage
        v-else
        :problem="problemOf(query.error.value)"
        retry
        @retry="query.refetch()"
      />
    </template>
    <RouterView v-else v-slot="{ Component }">
      <component :is="Component" :capabilities="query.data.value" />
    </RouterView>
  </div>
</template>
