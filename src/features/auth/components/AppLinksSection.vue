<script setup lang="ts">
// The operator's app links on the sign-in screens (FR-001a, data-model §2): in the configured
// order, under the operator's "Apps" text, only those shown on the login page and only with a safe
// address. No section when there is nothing to show. Names and the label are plain text.
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { appsLabel, loginPageLinks } from '@/app/branding/app-links'
import { useBranding } from '@/app/branding/public-config'
import { ExternalLinkIcon } from '@/shared/icons'

const { t } = useI18n()
const { branding } = useBranding()
const titleId = useId()
const links = computed(() => loginPageLinks(branding.value.appLinks))
const label = computed(() => appsLabel(branding.value.appsLabel, t))
</script>

<template>
  <section v-if="links.length > 0" data-app-links :aria-labelledby="titleId" class="surface">
    <h2 :id="titleId" class="font-semibold wrap-anywhere text-gray-900 dark:text-white">
      {{ label }}
    </h2>
    <ul class="mt-2 flex flex-col">
      <li v-for="link in links" :key="`${link.name}|${link.href}`">
        <a :href="link.href" rel="noopener noreferrer" class="text-link gap-2 wrap-anywhere">
          <ExternalLinkIcon class="size-4 shrink-0" />
          <span>{{ link.name }}</span>
        </a>
        <p v-if="link.description" class="text-sm text-gray-600 dark:text-gray-400">
          {{ link.description }}
        </p>
      </li>
    </ul>
  </section>
</template>
