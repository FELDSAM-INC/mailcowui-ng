<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { MassMailPreviewRecipient } from '@/api'
import { useFormat } from '@/i18n/format'
import FormField from '@/shared/components/FormField.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
const props = defineProps<{
  data: MassMailPreviewRecipient[]
  total: number
  count: number
  page: number
  size: number
  q: string
}>()
const emit = defineEmits<{ change: [params: { page?: number; size?: number; q?: string }] }>()
const { t } = useI18n(),
  format = useFormat()
</script>
<template>
  <div class="space-y-4" data-recipient-preview>
    <p role="status" data-recipient-count>
      {{ t('systemSettings.massMail.count', { count: format.number(count) }, count) }}
    </p>
    <p v-if="!count">{{ t('systemSettings.massMail.zero') }}</p>
    <FormField id="mass-preview-search" :label="t('systemSettings.massMail.searchRecipients')"
      ><template #default="control"
        ><input
          v-bind="control"
          :value="q"
          type="search"
          class="form-control"
          @input="
            emit('change', { q: ($event.target as HTMLInputElement).value, page: 1 })
          " /></template
    ></FormField>
    <ul class="divide-y divide-gray-200 dark:divide-gray-800">
      <li
        v-for="entry in props.data"
        :key="entry.address"
        data-recipient
        class="py-2 wrap-anywhere"
      >
        {{ entry.address }}
      </li>
    </ul>
    <PaginationBar
      :total="total"
      :page="page"
      :size="size"
      @update:page="emit('change', { page: $event })"
      @update:size="emit('change', { size: $event, page: 1 })"
    />
  </div>
</template>
