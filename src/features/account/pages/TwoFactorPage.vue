<script setup lang="ts">
// My account › Two-factor authentication (UI 005 US2, FR-043 to FR-055; legacy General tab and
// `tfa_keys.twig`, decisions D10 and D11): the entries, legacy's help for mailbox users, the
// pointer to passkeys, and "Set two-factor authentication method" with legacy's choices in legacy's
// order (Yubico OTP, WebAuthn, TOTP, Deactivate), each an action of its own.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { problemOf } from '@/api'
import { lt } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { buttonVariants } from '@/shared/ui/button'

import { useOwnSecondFactors } from '../api/second-factors'
import SecondFactorList from '../components/two-factor/SecondFactorList.vue'
import { useSectionAccess } from '../composables/useSectionAccess'

const { t } = useI18n()
const access = useSectionAccess(() => 'twoFactor')
const identity = computed(() => access.identity.data.value)
const required = computed(
  () => access.capabilities.data.value?.account?.secondFactorRequired === true,
)
const query = useOwnSecondFactors()
const entries = computed(() => query.data.value ?? [])
const list = ref<{ turnOff(): void } | null>(null)

const METHODS = [
  { method: 'yubi-otp', label: 'tfa.yubi_otp' },
  { method: 'webauthn', label: 'tfa.webauthn' },
  { method: 'totp', label: 'tfa.totp' },
] as const
</script>

<template>
  <section class="flex flex-col gap-5">
    <PageHeader :title="lt('tfa.tfa')" />
    <LegacyText
      v-if="identity?.role === 'mailboxUser'"
      k="user.tfa_info"
      as="p"
      class="text-gray-700 dark:text-gray-300"
    />
    <p class="text-gray-700 dark:text-gray-300" data-passkey-pointer>
      {{ t('account.twoFactor.passkeyPointer') }}
      <RouterLink :to="{ name: 'passkeys' }" class="text-link">{{ t('nav.passkeys') }}</RouterLink>
    </p>
    <div
      v-if="query.isPending.value"
      role="status"
      aria-busy="true"
      class="text-gray-600 dark:text-gray-400"
    >
      {{ lt('footer.loading') }}
    </div>
    <div v-else-if="query.isError.value" class="flex flex-col gap-2">
      <p class="font-medium text-gray-900 dark:text-white">{{ t('states.list.error') }}</p>
      <ProblemMessage :problem="problemOf(query.error.value)" retry @retry="query.refetch()" />
    </div>
    <SecondFactorList
      v-else-if="identity"
      ref="list"
      :entries="entries"
      :required="required"
      :username="identity.username"
      @changed="query.refetch()"
    />
    <section class="flex flex-col gap-3" aria-labelledby="set-tfa">
      <h2 id="set-tfa" class="font-semibold text-gray-900 dark:text-white">
        {{ lt('tfa.set_tfa') }}
      </h2>
      <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <RouterLink
          v-for="item in METHODS"
          :key="item.method"
          :to="{ name: 'account-two-factor-add', params: { method: item.method } }"
          :data-method="item.method"
          :class="
            buttonVariants({
              variant: 'outline',
              class: 'h-auto min-h-11 justify-start py-2 text-start whitespace-normal',
            })
          "
        >
          {{ lt(item.label) }}
        </RouterLink>
        <button
          v-if="!required && entries.length > 0"
          type="button"
          data-turn-off
          :class="
            buttonVariants({
              variant: 'outline',
              class: 'h-auto min-h-11 justify-start py-2 text-start whitespace-normal',
            })
          "
          @click="list?.turnOff()"
        >
          {{ lt('tfa.none') }}
        </button>
      </div>
    </section>
  </section>
</template>
