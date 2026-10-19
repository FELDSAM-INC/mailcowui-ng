<script setup lang="ts">
// One pending action of a restricted session (FR-038–FR-041), in plain language with its
// resolution. UI 005 (research R8): the password change is resolved here, with the classic forced
// change's form (`#ChangePWModal`) in the slot, so the classic link and "Check again" are gone;
// second-factor setup waits until the password is set. The headings and the first sentence of each
// action are the classic interface's forced password change and two-factor setup modals
// (`user.change_password`, `user.pw_update_required`, `tfa.setup_title`, `tfa.setup_required`).
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'

import type { PendingAction, Role } from '@/api'
import { classicSignIn } from '@/app/navigation/classic-links'
import type { LegacyKey } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'
import { buttonVariants } from '@/shared/ui/button'

defineProps<{
  action: PendingAction
  role: Role | null
  /** Second-factor setup can be done here now (sole action, passkeys supported). */
  canRegister: boolean
  /** Second-factor setup waits for the password change (FR-031, FR-041). */
  waitsForPassword: boolean
  supported: boolean
  busy: boolean
}>()
defineEmits<{ register: [] }>()
const { t } = useI18n()
const titleId = useId()

const TITLES: Record<PendingAction, LegacyKey> = {
  passwordChange: 'user.change_password',
  secondFactorSetup: 'tfa.setup_title',
}
</script>

<template>
  <li class="surface flex flex-col gap-3" :aria-labelledby="titleId">
    <LegacyText
      :id="titleId"
      :k="TITLES[action]"
      as="h2"
      class="font-semibold text-gray-900 dark:text-white"
    />
    <template v-if="action === 'passwordChange'">
      <LegacyText
        k="user.pw_update_required"
        as="p"
        class="rounded-xl border border-warning-200 bg-warning-50 p-3 text-warning-900 dark:border-warning-900 dark:bg-warning-950 dark:text-warning-100"
      />
      <slot />
    </template>
    <template v-else>
      <LegacyText k="tfa.setup_required" as="p" class="text-gray-700 dark:text-gray-300" />
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
