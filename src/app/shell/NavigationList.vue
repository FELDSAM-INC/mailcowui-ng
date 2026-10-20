<script setup lang="ts">
// TailAdmin section disclosures, shared by the fixed sidebar and the mobile drawer.
import { computed, reactive, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import type { Identity } from '@/api'
import { resolveText } from '@/i18n'
import { ChevronDownIcon } from '@/shared/icons'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible'
import { sidebarSections } from '../navigation/sections'

const props = defineProps<{ identity: Identity | null | undefined }>()
defineEmits<{ navigate: [] }>()
const { t } = useI18n()
const route = useRoute()
const groupId = useId()
const open = reactive<Record<string, boolean>>({})
const groups = computed(() => sidebarSections(props.identity, route.path))
watch(
  () => route.path,
  () => {
    const active = groups.value.find((group) => group.items.some((item) => item.current))
    if (active) open[active.id] = true
  },
)

const linkClass =
  'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-start font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 aria-[current=page]:bg-brand-50 aria-[current=page]:text-brand-700 dark:text-gray-300 dark:hover:bg-white/5 dark:aria-[current=page]:bg-brand-500/15 dark:aria-[current=page]:text-brand-300'
</script>

<template>
  <nav :aria-label="t('a11y.mainNavigation')">
    <div class="flex flex-col gap-4">
      <Collapsible
        v-for="group in groups"
        :key="group.id"
        :open="open[group.id] ?? true"
        :data-nav-group="group.id"
        @update:open="open[group.id] = $event"
      >
        <h2 v-if="group.labelKey" :id="`${groupId}-${group.id}`">
          <CollapsibleTrigger
            class="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 text-start text-xs font-semibold tracking-wide text-gray-600 uppercase hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-white/5"
          >
            <span class="min-w-0 break-words">{{ resolveText(group.labelKey, t) }}</span>
            <ChevronDownIcon
              class="size-4 shrink-0 motion-safe:transition-transform"
              :class="(open[group.id] ?? true) ? 'rotate-180' : ''"
            />
          </CollapsibleTrigger>
        </h2>
        <CollapsibleContent>
          <ul
            :aria-labelledby="group.labelKey ? `${groupId}-${group.id}` : undefined"
            class="flex flex-col gap-1"
          >
            <li v-for="item in group.items" :key="item.id">
              <RouterLink
                v-if="item.to"
                :to="item.to"
                :data-nav-item="item.id"
                :aria-current="item.current ? 'page' : undefined"
                :class="linkClass"
                @click="$emit('navigate')"
              >
                <component :is="item.icon" class="size-5 shrink-0" />
                <span class="min-w-0 break-words">{{ resolveText(item.labelKey, t) }}</span>
              </RouterLink>
              <span
                v-else
                role="link"
                aria-disabled="true"
                :data-nav-item="item.id"
                :title="t('nav.unavailable')"
                class="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-gray-500 dark:text-gray-400"
              >
                <component :is="item.icon" class="size-5 shrink-0" />
                <span class="min-w-0 break-words"
                  >{{ resolveText(item.labelKey, t)
                  }}<span class="sr-only"> — {{ t('nav.unavailable') }}</span></span
                >
              </span>
            </li>
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </div>
  </nav>
</template>
