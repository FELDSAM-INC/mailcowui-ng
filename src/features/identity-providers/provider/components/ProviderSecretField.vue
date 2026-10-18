<script setup lang="ts">
// The client secret or bind password (FR-023 to FR-026, conventions "Secrets"): write-only, never
// prefilled. When a secret is stored and an empty field keeps it, the help says so; when it is
// required (setup, another type, a new address) the field is marked required and the reason is the
// field's message. Masked, with legacy's reveal button; browsers and password managers must not
// fill in the administrator's own sign-in (`autocomplete="new-password"` and the managers' opt-outs).
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import FormField from '@/shared/components/FormField.vue'
import { EyeIcon, EyeOffIcon } from '@/shared/icons'

import { ICON_BUTTON, INPUT } from './styles'

const props = defineProps<{
  id: string
  label: string
  modelValue: string
  required: boolean
  /** A secret is stored and an empty field keeps it. */
  keepsStored: boolean
  errors?: readonly string[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t } = useI18n()
const shown = ref(false)
</script>

<template>
  <FormField
    :id="id"
    :label="label"
    :required="required"
    :description="keepsStored && !required ? t('identityProvider.secretStored') : undefined"
    :errors="errors"
  >
    <template #default="control">
      <div class="flex gap-2">
        <input
          v-bind="control"
          :value="props.modelValue"
          :type="shown ? 'text' : 'password'"
          autocomplete="new-password"
          autocapitalize="none"
          spellcheck="false"
          data-1p-ignore
          data-lpignore="true"
          data-bwignore
          data-form-type="other"
          :class="INPUT"
          @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        />
        <button
          type="button"
          :class="ICON_BUTTON"
          :aria-label="t('auth.signIn.showPassword')"
          :aria-pressed="shown ? 'true' : 'false'"
          :aria-controls="id"
          @click="shown = !shown"
        >
          <EyeOffIcon v-if="shown" class="size-5" />
          <EyeIcon v-else class="size-5" />
        </button>
      </div>
    </template>
  </FormField>
</template>
