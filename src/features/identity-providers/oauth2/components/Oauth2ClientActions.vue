<script setup lang="ts">
// The row actions of the classic OAuth2 list (`admin.js`): Edit, which opens the client page, and
// Remove. Their accessible names carry the client ID.
import { RouterLink } from 'vue-router'

import { lt } from '@/i18n'
import type { Oauth2Client } from '@/api'
import { TrashIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

defineProps<{ client: Oauth2Client }>()
const emit = defineEmits<{ delete: [client: Oauth2Client] }>()
</script>

<template>
  <div class="flex flex-wrap justify-end gap-2">
    <RouterLink
      :to="{ name: 'oauth2-client-detail', params: { oauth2ClientId: client.id } }"
      :class="buttonVariants({ variant: 'outline', size: 'sm' })"
      :aria-label="`${lt('admin.edit')}: ${client.clientId}`"
    >
      {{ lt('admin.edit') }}
    </RouterLink>
    <button
      type="button"
      :class="buttonVariants({ variant: 'destructive', size: 'sm' })"
      :aria-label="`${lt('admin.remove')}: ${client.clientId}`"
      @click="emit('delete', client)"
    >
      <TrashIcon />
      {{ lt('admin.remove') }}
    </button>
  </div>
</template>
