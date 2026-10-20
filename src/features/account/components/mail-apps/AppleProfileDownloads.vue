<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import type { AppleProfileRequest } from '@/api'
import { lt } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { buttonVariants } from '@/shared/ui/button'
import { useProfileDownload } from '../../composables/useProfileDownload'
const props = defineProps<{
  mailbox: string
  groupware: boolean
  appPasswords: boolean
  selectedVariant?: AppleProfileRequest['variant']
  selectedAppPassword?: boolean
}>()
const { t } = useI18n()
const download = useProfileDownload(() => props.mailbox)
const withPassword = computed(() => props.appPasswords && !download.flagWithdrawn.value)
const variants = computed(() =>
  props.groupware && !download.groupwareWithdrawn.value
    ? (['email', 'emailAndDav'] as const)
    : (['email'] as const),
)
const focusTarget = ref<HTMLButtonElement | null>(null)
onMounted(async () => {
  if (props.selectedVariant) {
    await nextTick()
    focusTarget.value?.focus()
  }
})
const selected = (variant: string, withAppPassword: boolean) =>
  variant === props.selectedVariant &&
  withAppPassword === (props.selectedAppPassword && withPassword.value)
</script>
<template>
  <section class="flex flex-col gap-4">
    <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
      {{ lt('user.apple_connection_profile') }}
    </h2>
    <div
      v-for="password in withPassword ? [false, true] : [false]"
      :key="String(password)"
      class="surface flex flex-col gap-3"
      :data-profile-password="String(password)"
    >
      <p class="font-medium text-gray-900 dark:text-white">
        {{ lt('user.apple_connection_profile') }}:<template v-if="password"
          ><br />{{ lt('user.with_app_password') }}</template
        >
      </p>
      <div v-for="variant in variants" :key="variant" class="flex flex-col items-start gap-2">
        <button
          :ref="
            (element) => {
              if (selected(variant, password)) focusTarget = element as HTMLButtonElement
            }
          "
          type="button"
          :class="
            buttonVariants({
              variant: 'outline',
              class: 'h-auto min-h-11 max-w-full whitespace-normal text-start',
            })
          "
          :disabled="download.pending.value"
          :data-variant="variant"
          @click="download.download(variant, password)"
        >
          {{ lt(variant === 'email' ? 'user.email' : 'user.email_and_dav') }}
          {{ variant === 'email' ? '[IMAP, SMTP]' : '[IMAP, SMTP, Cal/CardDAV]' }}
        </button>
        <LegacyText
          :k="
            variant === 'email'
              ? 'user.apple_connection_profile_mailonly'
              : 'user.apple_connection_profile_complete'
          "
          as="p"
          class="text-sm text-gray-700 dark:text-gray-300"
        />
        <LegacyText
          v-if="password"
          k="user.apple_connection_profile_with_app_password"
          as="p"
          class="text-sm text-gray-700 dark:text-gray-300"
        />
      </div>
    </div>
    <ProblemMessage v-if="download.problem.value" :problem="download.problem.value" />
    <div
      v-if="download.createdAppPassword.value"
      role="status"
      class="flex flex-col gap-2 text-gray-800 dark:text-gray-200"
    >
      <LegacyText k="user.apple_connection_profile_with_app_password" as="p" />
      <p>{{ t('account.mailApps.profile.deleteAfterInstall') }}</p>
      <RouterLink
        :to="{ name: 'account-app-passwords' }"
        class="inline-flex min-h-11 items-center underline"
        >{{ lt('user.app_passwds') }}</RouterLink
      >
    </div>
  </section>
</template>
