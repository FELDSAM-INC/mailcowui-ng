<script setup lang="ts">
// The remote password (research R12, FR-029 to FR-035): masked, with a reveal toggle that has a
// name and a pressed state; protected from the browser's and password managers' autofill and from
// being offered for saving as this site's sign-in; masked again when the form closes. The value
// lives in the form's component state only and is never stored, cached or put in the address.
// On the job page the field starts empty and says whether a password is saved (conventions
// "Secrets"); an empty field keeps it.
import { onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LegacyRef } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'
import { EyeIcon, EyeOffIcon } from '@/shared/icons'

import FieldLabel from './FieldLabel.vue'

const props = defineProps<{
  id: string
  label: LegacyRef
  mode: 'create' | 'edit'
  /** On the job page: whether the job has a stored password. */
  passwordSet?: boolean
  maxLength: number
  errors?: readonly string[]
}>()
const value = defineModel<string>({ required: true })
const { t } = useI18n()
const revealed = ref(false)

const hint = () =>
  props.mode === 'create'
    ? undefined
    : props.passwordSet
      ? `${t('syncJobs.password.saved')} ${t('syncJobs.password.keep')}`
      : t('syncJobs.password.none')

onBeforeUnmount(() => {
  revealed.value = false
})
</script>

<template>
  <FormField
    :id="id"
    :label="''"
    :description="hint()"
    :errors="errors"
    :required="mode === 'create'"
  >
    <template #label><FieldLabel :text="label" /></template>
    <template #default="control">
      <div class="flex gap-2">
        <input
          v-bind="control"
          v-model="value"
          :type="revealed ? 'text' : 'password'"
          :name="`${id}-remote-secret`"
          autocomplete="new-password"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          :maxlength="maxLength"
          data-1p-ignore
          data-lpignore="true"
          data-bwignore
          data-form-type="other"
          class="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        />
        <button
          type="button"
          class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          :aria-label="t('auth.signIn.showPassword')"
          :aria-pressed="revealed ? 'true' : 'false'"
          :aria-controls="id"
          @click="revealed = !revealed"
        >
          <EyeOffIcon v-if="revealed" class="size-5" />
          <EyeIcon v-else class="size-5" />
        </button>
      </div>
    </template>
  </FormField>
</template>
