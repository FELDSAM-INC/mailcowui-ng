<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { lt } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'
import FormField from '@/shared/components/FormField.vue'
import DomainPicker from '@/shared/components/DomainPicker.vue'
import { domainPickerSource } from '@/features/aliases-common'
import { syncFieldLabels, syncFieldHelp } from '../sync-field-labels'
import type { IdentitySyncSettings } from '../synchronisation-api'
import type { SyncSetting } from '../sync-form'
import SwitchField from './SwitchField.vue'
import TextField from './TextField.vue'
import { INPUT } from './styles'

const form = defineModel<IdentitySyncSettings>({ required: true })
withDefaults(
  defineProps<{
    fields: SyncSetting[]
    idPrefix?: string
    errorsFor: (path: string) => string[]
  }>(),
  { idPrefix: 'identity-sync' },
)
const { t } = useI18n()
const switches = ['offboarding', 'groupSync', 'groupAutocreate'] as const
const textFields = [
  'idAttribute',
  'disabledFilter',
  'groupBaseDn',
  'groupFilter',
  'groupNameAttribute',
  'groupMemberAttribute',
] as const
const description = (key: SyncSetting) =>
  syncFieldHelp[key] ? lt(syncFieldHelp[key]) : t(`identitySync.help.${key}`)
// Keep separators while typing; normalize only the model sent to the API.
const splitPaths = (value: string) =>
  value
    .split(',')
    .map((path) => path.trim())
    .filter(Boolean)
const pathsText = ref(form.value.groupPaths.join(', '))
watch(pathsText, (text) => {
  form.value.groupPaths = splitPaths(text)
})
watch(
  () => form.value.groupPaths,
  (paths) => {
    if (JSON.stringify(paths) !== JSON.stringify(splitPaths(pathsText.value)))
      pathsText.value = paths.join(', ')
  },
)
</script>

<template>
  <div class="grid min-w-0 gap-4 md:grid-cols-2">
    <template v-for="key in fields" :key="key">
      <div v-if="switches.includes(key as (typeof switches)[number])" class="md:col-span-2">
        <SwitchField
          :id="`${idPrefix}-${key}`"
          :model-value="form[key] as boolean"
          :help="syncFieldHelp[key]"
          :label="lt(syncFieldLabels[key])"
          @update:model-value="form[key as (typeof switches)[number]] = $event"
        />
      </div>
      <TextField
        v-else-if="key === 'offboardingLimit'"
        :id="`${idPrefix}-offboardingLimit`"
        :model-value="Number.isFinite(form.offboardingLimit) ? String(form.offboardingLimit) : ''"
        type="number"
        :min="0"
        :max="100"
        :label="lt(syncFieldLabels.offboardingLimit)"
        :description="description(key)"
        :errors="errorsFor(key)"
        @update:model-value="
          form.offboardingLimit = $event.trim() === '' ? Number.NaN : Number($event)
        "
      />
      <div v-else-if="key === 'groupDefaultDomain'" class="min-w-0">
        <DomainPicker
          :id="`${idPrefix}-groupDefaultDomain`"
          :label="lt(syncFieldLabels.groupDefaultDomain)"
          :sources="[domainPickerSource()]"
          :model-value="form.groupDefaultDomain"
          :errors="errorsFor(key)"
          @update:model-value="form.groupDefaultDomain = typeof $event === 'string' ? $event : ''"
        />
        <p class="mt-1 text-sm text-muted">{{ description(key) }}</p>
      </div>
      <FormField
        v-else-if="key === 'groupMemberMode'"
        :id="`${idPrefix}-groupMemberMode`"
        :label="lt(syncFieldLabels.groupMemberMode)"
        :errors="errorsFor(key)"
      >
        <template #default="control"
          ><select v-bind="control" v-model="form.groupMemberMode" :class="INPUT">
            <option
              v-for="mode in ['memberof', 'member', 'ad_chain'] as const"
              :key="mode"
              :value="mode"
            >
              {{ lt(`admin.iam_group_member_mode_${mode}`) }}
            </option>
          </select></template
        >
      </FormField>
      <div v-else-if="key === 'groupPaths'">
        <TextField
          :id="`${idPrefix}-groupPaths`"
          v-model="pathsText"
          :label="lt(syncFieldLabels.groupPaths)"
          :description="t('identitySync.pathsHelp')"
          :errors="errorsFor(key)"
          placeholder="/mailcow/*"
        />
        <LegacyText k="admin.iam_group_paths_info" as="p" class="mt-1 text-sm text-muted" />
      </div>
      <TextField
        v-else
        :id="`${idPrefix}-${key}`"
        v-model="form[key as (typeof textFields)[number]]"
        :label="lt(syncFieldLabels[key])"
        :errors="errorsFor(key)"
        :description="description(key)"
      />
    </template>
  </div>
</template>
