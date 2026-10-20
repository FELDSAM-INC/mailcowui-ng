<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { AppLink } from '@/api'
import LegacyText from '@/shared/components/LegacyText.vue'
import AppLinkList from './AppLinkList.vue'
defineProps<{ links: readonly AppLink[]; username: string }>()
const { t } = useI18n()
</script>
<template>
  <section class="min-w-0 space-y-3" data-built-in-links>
    <h2 class="text-lg font-semibold">{{ t('systemSettings.appLinks.builtIn') }}</h2>
    <LegacyText k="admin.merged_vars_hint" as="p" /><AppLinkList
      :model-value="links"
      :username="username"
    />
  </section>
</template>
