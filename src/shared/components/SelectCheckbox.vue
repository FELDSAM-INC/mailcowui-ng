<script setup lang="ts">
// A selection checkbox with a 44 × 44 px target (US5-AS4). At the bulk limit it is disabled and
// described by the limit message. Promoted from UI 002 at its second use (UI 003's mailbox lists).
defineProps<{ label: string; checked: boolean; disabled?: boolean; describedBy?: string }>()
const emit = defineEmits<{ change: [checked: boolean] }>()
</script>

<template>
  <label
    class="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
  >
    <input
      type="checkbox"
      class="size-5 accent-brand-500 disabled:cursor-not-allowed"
      :aria-label="label"
      :checked="checked"
      :disabled="disabled"
      :aria-describedby="disabled ? describedBy : undefined"
      @change="emit('change', ($event.target as HTMLInputElement).checked)"
    />
  </label>
</template>
