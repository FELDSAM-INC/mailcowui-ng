<script setup lang="ts">
// The transcript of a connection test (research R13, FR-047, FR-074): collapsed below md, open from
// md up; one line per entry in monospace, wrapping long lines; a visible marker per direction
// (`C:`, `S:`, `*`) explained by a legend, hidden from screen readers in favour of a spoken word;
// the server's text shown as text, never as markup, and untranslated; "Copy transcript" with the
// plain text, a refusal selecting the lines for manual copying.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { RoutingConnectionTestResult } from '@/api'
import { announce } from '@/shared/composables/useAnnouncer'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { copyText } from '@/shared/platform/clipboard'
import { ChevronDownIcon, CopyIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { MARKERS, toPlainText } from '../../logic/transcript'

const props = defineProps<{ lines: RoutingConnectionTestResult['transcript'] }>()
const { t } = useI18n()
const wide = useMediaQuery('(min-width: 768px)')
const open = ref(wide.value)
watch(wide, (value) => {
  open.value = value
})
const list = ref<HTMLElement | null>(null)
const plain = computed(() => toPlainText(props.lines))

async function copy() {
  const outcome = await copyText(plain.value)
  if (outcome === 'copied') {
    announce(t('secrets.copied'))
    return
  }
  announce(t('routing.connectionTest.copyRefused'), { assertive: true })
  open.value = true
  const selection = window.getSelection()
  if (list.value && selection) {
    const range = document.createRange()
    range.selectNodeContents(list.value)
    selection.removeAllRanges()
    selection.addRange(range)
  }
}
</script>

<template>
  <section
    class="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-base font-semibold text-gray-900 dark:text-white">
        <button
          type="button"
          class="inline-flex min-h-11 items-center gap-2 text-start"
          :aria-expanded="open ? 'true' : 'false'"
          aria-controls="transcript-lines"
          @click="open = !open"
        >
          <ChevronDownIcon
            class="size-4 shrink-0 motion-safe:transition-transform"
            :class="open ? 'rotate-180' : ''"
          />
          {{ t('routing.connectionTest.transcript') }}
        </button>
      </h2>
      <button
        v-if="lines.length > 0"
        type="button"
        :class="buttonVariants({ variant: 'outline', size: 'sm' })"
        @click="copy"
      >
        <CopyIcon />
        {{ t('routing.connectionTest.copy') }}
      </button>
    </div>
    <div v-show="open" id="transcript-lines" class="flex flex-col gap-2">
      <p v-if="lines.length === 0" class="text-sm text-gray-700 dark:text-gray-300">
        {{ t('routing.connectionTest.noDialogue') }}
      </p>
      <template v-else>
        <p class="text-sm text-gray-700 dark:text-gray-300">
          {{ t('routing.connectionTest.legend') }}
        </p>
        <ol
          ref="list"
          data-transcript
          translate="no"
          class="flex flex-col font-mono text-xs leading-5 whitespace-pre-wrap text-gray-900 [overflow-wrap:anywhere] dark:text-gray-100"
        >
          <li v-for="(line, index) in lines" :key="index" class="flex gap-2">
            <span
              aria-hidden="true"
              class="shrink-0 font-semibold"
              :class="
                line.direction === 'server'
                  ? 'text-brand-700 dark:text-brand-300'
                  : 'text-gray-600 dark:text-gray-400'
              "
              >{{ MARKERS[line.direction] }}</span
            >
            <span class="min-w-0">
              <span class="sr-only"
                >{{ t(`routing.connectionTest.direction.${line.direction}`) }}: </span
              >{{ line.text }}</span
            >
          </li>
        </ol>
      </template>
    </div>
  </section>
</template>
