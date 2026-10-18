<!-- Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md. -->
<script setup lang="ts">
import { useAttrs } from 'vue'
import type { ButtonSize, ButtonVariant } from '@/shared/ui/button'
import { ChevronLeftIcon } from '@/shared/icons'
import { lt } from '@/i18n'

import PaginationLink from './PaginationLink.vue'

defineOptions({ inheritAttrs: false })

// Deviation: user-facing text is the classic interface's DataTables text (constitution IV).

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
    :aria-label="lt('datatables.paginate.previous')"
    :size="size"
    :variant="variant"
    :disabled="disabled"
    v-bind="attrs"
  >
    <slot>
      <ChevronLeftIcon data-icon="inline-start" class="rtl:rotate-180" />
      <span v-if="size !== 'icon'" class="hidden sm:block">{{
        text ?? lt('datatables.paginate.previous')
      }}</span>
    </slot>
  </PaginationLink>
</template>
