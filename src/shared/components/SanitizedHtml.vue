<script setup lang="ts">
// The only place that renders HTML (FR-002, research R17), sanitised by a DOMPurify allowlist
// first: operator HTML (the default), the markup of a mailcow language value
// (`profile="legacy"`, through LegacyText), or release notes rendered from Markdown
// (`profile="releaseNotes"`, UI 011). Plain text never comes here.
import { computed } from 'vue'

import { registeredSanitizer, sanitizeHtml, sanitizeLegacyHtml } from '../security/sanitize'

const props = withDefaults(
  defineProps<{
    html: string | null | undefined
    profile?: 'operator' | 'legacy' | 'releaseNotes'
    /** The element that holds the HTML: a block for operator HTML, inline for legacy texts. */
    tag?: string
  }>(),
  { profile: 'operator', tag: 'div' },
)
const safe = computed(() => {
  if (!props.html) return ''
  if (props.profile === 'releaseNotes') {
    // Registered by `security/release-notes.ts` when the release-notes renderer loads; until then
    // the strict operator profile applies.
    return (registeredSanitizer('releaseNotes') ?? sanitizeHtml)(props.html)
  }
  return props.profile === 'legacy' ? sanitizeLegacyHtml(props.html) : sanitizeHtml(props.html)
})
</script>

<template>
  <!-- Sanitised by sanitize.ts (research R17); the only v-html in the app, on a native element. -->
  <!-- eslint-disable vue/no-v-html, vue/no-v-text-v-html-on-component -->
  <component
    :is="tag"
    v-if="safe"
    :class="`${profile === 'legacy' ? 'legacy' : profile === 'releaseNotes' ? 'release-notes' : 'operator'}-html`"
    v-html="safe"
  />
  <!-- eslint-enable vue/no-v-html, vue/no-v-text-v-html-on-component -->
</template>
