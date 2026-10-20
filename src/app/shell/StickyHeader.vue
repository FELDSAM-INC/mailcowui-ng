<script setup lang="ts">
import { onMounted, onScopeDispose, ref } from 'vue'
const root = ref<HTMLElement | null>(null)
let observer: ResizeObserver | undefined
onMounted(() => {
  const update = (height: number) =>
    document.documentElement.style.setProperty('--shell-sticky-height', `${height}px`)
  if (typeof ResizeObserver !== 'undefined') {
    // The initial notification arrives after layout. Reading the rectangle during mount forces
    // the browser to lay out the entire page before it has finished rendering its list/cards.
    observer = new ResizeObserver((entries) => {
      const entry = entries.find((entry) => entry.target === root.value)
      if (entry) update(entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height)
    })
    if (root.value) observer.observe(root.value, { box: 'border-box' })
  } else update(root.value?.getBoundingClientRect().height ?? 0)
})
onScopeDispose(() => {
  observer?.disconnect()
  document.documentElement.style.removeProperty('--shell-sticky-height')
})
</script>
<template>
  <div ref="root" data-shell-sticky class="sticky top-0 z-50"><slot /></div>
</template>
