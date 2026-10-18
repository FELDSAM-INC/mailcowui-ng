<script setup lang="ts">
// Renaming a passkey (FR-054): a name of 1–255 characters after trimming, with messages on the
// field. The save sends the version tag that was read; after a 412 the input stays, the list is
// reloaded and the user saves again (conventions "Editing and conflicts").
import { ref, shallowRef, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Passkey } from '@/api'
import { lt } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useVersionedSave } from '@/shared/composables/useVersionedSave'
import { useProblemMessages } from '@/i18n/problems'
import { buttonVariants } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'

import { renamePasskey } from '../api'

const props = defineProps<{
  passkey: Passkey
  /** Reloads the list after a 412 and returns the passkey as it is now. */
  reload?: () => Promise<Passkey | undefined>
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [passkey: Passkey]; outdated: [] }>()

const { t } = useI18n()
const { violationMessage } = useProblemMessages()
const fieldId = useId()
const name = ref(props.passkey.name ?? '')
const error = ref<string | null>(null)
const reloaded = shallowRef<Passkey | undefined>(undefined)
const saver = useVersionedSave<Passkey>({
  current: (): Passkey => reloaded.value ?? props.passkey,
  refetch: async () => {
    emit('outdated')
    reloaded.value = await props.reload?.()
    return reloaded.value
  },
})

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = props.passkey.name ?? ''
  error.value = null
  saver.outdated.value = false
  reloaded.value = undefined
})

async function save() {
  const value = name.value.trim()
  error.value = null
  if (!value) error.value = t('validation.required')
  else if (value.length > 255) error.value = t('validation.tooLong', { max: 255 })
  if (error.value) {
    announce(error.value, { assertive: true })
    document.getElementById(fieldId)?.focus()
    return
  }
  const result = await saver.save(value, (input: string, ifMatch: string) =>
    renamePasskey(props.passkey.id, input, ifMatch),
  )
  if (result.status === 'saved') {
    announce(t('passkeys.renamed'))
    emit('saved', result.result)
    open.value = false
  } else if (result.status === 'outdated') {
    announce(t('passkeys.rename.outdated'), { assertive: true })
  } else if (result.status === 'failed') {
    const violations = result.problem.fieldErrors.get('name')
    if (violations?.length) error.value = violations.map(violationMessage).join(' ')
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t('passkeys.rename.title') }}</DialogTitle>
        <DialogDescription class="sr-only">{{ t('passkeys.rename.title') }}</DialogDescription>
      </DialogHeader>
      <form novalidate class="flex flex-col gap-4" @submit.prevent="save">
        <p
          v-if="saver.outdated.value"
          role="alert"
          class="rounded-xl border border-warning-200 bg-warning-50 p-4 text-warning-900 dark:border-warning-900 dark:bg-warning-950 dark:text-warning-100"
        >
          {{ t('passkeys.rename.outdated') }}
        </p>
        <ProblemMessage
          v-if="saver.problem.value && !saver.problem.value.is('validation-failed')"
          :problem="saver.problem.value"
        />
        <FormField
          :id="fieldId"
          v-slot="field"
          :label="t('passkeys.rename.name')"
          :errors="error ? [error] : []"
          required
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
        <DialogFooter>
          <button
            type="button"
            :class="buttonVariants({ variant: 'outline' })"
            @click="open = false"
          >
            {{ lt('footer.cancel') }}
          </button>
          <button
            type="submit"
            :class="buttonVariants({})"
            :disabled="saver.pending.value"
            :aria-busy="saver.pending.value ? 'true' : 'false'"
          >
            {{ t('passkeys.rename.save') }}
          </button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
