<script setup lang="ts">
// Collapsed message metadata does not need Vue instances until the user opens the disclosure.
// Keep state per card, so pagination and layout changes discard it with the native details.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const open = ref(false)
function onToggle(event: Event) {
  open.value = (event.currentTarget as HTMLDetailsElement).open
}
</script>

<template>
  <details class="mt-3" @toggle="onToggle">
    <summary
      class="flex min-h-11 cursor-pointer items-center font-medium text-gray-800 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-200"
    >
      {{ t('quarantineUi.list.details') }}
    </summary>
    <slot v-if="open" />
  </details>
</template>
