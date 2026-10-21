<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Resource } from '@/api'
import { lt } from '@/i18n'
import RowActions from '@/shared/components/RowActions.vue'
import RowAction from '@/shared/components/RowAction.vue'
import { TrashIcon } from '@/shared/icons'

defineProps<{ resource: Resource }>()
const emit = defineEmits<{ delete: [resource: Resource] }>()
const { t } = useI18n()
</script>

<template>
  <RowActions
    v-slot="{ menu }"
    :count="2"
    :label="t('lists.actionsFor', { name: resource.description })"
  >
    <RowAction
      :menu="menu"
      :label="lt('mailbox.edit')"
      :to="{
        name: 'resource-detail',
        params: { resourceAddress: resource.address },
        query: { edit: 'resource' },
      }"
    />
    <RowAction
      :menu="menu"
      :label="lt('mailbox.remove')"
      destructive
      @select="emit('delete', resource)"
      ><TrashIcon />{{ lt('mailbox.remove') }}</RowAction
    >
  </RowActions>
</template>
