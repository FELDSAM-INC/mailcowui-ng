<script setup lang="ts">
import { useId } from 'vue'

defineProps<{ title: string }>()
const titleId = useId()
</script>

<template>
  <section :aria-labelledby="titleId" class="min-w-0 space-y-4 border-t border-line pt-5">
    <h3 :id="titleId" class="text-base font-semibold text-foreground">{{ title }}</h3>
    <slot />
  </section>
</template>
