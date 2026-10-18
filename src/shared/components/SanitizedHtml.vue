<script setup lang="ts">
// The only place that renders HTML (FR-002, research R17), sanitised by a DOMPurify allowlist
// first: operator HTML (the default), or the markup of a mailcow language value
// (`profile="legacy"`, through LegacyText). Plain text never comes here.
import { computed } from 'vue'

import { sanitizeHtml, sanitizeLegacyHtml } from '../security/sanitize'

const props = withDefaults(
  defineProps<{
    html: string | null | undefined
    profile?: 'operator' | 'legacy'
    /** The element that holds the HTML: a block for operator HTML, inline for legacy texts. */
    tag?: string
  }>(),
  { profile: 'operator', tag: 'div' },
)
const safe = computed(() => {
  if (!props.html) return ''
  return props.profile === 'legacy' ? sanitizeLegacyHtml(props.html) : sanitizeHtml(props.html)
})
</script>

<template>
  <!-- Sanitised by sanitize.ts (research R17); the only v-html in the app, on a native element. -->
  <!-- eslint-disable vue/no-v-html, vue/no-v-text-v-html-on-component -->
  <component
    :is="tag"
    v-if="safe"
    :class="profile === 'operator' ? 'operator-html' : 'legacy-html'"
    v-html="safe"
  />
  <!-- eslint-enable vue/no-v-html, vue/no-v-text-v-html-on-component -->
</template>
