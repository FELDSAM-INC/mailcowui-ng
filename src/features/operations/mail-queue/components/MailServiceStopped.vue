<script setup lang="ts">
// The queue cannot be read or changed while the Postfix container is not running (FR-060): the
// container named by the API's problem, with a link to its card on the dashboard. The link is
// rendered only when that address exists, so it is never broken.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import { containerRoute } from '@/features/operations'
import { DangerIcon } from '@/shared/icons'

const props = defineProps<{ container: string }>()
const { t } = useI18n()
const router = useRouter()
const link = computed(() =>
  router.hasRoute('operations-container') ? containerRoute(props.container) : null,
)
</script>

<template>
  <div
    data-postfix-stopped
    role="alert"
    class="flex flex-col items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
  >
    <p class="flex items-start gap-2">
      <DangerIcon class="mt-0.5 size-5 shrink-0" />
      <span class="wrap-anywhere">{{ t('problem.mail-service-not-running', { container }) }}</span>
    </p>
    <RouterLink v-if="link" :to="link" class="text-link underline">
      {{ t('operations.queue.openContainer', { container }) }}
    </RouterLink>
  </div>
</template>
