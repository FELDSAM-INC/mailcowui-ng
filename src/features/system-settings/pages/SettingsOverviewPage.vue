<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import type { SettingsCapabilities } from '@/api'
import { lt, ltEnglish, resolveText, type TextRef } from '@/i18n'
import PageHeader from '@/shared/components/PageHeader.vue'
import SearchField from '@/shared/components/SearchField.vue'
import { buttonVariants } from '@/shared/ui/button'
import { SEARCH_MAX_LENGTH } from '@/shared/validation/limits'

import { settingsGroups, settingsPages } from '../catalogue'
import { buildSettingsIndex, searchSettings } from '../search'

const props = defineProps<{ capabilities: SettingsCapabilities }>()
const { t, locale } = useI18n()
const router = useRouter()
const route = useRoute()
const query = computed(() => {
  const raw = Array.isArray(route.query.q) ? route.query.q[0] : route.query.q
  return typeof raw === 'string' && raw.length <= SEARCH_MAX_LENGTH ? raw.trim() : ''
})
function english(ref: TextRef) {
  return typeof ref === 'string'
    ? t(ref, {}, { locale: 'en-gb' })
    : ltEnglish(ref.legacy, ...(ref.args ?? []))
}
const index = computed(() =>
  buildSettingsIndex(settingsPages, {
    locale: locale.value,
    capabilities: props.capabilities,
    hasRoute: (name) => router.hasRoute(name),
    resolve: (ref) => resolveText(ref, t),
    english,
  }),
)
const results = computed(() => searchSettings(index.value, query.value, locale.value))
async function search(value: string) {
  await router.replace({ query: { ...route.query, q: value || undefined } })
  // Clearing removes its button. Keep keyboard users in the surviving search field.
  if (!value) await nextTick(() => document.getElementById('settings-search')?.focus())
}
const announcement = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  [query, () => results.value.length, locale],
  () => {
    clearTimeout(timer)
    announcement.value = ''
    if (query.value)
      timer = setTimeout(() => {
        announcement.value = t(
          'systemSettings.search.count',
          { count: results.value.length },
          results.value.length,
        )
      }, 500)
  },
  { immediate: true },
)
onScopeDispose(() => clearTimeout(timer))
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
    <SearchField
      id="settings-search"
      :label="t('systemSettings.search.label')"
      :description="t('systemSettings.search.help')"
      :model-value="query"
      :delay="0"
      @search="search"
    />
    <p class="sr-only" role="status" aria-live="polite" data-settings-search-count>
      {{ announcement }}
    </p>
    <template v-if="query">
      <ul v-if="results.length" data-settings-results class="grid gap-3 sm:grid-cols-2">
        <li v-for="result in results" :key="result.page.id">
          <RouterLink
            :to="{
              name: result.section?.routeName ?? result.page.routeName,
              hash: result.section?.id ? `#${result.section.id}` : undefined,
            }"
            class="flex min-h-11 flex-col gap-1 rounded-xl border border-gray-200 bg-white p-4 text-gray-900 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:hover:bg-white/5"
          >
            <span class="font-semibold"
              >{{ result.title
              }}<template v-if="result.section"> › {{ result.section.title }}</template></span
            >
            <span class="text-sm text-gray-600 dark:text-gray-400">{{ result.description }}</span>
          </RouterLink>
        </li>
      </ul>
      <div
        v-else
        data-settings-search-empty
        class="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800"
      >
        <p>{{ t('systemSettings.search.empty') }}</p>
        <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="search('')">
          {{ t('lists.search.clear') }}
        </button>
      </div>
    </template>
    <template v-else>
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
              <span class="text-sm text-gray-600 dark:text-gray-400">{{
                t(page.description)
              }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>
  </section>
</template>
