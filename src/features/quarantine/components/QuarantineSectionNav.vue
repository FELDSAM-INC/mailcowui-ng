<script setup lang="ts">
// The Quarantine section's own navigation (UI 006 research R6, legacy form map screen 11): the
// registered routes of the Quarantine entry that carry `meta.sectionNav`, in their order, for the
// roles their `meta.roles` allow. A page that is not built yet is not registered, so it never
// appears and no link can break. With fewer than two entries there is nothing to navigate.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { useIdentityQuery } from '@/app/session/queries'
import { resolveText } from '@/i18n'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const identity = useIdentityQuery()

const entries = computed(() => {
  const role = identity.data.value?.role
  if (!role) return []
  return router
    .getRoutes()
    .filter((record) => record.meta.navEntry === 'quarantine' && record.meta.sectionNav)
    .filter((record) => !record.meta.roles || record.meta.roles.includes(role))
    .sort((a, b) => a.meta.sectionNav!.order - b.meta.sectionNav!.order)
    .map((record) => ({
      name: record.name as string,
      label: resolveText(record.meta.sectionNav!.labelKey, t),
      current: route.name === record.name,
    }))
})
</script>

<template>
  <nav v-if="entries.length > 1" :aria-label="t('quarantineUi.nav.label')" class="mb-4">
    <ul class="flex flex-wrap gap-2">
      <li v-for="entry in entries" :key="entry.name">
        <RouterLink
          :to="{ name: entry.name }"
          :aria-current="entry.current ? 'page' : undefined"
          class="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          :class="
            entry.current
              ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-950 dark:text-brand-200'
              : 'border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
          "
        >
          {{ entry.label }}
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
