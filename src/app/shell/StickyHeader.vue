<script setup lang="ts">
import { onMounted, onScopeDispose, ref } from 'vue'
const root = ref<HTMLElement | null>(null)
let observer: ResizeObserver | undefined
let focusFrame = 0

function revealFocusedControl() {
  focusFrame = 0
  const header = root.value
  const control = document.activeElement
  if (
    !header ||
    !(control instanceof HTMLElement) ||
    control === document.body ||
    header.contains(control) ||
    typeof document.elementFromPoint !== 'function'
  )
    return
  const box = control.getBoundingClientRect()
  const bar = header.getBoundingClientRect()
  if (
    box.right <= bar.left ||
    box.left >= bar.right ||
    box.bottom <= bar.top ||
    box.top >= bar.bottom ||
    box.height > innerHeight - bar.bottom - 8
  )
    return
  // Dialogs, menus and the skip link can cover the header. Only scroll when the header
  // actually covers this control; sidebar links beside it must never move the page.
  const covered = document.elementFromPoint(
    (Math.max(box.left, bar.left) + Math.min(box.right, bar.right)) / 2,
    (Math.max(0, box.top, bar.top) + Math.min(box.bottom, bar.bottom)) / 2,
  )
  if (covered && header.contains(covered)) {
    window.scrollBy({ top: box.top - bar.bottom - 8, behavior: 'instant' })
  }
}

function checkFocus() {
  cancelAnimationFrame(focusFrame)
  // WebKit can leave a focused control beneath the sticky header after native scrolling
  // or viewport resizing, even with scroll-padding-top. Run after its layout frames.
  focusFrame = requestAnimationFrame(() => {
    focusFrame = requestAnimationFrame(revealFocusedControl)
  })
}

onMounted(() => {
  const update = (height: number) => {
    document.documentElement.style.setProperty('--shell-sticky-height', `${height}px`)
    checkFocus()
  }
  document.addEventListener('focusin', checkFocus)
  window.addEventListener('resize', checkFocus)
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
  cancelAnimationFrame(focusFrame)
  document.removeEventListener('focusin', checkFocus)
  window.removeEventListener('resize', checkFocus)
  observer?.disconnect()
  document.documentElement.style.removeProperty('--shell-sticky-height')
})
</script>
<template>
  <div ref="root" data-shell-sticky class="sticky top-0 z-50"><slot /></div>
</template>
