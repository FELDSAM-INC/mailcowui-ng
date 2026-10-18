<script setup lang="ts">
// The identity-provider hint (FR-008), shown up front whenever an identity provider is configured,
// so that it reveals nothing about an account. It links to the classic sign-in of the screen's
// role.
import { useI18n } from 'vue-i18n'

import type { Role } from '@/api'
import { classicSignIn } from '@/app/navigation/classic-links'
import { InfoIcon } from '@/shared/icons'

defineProps<{ role: Role | null }>()
const { t } = useI18n()
</script>

<template>
  <div
    role="note"
    class="flex gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
  >
    <InfoIcon class="mt-0.5 size-5 shrink-0" />
    <div class="min-w-0">
      <p>{{ t('auth.signIn.idpHint.body') }}</p>
      <a :href="classicSignIn(role)" class="text-link">{{ t('auth.signIn.idpHint.link') }}</a>
    </div>
  </div>
</template>
