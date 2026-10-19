<script setup lang="ts">
// A checkbox of the classic forms (`form-check`): the legacy label and, beside it, its legacy help
// in small text. Locked by the caller's flags, it shows "Prohibited by ACL" with the permission.
import { computed } from 'vue'

import type { PermissionFlags } from '@/api'
import { lt, type LegacyArg, type LegacyKey } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'

import AclReadOnlyNote from '@/shared/components/AclReadOnlyNote.vue'

const props = withDefaults(
  defineProps<{
    id: string
    labelKey: LegacyKey
    helpKey?: LegacyKey
    helpArgs?: readonly LegacyArg[]
    modelValue: boolean
    disabled?: boolean
    /** The flag that locks the control, shown with "Prohibited by ACL". */
    lockedBy?: keyof PermissionFlags | null
  }>(),
  { helpKey: undefined, helpArgs: () => [], disabled: false, lockedBy: null },
)
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const describedBy = computed(
  () =>
    [props.helpKey ? `${props.id}-help` : null, props.lockedBy ? `${props.id}-acl` : null]
      .filter(Boolean)
      .join(' ') || undefined,
)
</script>

<template>
  <div class="flex flex-col">
    <label class="flex min-h-11 cursor-pointer items-center gap-3 text-gray-800 dark:text-gray-200">
      <input
        :id="id"
        type="checkbox"
        class="size-5 shrink-0 accent-brand-500 disabled:cursor-not-allowed"
        :checked="modelValue"
        :disabled="disabled || !!lockedBy"
        :aria-describedby="describedBy"
        @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      />
      <span>{{ lt(labelKey) }}</span>
    </label>
    <LegacyText
      v-if="helpKey"
      :id="`${id}-help`"
      :k="helpKey"
      :args="helpArgs"
      as="p"
      class="ms-8 text-sm text-gray-600 dark:text-gray-400"
    />
    <AclReadOnlyNote v-if="lockedBy" :id="`${id}-acl`" :flag="lockedBy" class="ms-8" />
  </div>
</template>
