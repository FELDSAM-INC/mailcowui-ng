<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { useAttrs } from 'vue'
import { useI18n } from 'vue-i18n'
import { HorizontalDotsIcon } from '@/shared/icons'
import { cn } from '@/shared/ui/utils/cn'

defineOptions({ inheritAttrs: false })

// Deviation: user-facing text comes from the app's translations (constitution IV).
const { t } = useI18n()
const attrs = useAttrs()
</script>

<template>
  <span
    aria-hidden="true"
    data-slot="pagination-ellipsis"
    v-bind="{ ...attrs, class: undefined }"
    :class="
      cn(
        `flex size-11 items-center justify-center dark:text-white/90 [&_svg:not([class*='size-'])]:size-4`,
        attrs.class as string,
      )
    "
  >
    <slot>
      <HorizontalDotsIcon />
    </slot>
    <span class="sr-only">{{ t('a11y.morePages') }}</span>
  </span>
</template>
