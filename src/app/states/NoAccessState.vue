<script setup lang="ts">
// "No access" in place of a section the role may not use (FR-045, research R19). The address is
// kept and the section component is never created, so no section data is requested. US3
// completes the wording (T098). UI 005 (research R4): an optional classic text explains why, for
// example `login.mobileconfig_info` on Mail app setup for administrators.
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { LegacyKey } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import { LockIcon } from '@/shared/icons'

defineProps<{ reason?: LegacyKey }>()
const { t } = useI18n()
</script>

<template>
  <section class="mx-auto w-full max-w-3xl">
    <PageHeader :title="t('states.noAccess.title')" />
    <div class="flex gap-3 text-gray-700 dark:text-gray-300">
      <LockIcon class="mt-0.5 size-5 shrink-0" />
      <LegacyText v-if="reason" :k="reason" as="p" />
      <p v-else>{{ t('states.noAccess.body') }}</p>
    </div>
    <RouterLink
      to="/"
      class="mt-6 inline-flex min-h-11 items-center rounded-lg bg-accent px-4 font-medium text-accent-foreground hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      {{ t('common.goHome') }}
    </RouterLink>
  </section>
</template>
