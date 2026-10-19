<script setup lang="ts">
// Untrusted text shown as text (conventions "untrusted multi-line text: neutralise()", research
// R11): log contents, queued messages, Rspamd history, service messages and audit details. The
// value is neutralised by `neutralise()` (UI 008): control characters and bidi overrides become
// visible markers, nothing is interpreted as markup (text interpolation only), the text is
// isolated (`dir="auto"`), and it wraps at any character. Multi-line text keeps its line breaks.
import { computed } from 'vue'

import { neutralise } from '../security/plain-text'

const props = withDefaults(
  defineProps<{ value: string | null | undefined; multiline?: boolean; as?: string }>(),
  { multiline: false, as: 'span' },
)
const segments = computed(() => neutralise(props.value ?? '', { multiline: props.multiline }))
</script>

<template>
  <component
    :is="as"
    dir="auto"
    data-plain-text
    class="wrap-anywhere [unicode-bidi:isolate]"
    :class="multiline ? 'whitespace-pre-wrap' : ''"
    ><template v-for="(segment, at) in segments" :key="at"
      ><template v-if="segment.kind === 'text'">{{ segment.value }}</template
      ><span
        v-else
        data-marker
        class="mx-0.5 rounded bg-gray-200 px-1 font-mono text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >{{ segment.codePoint }}</span
      ></template
    ></component
  >
</template>
