<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import type { SettingsCapabilities } from '@/api'
import { lt, resolveText } from '@/i18n'
import PageHeader from '@/shared/components/PageHeader.vue'

import { settingsGroups, settingsPages } from '../catalogue'

const props = defineProps<{ capabilities: SettingsCapabilities }>()
const { t } = useI18n()
const router = useRouter()
const groups = computed(() =>
  settingsGroups
    .map((id) => ({
      id,
      pages: settingsPages.filter(
        (page) =>
          page.group === id && page.visible(props.capabilities) && router.hasRoute(page.routeName),
      ),
    }))
    .filter((group) => group.pages.length > 0),
)
</script>

<template>
  <section data-settings-overview class="flex min-w-0 flex-col gap-4">
    <PageHeader :title="t('nav.system')" />
    <section v-for="group in groups" :key="group.id" :aria-labelledby="`settings-${group.id}`">
      <h2
        :id="`settings-${group.id}`"
        class="mb-3 text-lg font-semibold text-gray-900 dark:text-white"
      >
        {{
          group.id === 'branding' ? lt('admin.customize') : t(`systemSettings.groups.${group.id}`)
        }}
      </h2>
      <ul class="grid gap-3 sm:grid-cols-2">
        <li v-for="page in group.pages" :key="page.id">
          <RouterLink
            :to="{ name: page.routeName }"
            class="flex min-h-11 flex-col gap-1 rounded-xl border border-gray-200 bg-white p-4 text-gray-900 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:hover:bg-white/5"
          >
            <span class="font-semibold">{{ resolveText(page.title, t) }}</span>
            <span class="text-sm text-gray-600 dark:text-gray-400">{{ t(page.description) }}</span>
          </RouterLink>
        </li>
      </ul>
    </section>
  </section>
</template>
