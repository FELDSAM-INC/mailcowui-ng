<script setup lang="ts">
// Legacy's "Redirect Url" row of the Keycloak and Generic-OIDC forms (FR-028): the required return
// URL of the classic interface with its add button, then one row per additional URL with a remove
// button (icon-only in legacy; here named `admin.add` and `mailbox.remove` with the entry). Below,
// the app's own return addresses from the capabilities, which the provider must also allow for
// single sign-on in this app (FR-027): read-only text with a copy button each, not links (FR-082).
import { nextTick } from 'vue'

import { lt } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'
import { CloseIcon, PlusIcon } from '@/shared/icons'

import AppReturnAddresses from './AppReturnAddresses.vue'
import { ICON_BUTTON, INPUT } from './styles'

const props = defineProps<{
  idPrefix: string
  legacyReturnUrl: string
  additionalReturnUrls: string[]
  appReturnUrls: readonly string[]
  errorsFor: (path: string) => string[]
}>()
const emit = defineEmits<{
  'update:legacyReturnUrl': [value: string]
  'update:additionalReturnUrls': [value: string[]]
}>()

async function add() {
  const index = props.additionalReturnUrls.length
  emit('update:additionalReturnUrls', [...props.additionalReturnUrls, ''])
  await nextTick()
  document.getElementById(`${props.idPrefix}-additionalReturnUrls-${index}`)?.focus()
}

function update(index: number, value: string) {
  emit(
    'update:additionalReturnUrls',
    props.additionalReturnUrls.map((item, i) => (i === index ? value : item)),
  )
}

function remove(index: number) {
  emit(
    'update:additionalReturnUrls',
    props.additionalReturnUrls.filter((_, i) => i !== index),
  )
  document.getElementById(`${props.idPrefix}-legacyReturnUrl`)?.focus()
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <FormField
      :id="`${idPrefix}-legacyReturnUrl`"
      :label="lt('admin.iam_redirect_url')"
      required
      :errors="errorsFor('legacyReturnUrl')"
    >
      <template #default="control">
        <div class="flex gap-2">
          <input
            v-bind="control"
            :value="legacyReturnUrl"
            type="url"
            inputmode="url"
            autocomplete="off"
            spellcheck="false"
            :class="INPUT"
            @input="emit('update:legacyReturnUrl', ($event.target as HTMLInputElement).value)"
          />
          <button
            type="button"
            :class="ICON_BUTTON"
            :aria-label="`${lt('admin.add')}: ${lt('admin.iam_redirect_url')}`"
            @click="add"
          >
            <PlusIcon class="size-5" />
          </button>
        </div>
      </template>
    </FormField>
    <FormField
      v-for="(url, index) in additionalReturnUrls"
      :id="`${idPrefix}-additionalReturnUrls-${index}`"
      :key="index"
      :label="`${lt('admin.iam_redirect_url')} ${index + 2}`"
      :errors="errorsFor(`additionalReturnUrls.${index}`)"
    >
      <template #default="control">
        <div class="flex gap-2">
          <input
            v-bind="control"
            :value="url"
            type="url"
            inputmode="url"
            autocomplete="off"
            spellcheck="false"
            :class="INPUT"
            @input="update(index, ($event.target as HTMLInputElement).value)"
          />
          <button
            type="button"
            :class="ICON_BUTTON"
            :aria-label="`${lt('mailbox.remove')}: ${url || `${lt('admin.iam_redirect_url')} ${index + 2}`}`"
            @click="remove(index)"
          >
            <CloseIcon class="size-5" />
          </button>
        </div>
      </template>
    </FormField>
    <p
      v-if="errorsFor('additionalReturnUrls').length"
      class="text-sm text-red-700 dark:text-red-300"
    >
      {{ errorsFor('additionalReturnUrls').join(' ') }}
    </p>
    <AppReturnAddresses :id-prefix="idPrefix" :urls="appReturnUrls" />
  </div>
</template>
