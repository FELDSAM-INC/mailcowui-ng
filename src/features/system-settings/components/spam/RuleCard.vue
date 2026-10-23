<script setup lang="ts">
import DataCard from '@/shared/components/DataCard.vue'
import DataCardFields from '@/shared/components/DataCardFields.vue'
import YesNoMark from '@/shared/components/YesNoMark.vue'
import RowAction from '@/shared/components/RowAction.vue'
import RowActions from '@/shared/components/RowActions.vue'

import { useI18n } from 'vue-i18n'
import type { RspamdSettingsRule } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import PlainText from '@/shared/components/PlainText.vue'
defineProps<{ item: RspamdSettingsRule; busy: boolean }>()
defineEmits<{ remove: [] }>()
const { t } = useI18n(),
  format = useFormat()
</script>
<template>
  <DataCard
    as="article"
    :data-rule-id="item.id"
    :title="item.description"
    :to="{ name: 'rspamd-rule-detail', params: { ruleId: item.id } }"
  >
    <template #title><PlainText :value="item.description" /></template>
    <template #actions>
      <RowActions
        v-slot="{ menu }"
        :count="2"
        :label="`${lt('mailbox.action')}: ${item.description}`"
      >
        <RowAction
          :menu="menu"
          :to="{ name: 'rspamd-rule-detail', params: { ruleId: item.id } }"
          :label="lt('mailbox.edit')"
          :aria-label="`${lt('mailbox.edit')}: ${item.description}`"
        />
        <RowAction
          :menu="menu"
          :disabled="busy"
          destructive
          :label="lt('mailbox.remove')"
          :aria-label="`${lt('mailbox.remove')}: ${item.description}`"
          @select="$emit('remove')"
        />
      </RowActions>
    </template>
    <DataCardFields>
      <div>
        <dt class="font-medium">{{ t('lists.id') }}</dt>
        <dd>{{ item.id }}</dd>
      </div>

      <div>
        <dt class="font-medium">{{ lt('admin.active') }}</dt>
        <dd><YesNoMark :value="item.active" /></dd>
      </div>
      <div>
        <dt class="font-medium">{{ lt('mailbox.created_on') }}</dt>
        <dd>{{ format.dateTime(item.createdAt) }}</dd>
      </div>
      <div>
        <dt class="font-medium">{{ lt('mailbox.last_modified') }}</dt>
        <dd>{{ item.modifiedAt ? format.dateTime(item.modifiedAt) : '—' }}</dd>
      </div>
    </DataCardFields>
  </DataCard>
</template>
