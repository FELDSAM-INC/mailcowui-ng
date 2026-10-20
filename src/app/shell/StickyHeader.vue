<script setup lang="ts">
import { onMounted, onScopeDispose, ref } from 'vue'
const root = ref<HTMLElement | null>(null)
let observer: ResizeObserver | undefined
onMounted(() => {
  const update = () =>
    document.documentElement.style.setProperty(
      '--shell-sticky-height',
      `${root.value?.getBoundingClientRect().height ?? 0}px`,
    )
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(update)
    if (root.value) observer.observe(root.value)
  }
  update()
})
onScopeDispose(() => {
  observer?.disconnect()
  document.documentElement.style.removeProperty('--shell-sticky-height')
})
</script>
<template>
  <div ref="root" data-shell-sticky class="sticky top-0 z-50"><slot /></div>
</template>
