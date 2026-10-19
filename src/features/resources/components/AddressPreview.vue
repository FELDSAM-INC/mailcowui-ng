<script setup lang="ts">
// The address a new resource will get (FR-045, research R14; legacy derives it silently): shown
// live as a preview while the description and domain are entered, or why none can be derived.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { previewAddress } from '../address-preview'

const props = defineProps<{ id: string; description: string; domainUnicode: string | null }>()
const { t } = useI18n()
const address = computed(() => previewAddress(props.description, props.domainUnicode))
</script>

<template>
  <p
    :id="id"
    data-address-preview
    aria-live="polite"
    class="text-sm break-all"
    :class="
      address || description.trim() === ''
        ? 'text-gray-700 dark:text-gray-300'
        : 'text-amber-800 dark:text-amber-200'
    "
  >
    <template v-if="address">{{ t('resources.form.preview', { address }) }}</template>
    <template v-else-if="description.trim() !== ''">{{ t('resources.form.noAddress') }}</template>
  </p>
</template>
