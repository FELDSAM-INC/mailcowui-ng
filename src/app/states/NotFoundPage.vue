<script setup lang="ts">
// The catch-all page (research R19): the address does not exist in the app.
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import PageHeader from '@/shared/components/PageHeader.vue'

const { t } = useI18n()
</script>

<template>
  <section class="mx-auto w-full max-w-3xl">
    <PageHeader :title="t('states.notFound.title')" />
    <p class="mb-6 text-gray-700 dark:text-gray-300">{{ t('states.notFound.body') }}</p>
    <RouterLink
      to="/"
      class="inline-flex min-h-11 items-center rounded-lg bg-brand-500 px-4 font-medium text-white hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      {{ t('common.goHome') }}
    </RouterLink>
  </section>
</template>
