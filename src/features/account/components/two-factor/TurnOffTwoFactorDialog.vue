<script setup lang="ts">
// Turning two-factor authentication off (UI 005 FR-052, FR-053, research R9; legacy
// `#DisableTFAModal`): legacy's title and button "Disable TFA", the note that every second factor
// is removed and passkeys stay, and the current password. The request carries the password, so it
// runs through `useSecretRequest`. Focus returns to the opener when the dialog closes.
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import { buttonVariants } from '@/shared/ui/button'

import { removeAllSecondFactors } from '../../api/second-factors'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; done: [] }>()

const { t } = useI18n()
const passwordId = useId()
const password = ref('')
const error = ref<string | null>(null)
const request = useSecretRequest(removeAllSecondFactors)

watch(
  () => props.open,
  (open) => {
    password.value = ''
    error.value = null
    if (!open) request.clear()
  },
)

async function submit() {
  if (!password.value) {
    error.value = t('validation.required')
    return
  }
  error.value = null
  const done = await request.run(password.value)
  password.value = ''
  if (done !== null) {
    emit('done')
    return
  }
  if (request.problem.value?.is('current-password-incorrect')) {
    error.value = lt('danger.access_denied')
    document.getElementById(passwordId)?.focus()
  }
}

function onOpenChange(open: boolean) {
  if (!open) emit('close')
}
</script>

<template>
  <DialogRoot :open="open" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-100 bg-black/50 dark:bg-black/70" />
      <DialogContent
        data-turn-off-dialog
        class="fixed start-1/2 top-1/2 z-101 grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 text-gray-700 shadow-theme-lg outline-none sm:max-w-lg rtl:translate-x-1/2 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
      >
        <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ lt('tfa.delete_tfa') }}
        </DialogTitle>
        <DialogDescription>{{ t('account.twoFactor.turnOff.body') }}</DialogDescription>
        <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
          <FormField
            :id="passwordId"
            :label="lt('user.password_now')"
            :errors="error ? [error] : []"
          >
            <template #default="control">
              <input
                v-bind="control"
                v-model="password"
                type="password"
                autocomplete="current-password"
                maxlength="4096"
                class="form-control"
              />
            </template>
          </FormField>
          <ProblemMessage
            v-if="request.problem.value && !request.problem.value.is('current-password-incorrect')"
            :problem="request.problem.value"
          />
          <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <DialogClose :class="buttonVariants({ variant: 'outline' })">
              {{ lt('footer.cancel') }}
            </DialogClose>
            <button
              type="submit"
              :class="buttonVariants({ variant: 'destructive' })"
              :disabled="request.pending.value"
              :aria-busy="request.pending.value ? 'true' : 'false'"
            >
              {{ lt('tfa.delete_tfa') }}
            </button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
