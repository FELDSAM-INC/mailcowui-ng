<script setup lang="ts">
// The existing Routing tabs, now reused by every top-level content group. Narrow screens use a
// disclosure; wider screens wrap the same links, preserving 44 px targets without sideways scroll.
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { resolveText, type TextRef } from '@/i18n'
import { ChevronDownIcon } from '@/shared/icons'

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
const { t } = useI18n()
const id = useId()
const open = ref(false)
const currentLabel = computed(() =>
  resolveText(
    props.items.find((item) => item.current)?.labelKey ?? props.items[0]?.labelKey ?? '',
    t,
  ),
)
const linkClass =
  'inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 aria-[current=page]:bg-brand-50 aria-[current=page]:text-brand-700 dark:text-gray-300 dark:hover:bg-white/5 dark:aria-[current=page]:bg-brand-500/15 dark:aria-[current=page]:text-brand-300'
</script>

<template>
  <nav v-if="items.length > 1" :aria-label="label" data-section-navigation>
    <button
      type="button"
      class="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 text-start text-sm font-medium text-gray-800 md:hidden dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-controls="id"
      @click="open = !open"
    >
      <span class="min-w-0 wrap-anywhere">{{ currentLabel }}</span>
      <ChevronDownIcon
        class="size-4 shrink-0 motion-safe:transition-transform"
        :class="open ? 'rotate-180' : ''"
      />
    </button>
    <ul
      :id="id"
      class="mt-2 flex-col gap-1 md:mt-0 md:flex md:flex-row md:flex-wrap"
      :class="open ? 'flex' : 'hidden'"
    >
      <li v-for="item in items" :key="item.id">
        <RouterLink
          v-if="item.to && !item.disabled"
          :to="item.to"
          :class="linkClass"
          :aria-current="item.current ? 'page' : undefined"
          @click="open = false"
          >{{ resolveText(item.labelKey, t) }}</RouterLink
        >
        <span
          v-else
          role="link"
          aria-disabled="true"
          :title="t('nav.unavailable')"
          class="inline-flex min-h-11 cursor-not-allowed items-center rounded-lg px-3 text-sm text-gray-500 dark:text-gray-400"
          >{{ resolveText(item.labelKey, t)
          }}<span class="sr-only"> — {{ t('nav.unavailable') }}</span></span
        >
      </li>
    </ul>
  </nav>
</template>
