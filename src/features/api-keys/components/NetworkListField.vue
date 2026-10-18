<script setup lang="ts">
// The allowed networks of a new key (FR-065): up to 100 entries, each an IPv4 or IPv6 address or
// prefix; no entries means any address. Each entry is a labelled field whose ID follows the API's
// field path (`allowedNetworks.2` is `<idPrefix>-2`), so client and server errors land on it.
import { nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

import FormField from '@/shared/components/FormField.vue'
import { CloseIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'
import { ALLOWED_NETWORKS_MAX_ITEMS, NETWORK_MAX_LENGTH } from '@/shared/validation/limits'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    idPrefix: string
    errorsFor: (path: string) => string[]
    max?: number
  }>(),
  { max: ALLOWED_NETWORKS_MAX_ITEMS },
)
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
const { t } = useI18n()

const entryId = (index: number) => `${props.idPrefix}-${index}`

async function add() {
  if (props.modelValue.length >= props.max) return
  emit('update:modelValue', [...props.modelValue, ''])
  await nextTick()
  document.getElementById(entryId(props.modelValue.length - 1))?.focus()
}

async function remove(index: number) {
  const next = props.modelValue.filter((_, position) => position !== index)
  emit('update:modelValue', next)
  await nextTick()
  const target =
    next.length > 0 ? entryId(Math.min(index, next.length - 1)) : `${props.idPrefix}-add`
  document.getElementById(target)?.focus()
}

function update(index: number, value: string) {
  emit(
    'update:modelValue',
    props.modelValue.map((entry, position) => (position === index ? value : entry)),
  )
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-for="(entry, index) in modelValue" :key="index" class="flex items-start gap-2">
      <div class="min-w-0 flex-1">
        <FormField
          :id="entryId(index)"
          v-slot="field"
          :label="t('apiKeys.networks.entry', { number: index + 1 })"
          :errors="errorsFor(`allowedNetworks.${index}`)"
        >
          <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- labelled by FormField (for/id) -->
          <input
            v-bind="field"
            :value="entry"
            type="text"
            inputmode="text"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
            :maxlength="NETWORK_MAX_LENGTH"
            class="form-control font-mono"
            @input="update(index, ($event.target as HTMLInputElement).value)"
          />
        </FormField>
      </div>
      <button
        type="button"
        :class="buttonVariants({ variant: 'outline', size: 'icon', class: 'mt-7' })"
        :aria-label="t('apiKeys.networks.remove', { number: index + 1 })"
        @click="remove(index)"
      >
        <CloseIcon class="size-5" />
      </button>
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <button
        :id="`${idPrefix}-add`"
        type="button"
        data-add
        :class="buttonVariants({ variant: 'outline' })"
        :disabled="modelValue.length >= max"
        @click="add"
      >
        {{ t('apiKeys.networks.add') }}
      </button>
      <p v-if="modelValue.length >= max" class="text-sm text-gray-700 dark:text-gray-300">
        {{ t('apiKeys.networks.limit', { max }) }}
      </p>
    </div>
    <p
      v-for="(message, index) in errorsFor('allowedNetworks')"
      :key="index"
      class="text-sm text-red-700 dark:text-red-300"
    >
      {{ message }}
    </p>
  </div>
</template>
