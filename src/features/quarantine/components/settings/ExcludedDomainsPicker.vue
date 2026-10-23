<script setup lang="ts">
import TagChip from '@/shared/components/TagChip.vue'

// The excluded domains of the quarantine settings (UI 006 FR-062, legacy form map screen 8 row 10,
// D17): legacy's searchable multi-select `admin.quarantine_exclude_domains` (placeholder
// `tfa.select`) over the server's domains and alias domains, searched and paged by the server.
// The chosen names are removable chips; a stored entry whose domain no longer exists is flagged
// `quarantineUi.settings.missingDomain` and can be kept or removed. It is never offered again,
// because the picker only lists names that exist.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { aliasDomainPickerSource, domainPickerSource } from '@/features/aliases-common'
import { lt } from '@/i18n'
import DomainPicker, { type DomainPickerOption } from '@/shared/components/DomainPicker.vue'

const props = withDefaults(
  defineProps<{
    id: string
    modelValue: readonly string[]
    /** Chosen names that are no longer a domain or alias domain. */
    missing?: readonly string[]
    errors?: readonly string[]
  }>(),
  { missing: () => [], errors: () => [] },
)
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
const { t } = useI18n()

const sources = [domainPickerSource(), aliasDomainPickerSource()]
/** Readable names of picked options (ASCII name → readable name). */
const labels = ref<Record<string, string>>({})
const readable = (name: string) => labels.value[name] ?? name
const isMissing = (name: string) => props.missing.includes(name.toLowerCase())

function remember(option: DomainPickerOption) {
  labels.value = { ...labels.value, [option.name]: option.nameUnicode }
}

function update(next: string | null | string[]) {
  emit('update:modelValue', Array.isArray(next) ? next : next ? [next] : [])
}

function remove(name: string) {
  emit(
    'update:modelValue',
    props.modelValue.filter((item) => item !== name),
  )
}
</script>

<template>
  <div class="flex flex-col gap-2" data-excluded-domains>
    <DomainPicker
      :id="id"
      :label="lt('admin.quarantine_exclude_domains')"
      :sources="sources"
      :model-value="modelValue"
      :labels="labels"
      :errors="errors"
      :placeholder="lt('tfa.select')"
      multiple
      hide-chips
      @update:model-value="update"
      @pick="remember"
    />
    <ul v-if="modelValue.length > 0" class="flex flex-wrap gap-2" data-excluded-chips>
      <li
        v-for="name in modelValue"
        :key="name"
        :data-missing="isMissing(name) ? '' : undefined"
        class="min-w-0 max-w-full"
      >
        <TagChip
          removable
          :color="isMissing(name) ? 'warning' : 'gray'"
          :aria-label="t('pickers.remove', { name: readable(name) })"
          @click="remove(name)"
        >
          {{ readable(name)
          }}<span v-if="isMissing(name)"> ({{ t('quarantineUi.settings.missingDomain') }})</span>
        </TagChip>
      </li>
    </ul>
  </div>
</template>
