<script setup lang="ts">
// The actions of a template entry, as in the classic list: Edit, and Remove for every template
// but Default. Domain administrators get none (FR-063); the template's name opens its values.
import { RouterLink } from 'vue-router'

import { lt } from '@/i18n'
import { TrashIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import type { MailboxTemplate } from '../../types'

defineProps<{ template: MailboxTemplate }>()
const emit = defineEmits<{ delete: [template: MailboxTemplate] }>()
</script>

<template>
  <div class="flex flex-wrap justify-end gap-2">
    <RouterLink
      :to="{ name: 'mailbox-template-detail', params: { templateId: template.id } }"
      :class="buttonVariants({ variant: 'outline', size: 'sm' })"
      :aria-label="`${lt('mailbox.edit')}: ${template.name}`"
    >
      {{ lt('mailbox.edit') }}
    </RouterLink>
    <button
      v-if="!template.isDefault"
      type="button"
      :class="buttonVariants({ variant: 'destructive', size: 'sm' })"
      :aria-label="`${lt('mailbox.remove')}: ${template.name}`"
      @click="emit('delete', template)"
    >
      <TrashIcon />
      {{ lt('mailbox.remove') }}
    </button>
  </div>
</template>
