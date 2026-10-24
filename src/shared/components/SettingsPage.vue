<script setup lang="ts">
import PageHeader from './PageHeader.vue'
defineProps<{ title?: string; description?: string }>()
</script>

<template>
  <section class="w-full min-w-0" data-settings-page>
    <slot name="header">
      <PageHeader :title="title ?? ''" :description="description">
        <template v-if="$slots.actions" #actions><slot name="actions" /></template>
      </PageHeader>
    </slot>
    <div class="surface flex min-w-0 flex-col gap-6" data-settings-content><slot /></div>
  </section>
</template>
