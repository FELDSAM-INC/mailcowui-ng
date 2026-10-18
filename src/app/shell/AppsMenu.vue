<script setup lang="ts">
// The "Apps" menu of the signed-in header (FR-001a, FR-042): the operator's app links in their
// configured order, under the operator's "Apps" text, with the signed-in address (`%u` replaced
// by the encoded username). Only safe addresses are rendered; without links there is no menu.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { ChevronDownIcon, ExternalLinkIcon } from '@/shared/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

import { appsLabel, signedInLinks } from '../branding/app-links'
import { useBranding } from '../branding/public-config'

const props = defineProps<{ username: string }>()
const { t } = useI18n()
const { branding } = useBranding()
const links = computed(() => signedInLinks(branding.value.appLinks, props.username))
const label = computed(() => appsLabel(branding.value.appsLabel, t))
</script>

<template>
  <DropdownMenu v-if="links.length > 0">
    <DropdownMenuTrigger
      :aria-label="t('a11y.appsMenu', { label })"
      class="flex min-h-11 max-w-[12rem] min-w-11 items-center justify-center gap-2 rounded-lg px-2 text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-white/5"
    >
      <ExternalLinkIcon class="size-5 shrink-0" />
      <span class="hidden truncate font-medium md:inline">{{ label }}</span>
      <ChevronDownIcon class="hidden size-4 shrink-0 md:block" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="max-w-[calc(100vw-2rem)] min-w-48">
      <DropdownMenuItem
        v-for="link in links"
        :key="`${link.name}|${link.href}`"
        as-child
        class="min-h-11"
      >
        <a :href="link.href" rel="noopener noreferrer">
          <span class="min-w-0 wrap-anywhere">{{ link.name }}</span>
        </a>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
