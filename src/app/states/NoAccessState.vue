<script setup lang="ts">
// "No access" in place of a section the role may not use (FR-045, research R19). The address is
// kept and the section component is never created, so no section data is requested. US3
// completes the wording (T098).
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import PageHeader from '@/shared/components/PageHeader.vue'
import { LockIcon } from '@/shared/icons'

const { t } = useI18n()
</script>

<template>
  <section class="mx-auto w-full max-w-3xl">
    <PageHeader :title="t('states.noAccess.title')" />
    <div class="flex gap-3 text-gray-700 dark:text-gray-300">
      <LockIcon class="mt-0.5 size-5 shrink-0" />
      <p>{{ t('states.noAccess.body') }}</p>
    </div>
    <RouterLink
      to="/"
      class="mt-6 inline-flex min-h-11 items-center rounded-lg bg-brand-500 px-4 font-medium text-white hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      {{ t('common.goHome') }}
    </RouterLink>
  </section>
</template>
