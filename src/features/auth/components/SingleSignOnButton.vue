<script setup lang="ts">
// The single sign-on action (UI 012 FR-040, FR-043): the classic login page's button text
// (`admin.iam_sso`), full width, secondary as in the classic interface, and busy until the browser
// leaves for the provider, so a second tap starts nothing.
import { lt } from '@/i18n'
import { ExternalLinkIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

defineProps<{ pending: boolean }>()
defineEmits<{ start: [] }>()
</script>

<template>
  <button
    type="button"
    data-sso
    :class="buttonVariants({ variant: 'outline', class: 'w-full' })"
    :disabled="pending"
    :aria-busy="pending ? 'true' : 'false'"
    @click="$emit('start')"
  >
    <ExternalLinkIcon class="size-5" />
    {{ lt('admin.iam_sso') }}
  </button>
</template>
