<script setup lang="ts">
// The actions of a template entry, as in the classic list: Edit, and Remove for every template
// but Default (FR-053, FR-055).
import { RouterLink } from 'vue-router'

import { lt } from '@/i18n'
import type { DomainTemplate } from '@/api'
import { TrashIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

defineProps<{ template: DomainTemplate }>()
const emit = defineEmits<{ delete: [template: DomainTemplate] }>()
</script>

<template>
  <div class="flex flex-wrap justify-end gap-2">
    <RouterLink
      :to="{ name: 'domain-template-detail', params: { templateId: template.id } }"
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
