<script setup lang="ts">
// The haveibeenpwned check of the classic password fields (`data-hibp`, `js/build/013-mailcow.js`;
// docs/conventions.md, owner decision 2026-10-18, constitution 1.4.0). It runs only when the user
// clicks "Check against haveibeenpwned.com". The browser computes the password's SHA-1 with Web
// Crypto and sends only its first five hex characters to `api.pwnedpasswords.com/range/<prefix>`
// (k-anonymity, no credentials, no referrer); the rest is compared here, and legacy's answers are
// shown. The password never leaves the browser. A changed password forgets the result, as legacy
// does on input. An empty field asks the parent to point at the password (`empty`), as legacy shakes
// it. This is the app's only third-party request; the CSP allows `connect-src` to that origin only.
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'

import { WarningIcon } from '../icons'

const props = defineProps<{ password: string }>()
const emit = defineEmits<{ empty: [] }>()
const { t } = useI18n()

const RANGE_URL = 'https://api.pwnedpasswords.com/range/'

type Result = 'idle' | 'checking' | 'found' | 'notFound' | 'error'
const result = ref<Result>('idle')
let run = 0

watch(
  () => props.password,
  () => {
    run += 1
    result.value = 'idle'
  },
)

async function sha1Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

async function check() {
  if (result.value === 'checking') return
  if (props.password === '') {
    emit('empty')
    return
  }
  const current = ++run
  result.value = 'checking'
  try {
    const hash = await sha1Hex(props.password)
    const response = await fetch(`${RANGE_URL}${hash.slice(0, 5)}`, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const suffix = hash.slice(5)
    const found = (await response.text())
      .split(/\r?\n/)
      .some((line) => line.split(':')[0]?.trim().toUpperCase() === suffix)
    if (current === run) result.value = found ? 'found' : 'notFound'
  } catch {
    if (current === run) result.value = 'error'
  }
}
</script>

<template>
  <div class="flex flex-col items-start gap-1">
    <button
      type="button"
      class="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent-text bg-white dark:bg-gray-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
      :aria-busy="result === 'checking' ? 'true' : undefined"
      @click="check"
    >
      <WarningIcon class="size-4" />
      {{ lt('footer.hibp_check') }}
    </button>
    <p
      role="status"
      class="text-sm"
      :class="{
        'font-medium text-red-700 dark:text-red-400': result === 'found',
        'font-medium text-green-700 dark:text-green-400': result === 'notFound',
        'text-amber-800 dark:text-amber-300': result === 'error',
        'text-gray-700 dark:text-gray-300': result === 'checking',
      }"
    >
      <template v-if="result === 'checking'">{{ lt('footer.loading') }}</template>
      <template v-else-if="result === 'found'">{{ lt('footer.hibp_nok') }}</template>
      <template v-else-if="result === 'notFound'">{{ lt('footer.hibp_ok') }}</template>
      <template v-else-if="result === 'error'">{{ t('hibp.error') }}</template>
    </p>
  </div>
</template>
