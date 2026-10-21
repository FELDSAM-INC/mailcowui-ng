<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { lt } from '@/i18n'
import type { MailboxTemplate } from '../../types'
import RowActions from '@/shared/components/RowActions.vue'
import RowAction from '@/shared/components/RowAction.vue'
import { TrashIcon } from '@/shared/icons'

defineProps<{ template: MailboxTemplate }>()
const emit = defineEmits<{ delete: [template: MailboxTemplate] }>()
const { t } = useI18n()
</script>

<template>
  <RowActions
    v-slot="{ menu }"
    :count="template.isDefault ? 1 : 2"
    :label="t('lists.actionsFor', { name: template.name })"
  >
    <RowAction
      :menu="menu"
      :label="`${lt('mailbox.edit')}: ${template.name}`"
      :to="{ name: 'mailbox-template-detail', params: { templateId: template.id } }"
      >{{ lt('mailbox.edit') }}</RowAction
    >
    <RowAction
      v-if="!template.isDefault"
      :menu="menu"
      :label="`${lt('mailbox.remove')}: ${template.name}`"
      destructive
      @select="emit('delete', template)"
      ><TrashIcon />{{ lt('mailbox.remove') }}</RowAction
    >
  </RowActions>
</template>
