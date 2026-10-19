<script setup lang="ts">
// The sections of My account beside the content from `lg` up (UI 005 research R4; below `lg` the
// hub is the navigation): the sections the account may open, in the classic user page's order,
// the current one marked.
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import { resolveText } from '@/i18n'

import type { AccountSection } from '../../sections'

defineProps<{ sections: readonly AccountSection[]; label: string }>()
const { t } = useI18n()
const route = useRoute()
</script>

<template>
  <nav :aria-label="label" data-section-nav>
    <ul class="flex flex-col gap-1">
      <li>
        <RouterLink
          :to="{ name: 'account' }"
          class="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-white/5"
          :aria-current="route.name === 'account' ? 'page' : undefined"
          active-class=""
          exact-active-class="bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
        >
          {{ resolveText({ legacy: 'header.user_settings' }, t) }}
        </RouterLink>
      </li>
      <li v-for="section in sections" :key="section.id">
        <RouterLink
          :to="{ name: section.route! }"
          class="flex min-h-11 items-center rounded-lg px-3 text-sm text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-white/5"
          :aria-current="route.meta.accountSection === section.id ? 'page' : undefined"
          :class="
            route.meta.accountSection === section.id
              ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
              : ''
          "
        >
          <span class="wrap-anywhere">{{ resolveText(section.title, t) }}</span>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
