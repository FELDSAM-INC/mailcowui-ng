<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Domain } from '@/api'
import { CheckDnsAction } from '@/features/dns'
import { lt } from '@/i18n'
import RowActions from '@/shared/components/RowActions.vue'
import RowAction from '@/shared/components/RowAction.vue'
import { PencilIcon, TrashIcon } from '@/shared/icons'
import { deletionAvailability } from '../../composables/useDomainDeletion'

const props = withDefaults(defineProps<{ domain: Domain; canDelete?: boolean }>(), {
  canDelete: true,
})
const emit = defineEmits<{ delete: [domain: Domain] }>()
const { t } = useI18n()
const availability = () => deletionAvailability(props.domain)
</script>

<template>
  <RowActions
    v-slot="{ menu }"
    :count="2 + Number(canDelete)"
    :label="t('lists.actionsFor', { name: domain.unicodeName })"
  >
    <RowAction
      :menu="menu"
      :label="lt('mailbox.edit')"
      :to="{ name: 'domain-detail', params: { domain: domain.name } }"
    >
      <PencilIcon />{{ lt('mailbox.edit') }}
    </RowAction>
    <CheckDnsAction :name="domain.name" :variant="menu ? 'menuItem' : 'button'" />
    <RowAction
      v-if="canDelete"
      :menu="menu"
      :label="lt('mailbox.remove')"
      :disabled="!availability().available"
      destructive
      @select="emit('delete', domain)"
    >
      <TrashIcon />
      <span class="flex flex-col">
        <span>{{ lt('mailbox.remove') }}</span>
        <span v-if="!availability().available" class="text-xs text-gray-600 dark:text-gray-400">
          {{
            t(
              'domains.delete.unavailable',
              availability() as { mailboxes: number; resources: number },
            )
          }}
        </span>
      </span>
    </RowAction>
  </RowActions>
</template>
