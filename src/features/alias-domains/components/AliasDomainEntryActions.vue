<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { AliasDomain } from '@/api'
import { lt } from '@/i18n'
import RowActions from '@/shared/components/RowActions.vue'
import RowAction from '@/shared/components/RowAction.vue'
import { TrashIcon } from '@/shared/icons'

defineProps<{ aliasDomain: AliasDomain }>()
const emit = defineEmits<{ delete: [aliasDomain: AliasDomain] }>()
const { t } = useI18n()
</script>

<template>
  <RowActions
    v-slot="{ menu }"
    :count="2"
    :label="t('lists.actionsFor', { name: aliasDomain.nameUnicode })"
  >
    <RowAction
      :menu="menu"
      :label="lt('mailbox.edit')"
      :to="{
        name: 'alias-domain-detail',
        params: { aliasDomain: aliasDomain.name },
        query: { edit: 'general' },
      }"
    />
    <RowAction
      :menu="menu"
      :label="lt('mailbox.remove')"
      destructive
      @select="emit('delete', aliasDomain)"
      ><TrashIcon />{{ lt('mailbox.remove') }}</RowAction
    >
  </RowActions>
</template>
