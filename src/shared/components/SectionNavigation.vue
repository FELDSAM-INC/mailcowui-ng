<script setup lang="ts">
// Shared section links stay visible at every width. Only the tab row scrolls on small screens;
// desktop links wrap, and the current destination stays in view without scrolling the page.
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { resolveText, type TextRef } from '@/i18n'

const props = defineProps<{
  label: string
  items: readonly {
    id: string
    labelKey: TextRef
    to?: string
    current?: boolean
    disabled?: boolean
  }[]
}>()
const { t, locale } = useI18n()
const links = ref<HTMLUListElement | null>(null)
function revealCurrent() {
  const list = links.value
  if (!list || list.scrollWidth <= list.clientWidth) return
  const selected = list.querySelector<HTMLElement>('[aria-current="page"]')
  if (!selected) return
  const bounds = list.getBoundingClientRect()
  const current = selected.getBoundingClientRect()
  // Keep focus outlines inside the scrollport. scrollIntoView would also move the page.
  const left = current.left - bounds.left - 4
  const right = current.right - bounds.right + 4
  if (left < 0) list.scrollBy({ left })
  else if (right > 0) list.scrollBy({ left: right })
}
watch([links, () => props.items, locale], revealCurrent, { flush: 'post' })
watch(
  links,
  (list, _, onCleanup) => {
    if (!list || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(revealCurrent)
    observer.observe(list)
    onCleanup(() => observer.disconnect())
  },
  { flush: 'post' },
)
const linkClass =
  'inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground aria-[current=page]:hover:bg-accent-hover dark:text-gray-300 dark:hover:bg-white/5 dark:aria-[current=page]:bg-accent dark:aria-[current=page]:text-accent-foreground dark:aria-[current=page]:hover:bg-accent-hover'
</script>

<template>
  <nav
    v-if="items.length > 1"
    :aria-label="label"
    class="min-w-0 max-w-full"
    data-section-navigation
  >
    <ul
      ref="links"
      class="flex max-w-full gap-1 overflow-x-auto p-1 [scrollbar-width:thin] md:flex-wrap md:overflow-visible"
    >
      <li v-for="item in items" :key="item.id" class="shrink-0">
        <RouterLink
          v-if="item.to && !item.disabled"
          :to="item.to"
          :class="linkClass"
          :aria-current="item.current ? 'page' : undefined"
          >{{ resolveText(item.labelKey, t) }}</RouterLink
        >
        <span
          v-else
          role="link"
          aria-disabled="true"
          :title="t('nav.unavailable')"
          class="inline-flex min-h-11 cursor-not-allowed items-center whitespace-nowrap rounded-lg px-3 text-sm text-gray-500 dark:text-gray-400"
          >{{ resolveText(item.labelKey, t)
          }}<span class="sr-only"> — {{ t('nav.unavailable') }}</span></span
        >
      </li>
    </ul>
  </nav>
</template>
