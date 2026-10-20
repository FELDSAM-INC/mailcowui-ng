<script setup lang="ts">
import { lt } from '@/i18n'
import DateTime from '@/shared/components/DateTime.vue'
import RelativeTime from '@/shared/components/RelativeTime.vue'
defineProps<{ expiresAt: string | null }>()
</script>
<template>
  <span v-if="expiresAt" class="flex flex-col gap-1"
    ><DateTime :value="expiresAt" /><span class="text-xs"
      >{{ lt('user.alias_time_left') }}: <RelativeTime :value="expiresAt" /></span
  ></span>
  <span v-else>{{ lt('user.forever') }}</span>
</template>
