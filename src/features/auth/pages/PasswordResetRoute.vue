<script setup lang="ts">
// A new link opened in this tab gets a fresh reset state and forgets the previous password.
// The global guard has already removed the token from the address before this update runs.
import { ref } from 'vue'
import { onBeforeRouteUpdate } from 'vue-router'

import PasswordResetPage from './PasswordResetPage.vue'

const revision = ref(0)
onBeforeRouteUpdate(() => {
  revision.value += 1
})
</script>

<template>
  <PasswordResetPage :key="revision" />
</template>
