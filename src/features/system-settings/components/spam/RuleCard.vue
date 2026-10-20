<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import type { RspamdSettingsRule } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import PlainText from '@/shared/components/PlainText.vue'
import { buttonVariants } from '@/shared/ui/button'
defineProps<{ item: RspamdSettingsRule; busy: boolean }>()
defineEmits<{ remove: [] }>()
const { t } = useI18n(),
  format = useFormat()
</script>
<template>
  <article
    :data-rule-id="item.id"
    class="surface min-w-0 space-y-3 text-sm text-gray-800 dark:text-gray-200"
  >
    <dl class="space-y-2">
      <div>
        <dt class="font-medium">{{ t('lists.id') }}</dt>
        <dd>{{ item.id }}</dd>
      </div>
      <div>
        <dt class="font-medium">{{ lt('admin.rsetting_desc') }}</dt>
        <dd class="wrap-anywhere"><PlainText :value="item.description" /></dd>
      </div>
      <div>
        <dt class="font-medium">{{ lt('admin.active') }}</dt>
        <dd>{{ lt(item.active ? 'mailbox.active' : 'mailbox.inactive') }}</dd>
      </div>
      <div>
        <dt class="font-medium">{{ lt('mailbox.created_on') }}</dt>
        <dd>{{ format.dateTime(item.createdAt) }}</dd>
      </div>
      <div>
        <dt class="font-medium">{{ lt('mailbox.last_modified') }}</dt>
        <dd>{{ item.modifiedAt ? format.dateTime(item.modifiedAt) : '—' }}</dd>
      </div>
    </dl>
    <div class="flex flex-wrap gap-2">
      <RouterLink
        :to="{ name: 'rspamd-rule-detail', params: { ruleId: item.id } }"
        :aria-label="`${lt('mailbox.edit')}: ${item.description}`"
        :class="buttonVariants({ variant: 'outline' })"
        >{{ lt('mailbox.edit') }}</RouterLink
      ><button
        type="button"
        :disabled="busy"
        :aria-label="`${lt('mailbox.remove')}: ${item.description}`"
        :class="buttonVariants({ variant: 'outline' })"
        @click="$emit('remove')"
      >
        {{ lt('mailbox.remove') }}
      </button>
    </div>
  </article>
</template>
