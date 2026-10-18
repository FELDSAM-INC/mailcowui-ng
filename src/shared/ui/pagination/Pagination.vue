<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { useAttrs } from 'vue'
import { useI18n } from 'vue-i18n'
import { cn } from '@/shared/ui/utils/cn'

defineOptions({ inheritAttrs: false })

// Deviation: user-facing text comes from the app's translations (constitution IV).
const { t } = useI18n()
const attrs = useAttrs()
</script>

<template>
  <nav
    :aria-label="t('a11y.pagination')"
    data-slot="pagination"
    v-bind="{ ...attrs, class: undefined }"
    :class="cn('mx-auto flex w-full justify-center', attrs.class as string)"
  >
    <slot />
  </nav>
</template>
