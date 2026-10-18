<script setup lang="ts">
// One pending action of a restricted session (FR-038–FR-041), in plain language with its
// resolution: a password change links to the classic sign-in of the role and offers "Check
// again"; second-factor setup offers passkey registration when it is the only action and the
// device supports passkeys, otherwise it explains what to do.
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'

import type { PendingAction, Role } from '@/api'
import { classicSignIn } from '@/app/navigation/classic-links'
import { buttonVariants } from '@/shared/ui/button'

defineProps<{
  action: PendingAction
  role: Role | null
  /** Second-factor setup can be done here now (sole action, passkeys supported). */
  canRegister: boolean
  /** Passkey registration waits for the password change (FR-041). */
  waitsForPassword: boolean
  supported: boolean
  busy: boolean
}>()
defineEmits<{ checkAgain: []; register: [] }>()
const { t } = useI18n()
const titleId = useId()
</script>

<template>
  <li class="surface flex flex-col gap-3" :aria-labelledby="titleId">
    <h2 :id="titleId" class="font-semibold text-gray-900 dark:text-white">
      {{ t(`enums.pendingAction.${action}`) }}
    </h2>
    <template v-if="action === 'passwordChange'">
      <p class="text-gray-700 dark:text-gray-300">{{ t('auth.pendingActions.password.body') }}</p>
      <a :href="classicSignIn(role)" class="text-link self-start">
        {{ t('auth.pendingActions.password.link') }}
      </a>
      <button
        type="button"
        :class="buttonVariants({ variant: 'outline', class: 'self-start' })"
        :disabled="busy"
        :aria-busy="busy ? 'true' : 'false'"
        @click="$emit('checkAgain')"
      >
        {{ t('auth.pendingActions.password.checkAgain') }}
      </button>
    </template>
    <template v-else>
      <p class="text-gray-700 dark:text-gray-300">
        {{ t('auth.pendingActions.secondFactor.required') }}
      </p>
      <p v-if="waitsForPassword" class="text-gray-700 dark:text-gray-300">
        {{ t('auth.pendingActions.secondFactor.afterPassword') }}
      </p>
      <template v-else-if="!supported">
        <p class="text-gray-700 dark:text-gray-300">
          {{ t('auth.pendingActions.secondFactor.unsupported') }}
        </p>
        <a :href="classicSignIn(role)" class="text-link self-start">
          {{ t('auth.pendingActions.secondFactor.classicLink') }}
        </a>
      </template>
      <button
        v-else-if="canRegister"
        type="button"
        :class="buttonVariants({ class: 'w-full sm:w-auto sm:self-start' })"
        :disabled="busy"
        :aria-busy="busy ? 'true' : 'false'"
        @click="$emit('register')"
      >
        {{ t('auth.pendingActions.secondFactor.register') }}
      </button>
    </template>
  </li>
</template>
