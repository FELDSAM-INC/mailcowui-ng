<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Role, SyncJob } from '@/api'
import { resolveText } from '@/i18n'
import RowActions from '@/shared/components/RowActions.vue'
import RowAction from '@/shared/components/RowAction.vue'
import { TrashIcon } from '@/shared/icons'
import { jobLabel, listTexts } from '../presentation'

defineProps<{ job: SyncJob; role: Role; canRemove?: boolean; canOpenLog?: boolean }>()
const emit = defineEmits<{ remove: [job: SyncJob]; openLog: [job: SyncJob] }>()
const { t } = useI18n()
</script>

<template>
  <RowActions
    v-slot="{ menu }"
    :count="1 + Number(!!canRemove) + Number(!!canOpenLog)"
    :label="t('syncJobs.list.actionsFor', { name: jobLabel(job) })"
  >
    <RowAction
      :menu="menu"
      :label="resolveText(listTexts(role).edit, t)"
      :to="`/sync-jobs/${job.id}`"
    />
    <RowAction
      v-if="canOpenLog"
      :menu="menu"
      :label="resolveText(listTexts(role).openLogs, t)"
      @select="emit('openLog', job)"
    />
    <RowAction
      v-if="canRemove"
      :menu="menu"
      :label="resolveText(listTexts(role).remove, t)"
      destructive
      @select="emit('remove', job)"
      ><TrashIcon />{{ resolveText(listTexts(role).remove, t) }}</RowAction
    >
  </RowActions>
</template>
