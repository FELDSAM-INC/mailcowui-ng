<script setup lang="ts">
// The log text (FR-042, FR-043, research R17): read-only, verbatim, fixed-width, in chunks of 500
// lines with `content-visibility: auto`, so a 5 MB log stays fast; every chunk is neutralised
// (control and bidi characters as visible markers) and shown through text interpolation only, in a
// `dir="auto"` block. The area is a named region that takes the focus and scrolls by keyboard;
// with wrapping off only it scrolls sideways.
import { computed, shallowRef, watch } from 'vue'

import { neutralise, type PlainTextSegment } from '@/shared/security/plain-text'

import { chunkLog } from '../log-view'

const props = defineProps<{ text: string; wrap: boolean; label: string }>()
const chunks = shallowRef<PlainTextSegment[][]>([])
watch(
  () => props.text,
  (text) => {
    chunks.value = chunkLog(text).map((chunk) => neutralise(chunk, { multiline: true }))
  },
  { immediate: true },
)
const wrapping = computed(() =>
  props.wrap ? 'whitespace-pre-wrap wrap-anywhere' : 'whitespace-pre',
)
</script>

<template>
  <!-- eslint-disable-next-line vuejs-accessibility/no-noninteractive-tabindex -- a scrollable region must take focus -->
  <div
    role="region"
    :aria-label="label"
    tabindex="0"
    dir="auto"
    class="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs leading-5 text-gray-900 [unicode-bidi:plaintext] focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
    :class="wrapping"
  >
    <div
      v-for="(segments, index) in chunks"
      :key="index"
      data-chunk
      class="[contain-intrinsic-size:auto_10000px] [content-visibility:auto]"
    >
      <template v-for="(segment, at) in segments" :key="at">
        <template v-if="segment.kind === 'text'">{{ segment.value }}</template>
        <span
          v-else
          data-marker
          class="mx-0.5 rounded bg-gray-200 px-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >{{ segment.codePoint }}</span
        >
      </template>
    </div>
  </div>
</template>
