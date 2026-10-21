<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { lt } from '@/i18n'
import type { Oauth2Client } from '@/api'
import RowActions from '@/shared/components/RowActions.vue'
import RowAction from '@/shared/components/RowAction.vue'
import { TrashIcon } from '@/shared/icons'

defineProps<{ client: Oauth2Client }>()
const emit = defineEmits<{ delete: [client: Oauth2Client] }>()
const { t } = useI18n()
</script>

<template>
  <RowActions
    v-slot="{ menu }"
    :count="2"
    :label="t('lists.actionsFor', { name: client.clientId })"
  >
    <RowAction
      :menu="menu"
      :label="`${lt('admin.edit')}: ${client.clientId}`"
      :to="{ name: 'oauth2-client-detail', params: { oauth2ClientId: client.id } }"
      >{{ lt('admin.edit') }}</RowAction
    >
    <RowAction
      :menu="menu"
      :label="`${lt('admin.remove')}: ${client.clientId}`"
      destructive
      @select="emit('delete', client)"
      ><TrashIcon />{{ lt('admin.remove') }}</RowAction
    >
  </RowActions>
</template>
