<script setup lang="ts">
// The operator's announcement on every page (FR-048, research R16). Its type is given by an icon
// with a text alternative and a visually hidden prefix, never by colour alone (FR-084). It can be
// collapsed for the rest of the visit: sessionStorage keeps the SHA-256 of the text, so a new text
// shows again.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { DangerIcon, InfoIcon, WarningIcon } from '@/shared/icons'
import { sessionStore } from '@/shared/platform/storage'

import { useBranding, type AnnouncementType } from '../branding/public-config'

const KEY = 'mailcowui-ng.announcement-collapsed'
const { t } = useI18n()
const { branding } = useBranding()

const announcement = computed(() => branding.value.announcement)
const hash = ref<string | null>(null)
const collapsed = ref(false)

const ICONS = { info: InfoIcon, warning: WarningIcon, danger: DangerIcon } as const
const STYLES: Record<AnnouncementType, string> = {
  info: 'border-blue-light-100 bg-blue-light-50 text-blue-light-950 dark:border-blue-light-700 dark:bg-blue-light-950 dark:text-blue-light-50',
  warning:
    'border-warning-200 bg-warning-50 text-warning-900 dark:border-warning-900 dark:bg-warning-950 dark:text-warning-100',
  danger:
    'border-error-200 bg-error-50 text-error-900 dark:border-error-900 dark:bg-error-950 dark:text-error-100',
}

async function sha256(text: string): Promise<string | null> {
  try {
    const subtle = globalThis.crypto?.subtle
    if (!subtle) return null
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text))
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

watch(
  () => announcement.value?.text,
  async (text) => {
    collapsed.value = false
    hash.value = text ? await sha256(text) : null
    collapsed.value = !!hash.value && sessionStore.get(KEY) === hash.value
  },
  { immediate: true },
)

function collapse() {
  collapsed.value = true
  if (hash.value) sessionStore.set(KEY, hash.value)
}

function expand() {
  collapsed.value = false
  sessionStore.remove(KEY)
}
</script>

<template>
  <div
    v-if="announcement"
    data-announcement
    class="border-b px-4 py-2 sm:px-6"
    :class="STYLES[announcement.type]"
  >
    <div v-if="!collapsed" class="flex items-start gap-3">
      <component :is="ICONS[announcement.type]" class="mt-2.5 size-5 shrink-0" />
      <p class="min-w-0 flex-1 py-2 break-words">
        <span class="sr-only">{{
          t('shell.announcement.prefix', { type: t(`enums.announcementType.${announcement.type}`) })
        }}</span>
        {{ announcement.text }}
      </p>
      <button
        type="button"
        class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-current dark:hover:bg-white/10"
        :aria-label="t('shell.announcement.collapse')"
        @click="collapse"
      >
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 24 24"
          class="size-5"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <path d="m18 15-6-6-6 6" />
        </svg>
      </button>
    </div>
    <button
      v-else
      type="button"
      class="flex min-h-11 items-center gap-2 rounded-lg px-2 font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-current dark:hover:bg-white/10"
      @click="expand"
    >
      <component :is="ICONS[announcement.type]" class="size-5 shrink-0" />
      <!-- The visible type is part of the accessible name (WCAG 2.5.3 label in name). -->
      <span>{{ t(`enums.announcementType.${announcement.type}`) }}</span>
      <span class="sr-only">{{ ` – ${t('shell.announcement.expand')}` }}</span>
    </button>
  </div>
</template>
