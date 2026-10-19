<script setup lang="ts">
// The username and password of a relayhost or transport (research R7, conventions "Secrets",
// FR-025 to FR-028), labelled as the classic add form (`admin.username`, `admin.password`) or edit
// page (`add.username`, `add.password`) labels them. The stored password is never shown: on an
// edit page the field starts empty with legacy's `edit.unchanged_if_empty`, a line says whether a
// password is stored, "Remove password" removes it on save (pending until then, with "Undo"), and
// clearing the username says that the stored password goes too. The edit page keeps legacy's
// haveibeenpwned check (`data-hibp`). Password managers are kept away from the fields.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'
import HibpCheck from '@/shared/components/HibpCheck.vue'
import { buttonVariants } from '@/shared/ui/button'

import {
  removalPending,
  willRemoveWithUsername,
  type CredentialIntent,
} from '../../logic/credentials'

const props = withDefaults(
  defineProps<{
    idPrefix: string
    mode: 'create' | 'edit'
    errorsFor: (path: string) => string[]
    maxLengths?: { username: number; password: number } | null
  }>(),
  { maxLengths: null },
)
const intent = defineModel<CredentialIntent>({ required: true })
const { t } = useI18n()

const labels = computed(() =>
  props.mode === 'create'
    ? { username: lt('admin.username'), password: lt('admin.password') }
    : { username: lt('add.username'), password: lt('add.password') },
)
const pending = computed(() => removalPending(intent.value))
const usernameNote = computed(() => willRemoveWithUsername(intent.value))

function set(change: Partial<CredentialIntent>) {
  intent.value = { ...intent.value, ...change }
}

function focusPassword() {
  document.getElementById(`${props.idPrefix}-password`)?.focus()
}
</script>

<template>
  <FormField :id="`${idPrefix}-username`" :label="labels.username" :errors="errorsFor('username')">
    <template #default="control">
      <input
        v-bind="control"
        :value="intent.username"
        type="text"
        name="relay-username"
        autocomplete="off"
        autocapitalize="none"
        autocorrect="off"
        spellcheck="false"
        data-1p-ignore
        data-lpignore="true"
        data-bwignore
        :maxlength="maxLengths?.username"
        class="form-control"
        @input="set({ username: ($event.target as HTMLInputElement).value })"
      />
    </template>
  </FormField>
  <p
    v-if="usernameNote"
    data-username-note
    role="status"
    class="-mt-2 text-sm text-amber-800 dark:text-amber-200"
  >
    {{ t('routing.credentials.usernameCleared') }}
  </p>
  <FormField :id="`${idPrefix}-password`" :label="labels.password" :errors="errorsFor('password')">
    <template #default="control">
      <input
        v-bind="control"
        :value="intent.password"
        type="password"
        name="relay-password"
        autocomplete="new-password"
        autocapitalize="none"
        autocorrect="off"
        spellcheck="false"
        data-1p-ignore
        data-lpignore="true"
        data-bwignore
        :placeholder="mode === 'edit' ? lt('edit.unchanged_if_empty') : undefined"
        :disabled="pending"
        :maxlength="maxLengths?.password"
        class="form-control"
        @input="set({ password: ($event.target as HTMLInputElement).value })"
      />
    </template>
  </FormField>
  <div v-if="mode === 'edit'" class="-mt-2 flex flex-col gap-2" data-password-status>
    <template v-if="pending">
      <p role="status" class="text-sm text-amber-800 dark:text-amber-200">
        {{ t('routing.credentials.removalPending') }}
      </p>
      <button
        type="button"
        :class="buttonVariants({ variant: 'outline', size: 'sm', class: 'self-start' })"
        @click="set({ removePassword: false })"
      >
        {{ t('routing.credentials.undo') }}
      </button>
    </template>
    <template v-else>
      <p class="text-sm text-gray-700 dark:text-gray-300">
        {{
          intent.passwordStored ? t('routing.credentials.stored') : t('routing.credentials.none')
        }}
      </p>
      <button
        v-if="intent.passwordStored"
        type="button"
        :class="buttonVariants({ variant: 'outline', size: 'sm', class: 'self-start' })"
        data-remove-password
        @click="set({ removePassword: true, password: '' })"
      >
        {{ t('routing.credentials.remove') }}
      </button>
    </template>
    <HibpCheck v-if="!pending" :password="intent.password" @empty="focusPassword" />
  </div>
</template>
