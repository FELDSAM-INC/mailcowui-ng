<script setup lang="ts">
// One second-factor method of the step: a labelled region with its heading (FR-020).
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SecondFactorType } from '@/api'

defineProps<{ type: SecondFactorType }>()
const { t } = useI18n()
const titleId = useId()
</script>

<template>
  <section
    :data-method="type"
    :aria-labelledby="titleId"
    class="flex flex-col gap-3 border-t border-gray-200 pt-4 dark:border-gray-800"
  >
    <h2 :id="titleId" class="font-semibold text-gray-900 dark:text-white">
      {{ t(`enums.secondFactorType.${type}`) }}
    </h2>
    <slot />
  </section>
</template>
