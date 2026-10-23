<script setup lang="ts">
import { lt } from '@/i18n'
import { SyncIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'
defineProps<{ pending?: boolean; disabled?: boolean }>()
defineEmits<{ refresh: [] }>()
</script>

<template>
  <button
    type="button"
    data-refresh
    :class="buttonVariants({ variant: 'outline' })"
    :disabled="pending || disabled"
    @click="$emit('refresh')"
  >
    <SyncIcon :class="pending ? 'motion-safe:animate-spin' : ''" />
    {{ lt('admin.refresh') }}
  </button>
</template>
