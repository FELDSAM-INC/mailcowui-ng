<script setup lang="ts">
// The options of the classic alias forms, in their order: SOGo visible with its explanation (only
// with the groupware), internal and allowed to send, each with its explanation. The add form says
// `add.internal` and `add.sender_allowed`, the edit form `edit.internal` and `edit.sender_allowed`.
import { lt } from '@/i18n'

defineProps<{
  idPrefix: string
  mode: 'add' | 'edit'
  groupwareEnabled: boolean | undefined
  groupwareVisible: boolean
  internal: boolean
  senderAllowed: boolean
}>()
const emit = defineEmits<{
  'update:groupwareVisible': [value: boolean]
  'update:internal': [value: boolean]
  'update:senderAllowed': [value: boolean]
}>()

const checked = (event: Event) => (event.target as HTMLInputElement).checked
const LABEL = 'inline-flex min-h-11 items-center gap-3 text-gray-800 dark:text-gray-200'
const INFO = 'text-sm text-gray-600 dark:text-gray-400'
</script>

<template>
  <div class="flex flex-col gap-1">
    <template v-if="groupwareEnabled">
      <label :class="LABEL">
        <input
          :id="`${idPrefix}-groupwareVisible`"
          type="checkbox"
          class="size-5 accent-accent"
          :checked="groupwareVisible"
          :aria-describedby="`${idPrefix}-groupwareVisible-info`"
          @change="emit('update:groupwareVisible', checked($event))"
        />
        {{ lt('edit.sogo_visible') }}
      </label>
      <p :id="`${idPrefix}-groupwareVisible-info`" :class="INFO" class="mb-2">
        {{ lt('edit.sogo_visible_info') }}
      </p>
    </template>
    <label :class="LABEL">
      <input
        :id="`${idPrefix}-internal`"
        type="checkbox"
        class="size-5 accent-accent"
        :checked="internal"
        :aria-describedby="`${idPrefix}-internal-info`"
        @change="emit('update:internal', checked($event))"
      />
      {{ mode === 'add' ? lt('add.internal') : lt('edit.internal') }}
    </label>
    <p :id="`${idPrefix}-internal-info`" :class="INFO" class="mb-2">
      {{ lt('edit.internal_info') }}
    </p>
    <label :class="LABEL">
      <input
        :id="`${idPrefix}-senderAllowed`"
        type="checkbox"
        class="size-5 accent-accent"
        :checked="senderAllowed"
        :aria-describedby="`${idPrefix}-senderAllowed-info`"
        @change="emit('update:senderAllowed', checked($event))"
      />
      {{ mode === 'add' ? lt('add.sender_allowed') : lt('edit.sender_allowed') }}
    </label>
    <p :id="`${idPrefix}-senderAllowed-info`" :class="INFO">
      {{ lt('edit.sender_allowed_info') }}
    </p>
  </div>
</template>
