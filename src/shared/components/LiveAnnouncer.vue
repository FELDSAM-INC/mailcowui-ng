<script setup lang="ts">
// The app's two live regions (FR-078, FR-082). Rendered once, in App.vue.
import { liveMessages } from '../composables/useAnnouncer'
</script>

<template>
  <div class="sr-only">
    <div data-live="polite" role="status" aria-live="polite" aria-atomic="true">
      {{ liveMessages.polite.value }}
    </div>
    <div data-live="assertive" aria-live="assertive" aria-atomic="true">
      {{ liveMessages.assertive.value }}
    </div>
  </div>
</template>
