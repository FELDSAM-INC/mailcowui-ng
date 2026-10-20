<script setup lang="ts">
// The fields of the classic sync job forms, in their order (plan legacy form map): the add modals'
// labels on the create page and the edit page's on the job page, the ranges of the number fields as
// the classic forms show them under the field ("1-43800", from the capabilities, FR-021), the
// encryption as a select, the checkboxes with their imapsync option, and the custom parameters
// hidden (create) or read-only with the reason (job page) when the caller may not set them
// (FR-056). The port follows the encryption until it is typed into (FR-019). The owner, which only
// the create page has, comes through the `owner` slot.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Role, SyncJobCapabilities, SyncJobEncryption } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import FormField from '@/shared/components/FormField.vue'

import { fieldLabel, type FormMode } from '../field-labels'
import {
  BOOLEAN_FIELDS,
  maxLengthOf,
  nextPort,
  NUMBER_FIELDS,
  OPTION_NAMES,
  rangeOf,
  type NumberField,
  type SyncJobFormValues,
  type TextField,
} from '../form-model'
import FieldLabel from './FieldLabel.vue'
import RemotePasswordField from './RemotePasswordField.vue'

const props = withDefaults(
  defineProps<{
    mode: FormMode
    idPrefix: string
    caps: SyncJobCapabilities
    role: Role
    customParamsAllowed: boolean
    passwordSet?: boolean
    errorsFor: (path: string) => readonly string[]
  }>(),
  { passwordSet: false },
)
const values = defineModel<SyncJobFormValues>('values', { required: true })
const { t } = useI18n()
const fmt = useFormat()

const id = (field: string) => `${props.idPrefix}-${field}`
const label = (field: Parameters<typeof fieldLabel>[1]) => fieldLabel(props.mode, field)

// FR-019: the port follows the encryption until the user types into it, within this form.
const portTouched = ref(false)
watch(
  () => values.value,
  () => (portTouched.value = false),
)
function onEncryption(event: Event) {
  const to = (event.target as HTMLSelectElement).value as SyncJobEncryption
  values.value.remotePort = nextPort({
    port: values.value.remotePort,
    from: values.value.encryption,
    to,
    touched: portTouched.value,
  })
  values.value.encryption = to
}

/** The classic range hint, "min-max", with the capabilities' numbers. */
function range(field: NumberField): string | undefined {
  // The classic edit page shows no range under the port.
  if (field === 'remotePort' && props.mode === 'edit') return undefined
  const { minimum, maximum } = rangeOf(props.caps, field)
  return `${fmt.number(minimum, { useGrouping: false })}-${fmt.number(maximum, { useGrouping: false })}`
}

const TEXT_ATTRS = { autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false' } as const
const INPUT =
  'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-red-500 read-only:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:read-only:bg-gray-950'

// On the create page the field stays while it holds a value the server has just refused, so the
// refusal is shown on it (FR-056); the body leaves the value out once it is not allowed.
const showCustomParams = computed(
  () => props.mode === 'edit' || props.customParamsAllowed || values.value.customParameters !== '',
)
const customParamsPlaceholder = computed(() =>
  props.role === 'mailboxUser' && props.mode === 'create'
    ? '--delete2folders --otheroption'
    : '--some-param=xy --other-param=yx',
)
const customParamsHint = computed(() => {
  if (!props.customParamsAllowed) return t('syncJobs.form.customParamsRestricted')
  // The mailbox user's add modal has no hint.
  return props.role === 'mailboxUser' && props.mode === 'create'
    ? undefined
    : lt('add.custom_params_hint')
})

const isNumber = (field: string): field is NumberField =>
  (NUMBER_FIELDS as readonly string[]).includes(field)
const ORDERED_BEFORE_PASSWORD = ['remoteHost', 'remotePort', 'remoteUser'] as const
const ORDERED_AFTER_ENCRYPTION = [
  'intervalMinutes',
  'destinationSubfolder',
  'maxAgeDays',
  'maxBytesPerSecond',
  'remoteTimeoutSeconds',
  'localTimeoutSeconds',
  'exclude',
] as const
const required = (field: string) =>
  props.mode === 'create' && ['remoteHost', 'remotePort', 'remoteUser'].includes(field)
</script>

<template>
  <div class="flex flex-col gap-4">
    <slot name="owner" />
    <template v-for="field in ORDERED_BEFORE_PASSWORD" :key="field">
      <FormField
        :id="id(field)"
        :label="''"
        :description="isNumber(field) ? range(field) : undefined"
        :errors="errorsFor(field)"
        :required="required(field)"
      >
        <template #label><FieldLabel :text="label(field)" /></template>
        <template #default="control">
          <input
            v-if="isNumber(field)"
            v-bind="control"
            v-model="values[field]"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            :class="INPUT"
            @input="field === 'remotePort' && (portTouched = true)"
          />
          <input
            v-else
            v-bind="{ ...control, ...TEXT_ATTRS }"
            v-model="values[field]"
            type="text"
            :name="`${idPrefix}-${field}`"
            autocomplete="off"
            :maxlength="maxLengthOf(caps, field as TextField)"
            :class="INPUT"
          />
        </template>
      </FormField>
    </template>
    <RemotePasswordField
      :id="id('remotePassword')"
      v-model="values.remotePassword"
      :label="label('remotePassword')"
      :mode="mode"
      :password-set="passwordSet"
      :max-length="maxLengthOf(caps, 'remotePassword')"
      :errors="errorsFor('remotePassword')"
    />
    <FormField :id="id('encryption')" :label="''" :errors="errorsFor('encryption')">
      <template #label><FieldLabel :text="label('encryption')" /></template>
      <template #default="control">
        <select v-bind="control" :value="values.encryption" :class="INPUT" @change="onEncryption">
          <option v-for="value in caps.encryptions" :key="value" :value="value">
            {{ t(`enums.syncJobEncryption.${value}`) }}
          </option>
        </select>
      </template>
    </FormField>
    <template v-for="field in ORDERED_AFTER_ENCRYPTION" :key="field">
      <FormField
        :id="id(field)"
        :label="''"
        :description="isNumber(field) ? range(field) : undefined"
        :errors="errorsFor(field)"
      >
        <template #label><FieldLabel :text="label(field)" /></template>
        <template #default="control">
          <input
            v-if="isNumber(field)"
            v-bind="control"
            v-model="values[field]"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            :class="INPUT"
          />
          <input
            v-else
            v-bind="{ ...control, ...TEXT_ATTRS }"
            v-model="values[field]"
            type="text"
            autocomplete="off"
            :maxlength="maxLengthOf(caps, field as TextField)"
            :class="INPUT"
          />
        </template>
      </FormField>
    </template>
    <FormField
      v-if="showCustomParams"
      :id="id('customParameters')"
      :label="''"
      :description="customParamsHint"
      :errors="errorsFor('customParameters')"
    >
      <template #label><FieldLabel :text="label('customParameters')" /></template>
      <template #default="control">
        <input
          v-bind="{ ...control, ...TEXT_ATTRS }"
          v-model="values.customParameters"
          type="text"
          autocomplete="off"
          :readonly="mode === 'edit' && !customParamsAllowed"
          :placeholder="customParamsPlaceholder"
          :maxlength="maxLengthOf(caps, 'customParameters')"
          :class="INPUT"
        />
      </template>
    </FormField>
    <div class="flex flex-col">
      <label
        v-for="field in BOOLEAN_FIELDS"
        :key="field"
        class="flex min-h-11 cursor-pointer items-center gap-3 text-gray-800 dark:text-gray-200"
      >
        <input
          :id="id(field)"
          v-model="values[field]"
          type="checkbox"
          class="size-5 shrink-0 accent-accent"
        />
        <span class="min-w-0 wrap-anywhere">
          <FieldLabel :text="label(field)" :option="OPTION_NAMES[field]" />
        </span>
      </label>
    </div>
  </div>
</template>
