<script setup lang="ts">
// A secret shown in groups of four (UI 005 research R10, R13, FR-113): each group is its own
// element with a visually hidden separator, so screen readers read it group by group; the copy
// button copies the raw value. Used for the TOTP key and generated app passwords.
import { computed, ref } from 'vue'

import CopyButton from './CopyButton.vue'

const props = defineProps<{ value: string; copyLabel: string }>()
const target = ref<HTMLElement | null>(null)
const groups = computed(() => props.value.match(/.{1,4}/g) ?? [])
</script>

<template>
  <div class="flex flex-col items-start gap-2">
    <code
      ref="target"
      data-grouped-secret
      class="flex flex-wrap gap-x-2 gap-y-1 rounded-lg bg-gray-100 px-3 py-2 font-mono text-lg tracking-wider text-gray-900 select-all dark:bg-white/10 dark:text-white"
      ><template v-for="(group, index) in groups" :key="index"
        ><span>{{ group }}</span
        ><span v-if="index < groups.length - 1" class="sr-only">, </span></template
      ></code
    >
    <CopyButton :text="value" :label="copyLabel" :select-target="target" />
  </div>
</template>
