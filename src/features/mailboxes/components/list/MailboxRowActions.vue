<script setup lang="ts">
// Legacy's row actions (`draw_mailbox_table`, `item.action`): "Edit" opens the mailbox and
// "Remove" starts its deletion (US4), side by side as legacy's button group. The address follows
// each label for assistive technology, so the actions of different rows are told apart. Later
// features add theirs (data-model §8).
import { RouterLink } from 'vue-router'

import { lt } from '@/i18n'
import { PencilIcon, TrashIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { readableAddress, type Mailbox } from '../../types'

withDefaults(defineProps<{ mailbox: Mailbox; removable?: boolean }>(), { removable: false })
const emit = defineEmits<{ remove: [mailbox: Mailbox, trigger: HTMLElement] }>()
</script>

<template>
  <div data-row-actions class="flex flex-wrap justify-end gap-2">
    <RouterLink
      :to="{ name: 'mailbox-detail', params: { address: mailbox.address } }"
      :class="buttonVariants({ variant: 'outline', size: 'sm' })"
    >
      <PencilIcon />
      {{ lt('mailbox.edit') }}
      <span class="sr-only">{{ readableAddress(mailbox) }}</span>
    </RouterLink>
    <button
      v-if="removable"
      type="button"
      :class="buttonVariants({ variant: 'destructive', size: 'sm' })"
      @click="emit('remove', mailbox, $event.currentTarget as HTMLElement)"
    >
      <TrashIcon />
      {{ lt('mailbox.remove') }}
      <span class="sr-only">{{ readableAddress(mailbox) }}</span>
    </button>
  </div>
</template>
