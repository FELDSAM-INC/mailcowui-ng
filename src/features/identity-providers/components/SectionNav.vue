<script setup lang="ts">
// The two screens of "Identity providers and OAuth2" (FR-001), named as the classic System ›
// Configuration tabs (`admin.iam`, `admin.oauth2_apps`). A link appears only when its route is
// registered; the current screen is marked with aria-current.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { lt, type LegacyKey } from '@/i18n'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

const LINKS: { name: string; label: LegacyKey; prefix: string }[] = [
  { name: 'identity-provider', label: 'admin.iam', prefix: '/identity-providers/provider' },
  { name: 'oauth2-clients', label: 'admin.oauth2_apps', prefix: '/identity-providers/oauth2-apps' },
]
const links = computed(() => LINKS.filter((link) => router.hasRoute(link.name)))
const current = (prefix: string) => route.path === prefix || route.path.startsWith(`${prefix}/`)
</script>

<template>
  <nav
    :aria-label="t('nav.identityProviders')"
    class="-mx-1 flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-800"
  >
    <RouterLink
      v-for="link in links"
      :key="link.name"
      :to="{ name: link.name }"
      :aria-current="current(link.prefix) ? 'page' : undefined"
      class="inline-flex min-h-11 items-center rounded-t-lg border-b-2 px-3 font-medium text-gray-700 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:text-white"
      :class="
        current(link.prefix)
          ? 'border-brand-500 text-gray-900 dark:text-white'
          : 'border-transparent'
      "
    >
      {{ lt(link.label) }}
    </RouterLink>
  </nav>
</template>
