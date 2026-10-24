<script setup lang="ts">
// "Add a passkey" (FR-053, FR-056): an optional name (1–255 characters when given), then the
// device's confirmation. A cancelled prompt shows nothing; a rejection is explained and the
// action stays available for another try. Without passkey support, adding is unavailable with an
// explanation.
import { ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import FormField from '@/shared/components/FormField.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useProblemMessages } from '@/i18n/problems'
import { passkeysSupported } from '@/shared/platform/webauthn'
import { buttonVariants } from '@/shared/ui/button'

import { usePasskeyRegistration } from '../composables/usePasskeyRegistration'

const emit = defineEmits<{ added: [] }>()
const { t } = useI18n()
const { violationMessage } = useProblemMessages()
const titleId = useId()
const fieldId = useId()
const supported = passkeysSupported()
const name = ref('')
const nameError = ref<string | null>(null)
const registration = usePasskeyRegistration()

async function add() {
  nameError.value = null
  if (name.value.trim().length > 255) {
    nameError.value = t('validation.tooLong', { max: 255 })
    return
  }
  const passkey = await registration.register(name.value)
  if (passkey) {
    name.value = ''
    emit('added')
    return
  }
  const violations = registration.problem.value?.fieldErrors.get('name')
  if (violations?.length) nameError.value = violations.map(violationMessage).join(' ')
}
</script>

<template>
  <section class="flex min-w-0 flex-col gap-4" :aria-labelledby="titleId">
    <h2 :id="titleId" class="font-semibold text-gray-900 dark:text-white">
      {{ t('passkeys.add.heading') }}
    </h2>
    <template v-if="supported">
      <ProblemMessage
        v-if="registration.problem.value && !registration.problem.value.is('validation-failed')"
        :problem="registration.problem.value"
      />
      <p
        v-if="registration.messageKey.value"
        role="alert"
        class="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      >
        {{ t(registration.messageKey.value) }}
      </p>
      <form novalidate class="flex flex-col gap-4" @submit.prevent="add">
        <FormField
          :id="fieldId"
          v-slot="field"
          :label="t('passkeys.add.name')"
          :description="t('passkeys.add.nameHelp')"
          :errors="nameError ? [nameError] : []"
        >
          <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- labelled by FormField (for/id) -->
          <input
            v-bind="field"
            v-model="name"
            type="text"
            autocomplete="off"
            class="form-control"
          />
        </FormField>
        <button
          type="submit"
          :class="buttonVariants({ class: 'w-full sm:w-auto sm:self-start' })"
          :disabled="registration.pending.value"
          :aria-busy="registration.pending.value ? 'true' : 'false'"
        >
          {{ registration.pending.value ? t('passkeys.add.waiting') : t('passkeys.add.submit') }}
        </button>
      </form>
    </template>
    <p v-else class="text-gray-700 dark:text-gray-300">{{ t('passkeys.add.unsupported') }}</p>
  </section>
</template>
