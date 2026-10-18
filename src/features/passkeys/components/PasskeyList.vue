<script setup lang="ts">
// The list of the account's passkeys, newest first (FR-052).
import type { Passkey } from '@/api'

import PasskeyCard from './PasskeyCard.vue'

defineProps<{ passkeys: Passkey[]; total: number }>()
defineEmits<{ rename: [passkey: Passkey]; remove: [passkey: Passkey] }>()
</script>

<template>
  <ul class="flex flex-col gap-3">
    <PasskeyCard
      v-for="passkey in passkeys"
      :key="passkey.id"
      :passkey="passkey"
      @rename="$emit('rename', $event)"
      @remove="$emit('remove', $event)"
    />
  </ul>
</template>
