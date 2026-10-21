<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Alias } from '@/api'
import { lt } from '@/i18n'
import RowActions from '@/shared/components/RowActions.vue'
import RowAction from '@/shared/components/RowAction.vue'
import { TrashIcon } from '@/shared/icons'

defineProps<{ alias: Alias }>()
const emit = defineEmits<{ delete: [alias: Alias]; copy: [alias: Alias] }>()
const { t } = useI18n()
</script>

<template>
  <RowActions
    v-slot="{ menu }"
    :count="!alias.inAliasDomain && !alias.orphaned ? 3 : 2"
    :label="t('lists.actionsFor', { name: alias.addressUnicode })"
  >
    <RowAction
      :menu="menu"
      :label="lt('mailbox.edit')"
      :to="{ name: 'alias-detail', params: { aliasId: alias.id }, query: { edit: 'alias' } }"
    />
    <RowAction
      v-if="!alias.inAliasDomain && !alias.orphaned"
      :menu="menu"
      :label="lt('mailbox.add_alias_expand')"
      @select="emit('copy', alias)"
    />
    <RowAction
      :menu="menu"
      :label="lt('mailbox.remove')"
      destructive
      @select="emit('delete', alias)"
      ><TrashIcon />{{ lt('mailbox.remove') }}</RowAction
    >
  </RowActions>
</template>
