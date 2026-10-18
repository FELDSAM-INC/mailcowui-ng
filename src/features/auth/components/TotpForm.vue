<script setup lang="ts">
// The authenticator app (FR-022): with several authenticators the user chooses one by name; a
// single one is preselected and its code field takes focus. The field brings up a numeric
// keyboard, accepts one-time-code autofill and pasting, and the code must be exactly six digits
// (whitespace removed) before it is sent. The field is cleared after every attempt (FR-091). As in
// the classic two-factor modal: "Authenticators" over the list, "123456" in the field and "Login".
import { onMounted, ref, useId, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SecondFactorMethod, SecondFactorVerification, Writable } from '@/api'
import FormField from '@/shared/components/FormField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { buttonVariants } from '@/shared/ui/button'

import { isTotpCode, normaliseCode } from '../composables/useSecondFactor'
import MethodSection from './MethodSection.vue'

const props = defineProps<{
  methods: SecondFactorMethod[]
  busy: boolean
  /** The code field takes focus when the step opens (US1-AS4). */
  takeFocus?: boolean
}>()
const emit = defineEmits<{ verify: [body: Writable<SecondFactorVerification>] }>()

const { t } = useI18n()
const codeId = useId()
const groupName = useId()
const selected = ref(props.methods[0]?.id ?? 0)
const code = ref('')
const error = ref<string | null>(null)
const input = useTemplateRef<HTMLInputElement>('input')

onMounted(() => {
  if (props.takeFocus) input.value?.focus()
})

function submit() {
  if (props.busy) return
  const value = normaliseCode(code.value)
  if (!isTotpCode(value)) {
    error.value = t('validation.format.totpCode')
    announce(error.value, { assertive: true })
    input.value?.focus()
    return
  }
  error.value = null
  code.value = ''
  emit('verify', { type: 'totp', methodId: selected.value, code: value })
}
</script>

<template>
  <MethodSection type="totp">
    <form novalidate class="flex flex-col gap-4" @submit.prevent="submit">
      <fieldset v-if="methods.length > 1" class="flex flex-col">
        <legend class="mb-1 text-sm font-medium text-gray-800 dark:text-gray-200">
          <LegacyText k="tfa.authenticators" />
        </legend>
        <label
          v-for="method in methods"
          :key="method.id"
          class="flex min-h-11 items-center gap-3 text-gray-800 dark:text-gray-200"
        >
          <input
            v-model="selected"
            type="radio"
            :name="groupName"
            :value="method.id"
            class="size-5 accent-brand-500"
          />
          <span class="min-w-0 wrap-anywhere">{{ method.name }}</span>
        </label>
      </fieldset>
      <FormField
        :id="codeId"
        v-slot="field"
        :label="t('auth.secondFactor.totp.code')"
        :errors="error ? [error] : []"
      >
        <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- labelled by FormField (for/id) -->
        <input
          ref="input"
          v-bind="field"
          v-model="code"
          :data-autofocus="takeFocus ? '' : undefined"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="16"
          placeholder="123456"
          class="form-control tabular-nums"
        />
      </FormField>
      <button
        type="submit"
        :class="buttonVariants({ class: 'w-full sm:w-auto sm:self-start' })"
        :disabled="busy"
        :aria-busy="busy ? 'true' : 'false'"
      >
        <LegacyText k="login.login" />
      </button>
    </form>
  </MethodSection>
</template>
