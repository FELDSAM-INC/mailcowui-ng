<script setup lang="ts">
import { lt } from '@/i18n'
defineProps<{ names: readonly string[] }>()
</script>
<template>
  <div class="flex flex-col gap-2">
    <p>{{ lt('footer.delete_these_items') }}</p>
    <ul class="list-inside list-disc">
      <li v-for="(name, index) in names" :key="index" class="wrap-anywhere">{{ name }}</li>
    </ul>
  </div>
</template>
