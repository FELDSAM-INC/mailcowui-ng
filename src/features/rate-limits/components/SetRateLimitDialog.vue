<script setup lang="ts">
// "Set a rate limit" (FR-057, legacy form map screen 7; no classic counterpart): choose the kind
// (`mailbox.kind` with the kind labels), find the object in the caller's scope with the shared
// pickers (domains and alias domains through `DomainPicker`, mailboxes through
// `MailboxSearchPicker`; the API scopes all three lists), then continue on that object's page at
// its rate limit section (`#rate-limit`), where the limit is set with legacy's form. The buttons
// are `mailbox.edit` and `footer.cancel`.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { aliasDomainPickerSource, domainPickerSource } from '@/features/aliases-common'
import { lt, text } from '@/i18n'
import DomainPicker from '@/shared/components/DomainPicker.vue'
import MailboxSearchPicker from '@/shared/components/MailboxSearchPicker.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { buttonVariants } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog'

import type { RateLimitKind } from '../api'
import { RATE_LIMIT_KINDS } from '../list-state'
import { hostLocation } from '../host'

const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()
const router = useRouter()
const wide = useMediaQuery('(min-width: 768px)')

const PICKER_ID = 'set-rate-limit-object'
const kind = ref<RateLimitKind>('domain')
const object = ref<string | null>(null)
const errors = ref<string[]>([])

watch(open, (isOpen) => {
  if (!isOpen) return
  kind.value = 'domain'
  object.value = null
  errors.value = []
})
watch(kind, () => {
  object.value = null
  errors.value = []
})

const kindLabel = (value: RateLimitKind) => text(`enums.rateLimitObjectKind.${value}`)
const sources = computed(() =>
  kind.value === 'aliasDomain' ? [aliasDomainPickerSource()] : [domainPickerSource()],
)

function choose(value: string | null | readonly string[]) {
  object.value = typeof value === 'string' && value !== '' ? value : null
  if (object.value) errors.value = []
}

async function onSubmit(event: Event) {
  event.preventDefault()
  if (!object.value) {
    errors.value = [t('validation.required')]
    announce(errors.value[0]!, { assertive: true })
    document.getElementById(PICKER_ID)?.focus()
    return
  }
  const target = hostLocation(kind.value, object.value)
  open.value = false
  await router.push(target)
}

const RADIO =
  'size-5 border-gray-300 text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700'
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :full-screen="!wide"
      :show-close-button="false"
      class="max-h-dvh overflow-y-auto"
      data-set-rate-limit-dialog
      @pointer-down-outside.prevent
      @interact-outside.prevent
      @open-auto-focus.prevent="
        ($event.target as HTMLElement | null)?.querySelector<HTMLElement>('h2')?.focus()
      "
    >
      <form class="flex min-h-full flex-col gap-4" novalidate @submit="onSubmit">
        <DialogTitle
          tabindex="-1"
          class="text-lg font-semibold text-gray-900 focus:outline-none dark:text-white"
        >
          {{ t('rateLimits.set.title') }}
        </DialogTitle>
        <fieldset class="flex flex-col gap-1.5">
          <legend class="mb-1 text-sm font-medium text-gray-800 dark:text-gray-200">
            {{ lt('mailbox.kind') }}
          </legend>
          <div class="flex flex-wrap gap-x-6 gap-y-1">
            <label
              v-for="value in RATE_LIMIT_KINDS"
              :key="value"
              class="inline-flex min-h-11 items-center gap-2 text-gray-900 dark:text-white"
            >
              <input
                v-model="kind"
                type="radio"
                name="set-rate-limit-kind"
                :value="value"
                :class="RADIO"
              />
              {{ kindLabel(value) }}
            </label>
          </div>
        </fieldset>
        <MailboxSearchPicker
          v-if="kind === 'mailbox'"
          :id="PICKER_ID"
          :model-value="object"
          :label="kindLabel(kind)"
          :placeholder="lt('tfa.select')"
          :errors="errors"
          @update:model-value="choose"
        />
        <DomainPicker
          v-else
          :id="PICKER_ID"
          :key="kind"
          :model-value="object"
          :label="kindLabel(kind)"
          :sources="sources"
          :placeholder="lt('tfa.select')"
          :errors="errors"
          @update:model-value="choose"
        />
        <div
          data-dialog-actions
          class="sticky bottom-0 -mx-6 mt-auto flex flex-col-reverse gap-2 border-t border-gray-200 bg-white px-6 py-3 sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:p-0 dark:border-gray-800 dark:bg-[#1E2635]"
        >
          <button
            type="button"
            :class="buttonVariants({ variant: 'outline' })"
            @click="open = false"
          >
            {{ lt('footer.cancel') }}
          </button>
          <button type="submit" :class="buttonVariants({ variant: 'default' })">
            {{ lt('mailbox.edit') }}
          </button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
