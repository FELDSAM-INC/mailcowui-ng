<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, onScopeDispose } from 'vue'
import { useI18n } from 'vue-i18n'
import { problemOf, type Preset } from '@/api'
import { lt } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'
import ListState from '@/shared/components/ListState.vue'
import PlainText from '@/shared/components/PlainText.vue'
import { confirm } from '@/shared/composables/useConfirm'
import { buttonVariants } from '@/shared/ui/button'
import { presetsOptions } from '../../api/presets'
import { presetKey } from '../../lib/preset-key'
const props = defineProps<{ kind: 'rspamd' | 'sieve'; replace: boolean; disabled?: boolean }>()
const emit = defineEmits<{ select: [preset: Preset] }>()
const { t } = useI18n()
const query = useQuery(computed(() => presetsOptions(props.kind)))
const title = (preset: Preset) => {
  const key = presetKey(preset.translationKey)
  return key ? lt(key) : preset.headline
}
let disposed = false
onScopeDispose(() => {
  disposed = true
})
async function insert(preset: Preset) {
  if (props.disabled || disposed) return
  if (
    props.replace &&
    !(await confirm({
      title: t('systemSettings.rules.replaceTitle'),
      description: `${lt(props.kind === 'rspamd' ? 'admin.rsettings_insert_preset' : 'mailbox.insert_preset', title(preset))}. ${t('systemSettings.rules.replaceBody')}`,
      confirmLabel: lt('quarantine.confirm'),
    }))
  )
    return
  if (!disposed && !props.disabled) emit('select', { ...preset, headline: title(preset) })
}
</script>
<template>
  <section class="min-w-0 space-y-3" data-preset-picker>
    <LegacyText
      :k="kind === 'rspamd' ? 'admin.rspamd_com_settings' : 'mailbox.sieve_preset_header'"
      as="p"
      class="text-sm text-gray-700 dark:text-gray-300"
    />
    <ListState
      :loading="query.isPending.value"
      :empty="!query.data.value?.length"
      :problem="problemOf(query.error.value)"
      @retry="query.refetch()"
    >
      <div
        v-for="preset in query.data.value"
        :key="preset.id"
        :data-preset="preset.id"
        class="surface min-w-0 space-y-2"
      >
        <button
          type="button"
          :disabled="disabled"
          :class="
            buttonVariants({
              variant: 'outline',
              class: 'h-auto min-h-11 min-w-0 max-w-full whitespace-normal text-start break-words',
            })
          "
          @click="insert(preset)"
        >
          {{
            lt(
              kind === 'rspamd' ? 'admin.rsettings_insert_preset' : 'mailbox.insert_preset',
              title(preset),
            )
          }}
        </button>
        <details>
          <summary class="min-h-11 cursor-pointer py-3 text-sm">
            <PlainText :value="title(preset)" />
          </summary>
          <pre
            class="max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono text-sm text-gray-800 dark:text-gray-200"
            >{{ preset.content }}</pre>
        </details>
      </div>
    </ListState>
  </section>
</template>
