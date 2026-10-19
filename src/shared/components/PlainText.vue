<script setup lang="ts">
// UI 006 and UI 011: untrusted message, log and audit data is inert, direction-isolated text.
// Controls and bidi overrides stay visible and have a screen-reader explanation. Keep the
// monitoring callers' explicit element, or use a bdi for inline text and a block for paragraphs.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { neutralise } from '../security/plain-text'

const props = withDefaults(
  defineProps<{ value: string | null | undefined; multiline?: boolean; as?: string }>(),
  { multiline: false, as: undefined },
)
const { t } = useI18n()
const segments = computed(() => neutralise(props.value ?? '', { multiline: props.multiline }))
</script>

<template>
  <component
    :is="as ?? (multiline ? 'div' : 'bdi')"
    dir="auto"
    data-plain-text
    class="wrap-anywhere"
    :class="multiline ? 'whitespace-pre-wrap [unicode-bidi:plaintext]' : '[unicode-bidi:isolate]'"
    ><template v-for="(segment, at) in segments" :key="at"
      ><template v-if="segment.kind === 'text'">{{ segment.value }}</template
      ><span
        v-else
        data-marker
        class="mx-0.5 rounded bg-gray-200 px-1 font-mono text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
        ><span class="sr-only">{{ `${t('a11y.controlCharacter')} ` }}</span
        >{{ segment.codePoint }}</span
      ></template
    ></component
  >
</template>
