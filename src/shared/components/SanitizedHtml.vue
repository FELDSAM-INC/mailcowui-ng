<script setup lang="ts">
// The only place that renders HTML (FR-002, research R17): operator HTML, sanitised by the
// DOMPurify allowlist first. Plain text never comes here.
import { computed } from 'vue'

import { sanitizeHtml } from '../security/sanitize'

const props = defineProps<{ html: string | null | undefined }>()
const safe = computed(() => (props.html ? sanitizeHtml(props.html) : ''))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- sanitised by sanitizeHtml (research R17); the only v-html in the app -->
  <div v-if="safe" class="operator-html" v-html="safe" />
</template>
