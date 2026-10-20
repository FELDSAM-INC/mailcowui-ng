<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import { lt } from '@/i18n'
import { buttonVariants } from '@/shared/ui/button'
defineProps<{ address: string }>()
const router = useRouter()
</script>
<template>
  <RouterLink
    v-if="router.hasRoute('mailbox-app-passwords')"
    :to="{ name: 'mailbox-app-passwords', params: { address } }"
    :class="buttonVariants({ variant: 'outline' })"
    >{{ lt('user.app_passwds') }}</RouterLink
  >
</template>
