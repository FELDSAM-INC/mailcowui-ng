<script setup lang="ts">
// The objects of legacy's #ConfirmDeleteModal (`#ItemsToDelete`): here the rate limit hash.
import PlainText from '@/shared/components/PlainText.vue'

defineProps<{ items: readonly string[] }>()
</script>

<template>
  <ul class="list-disc ps-5 text-gray-900 dark:text-white">
    <li v-for="item in items" :key="item">
      <code class="font-mono text-xs text-gray-900 dark:text-white"
        ><PlainText :value="item"
      /></code>
    </li>
  </ul>
</template>
