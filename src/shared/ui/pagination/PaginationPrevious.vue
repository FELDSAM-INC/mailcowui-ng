<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { useAttrs } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ButtonSize, ButtonVariant } from '@/shared/ui/button'
import { ChevronLeftIcon } from '@/shared/icons'
import PaginationLink from './PaginationLink.vue'

defineOptions({ inheritAttrs: false })

// Deviation: user-facing text comes from the app's translations (constitution IV).
const { t } = useI18n()

withDefaults(
  defineProps<{
    text?: string
    size?: ButtonSize
    variant?: ButtonVariant
    disabled?: boolean
  }>(),
  {
    text: undefined,
    size: 'default',
  },
)

const attrs = useAttrs()
</script>

<template>
  <PaginationLink
    :aria-label="t('a11y.previousPage')"
    :size="size"
    :variant="variant"
    :disabled="disabled"
    v-bind="attrs"
  >
    <slot>
      <ChevronLeftIcon data-icon="inline-start" class="rtl:rotate-180" />
      <span v-if="size !== 'icon'" class="hidden sm:block">{{ text ?? t('common.previous') }}</span>
    </slot>
  </PaginationLink>
</template>
