<script setup lang="ts">
// "Other methods" (FR-020): advanced methods behind a disclosure, on Reka's Collapsible.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { ChevronDownIcon } from '@/shared/icons'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible'

const { t } = useI18n()
const open = ref(false)
</script>

<template>
  <Collapsible v-model:open="open" class="border-t border-gray-200 pt-2 dark:border-gray-800">
    <CollapsibleTrigger
      class="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-1 font-medium text-gray-800 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-200 dark:hover:bg-white/5"
    >
      {{ t('auth.secondFactor.otherMethods') }}
      <ChevronDownIcon
        class="size-5 shrink-0 motion-safe:transition-transform"
        :class="open ? 'rotate-180' : ''"
      />
    </CollapsibleTrigger>
    <CollapsibleContent class="motion-reduce:animate-none">
      <div class="pt-2">
        <slot />
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>
