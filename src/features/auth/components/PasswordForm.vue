<script setup lang="ts">
// The username and password form (FR-016–FR-019, FR-081, research R21): labelled fields that
// password managers recognise, pasting allowed, no auto-capitalisation or correction of the
// username, an accessible show/hide toggle, a busy state without double submits, and the
// throttling countdown. US2 adds the passkeys of the username autofill (`webauthnAutofill`). Labels,
// placeholders and the button are those of the classic login pages (`login.*`): the mailbox-user
// and role-neutral screens ask for the email address, the others for the username.
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Role } from '@/api'
import { lt } from '@/i18n'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { EyeIcon, EyeOffIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { usePasswordSignIn } from '../composables/usePasswordSignIn'

const props = defineProps<{
  role: Role | null
  /** Passkeys in the username autofill (FR-012). */
  webauthnAutofill?: boolean
  /** A passkey action comes first, so this form's action is the secondary one (FR-010). */
  secondary?: boolean
}>()
const emit = defineEmits<{ submitting: []; failed: [] }>()

const { t } = useI18n()
const usernameId = useId()
const passwordId = useId()
const { username, password, pending, problem, throttle, form, submit } = usePasswordSignIn({
  role: () => props.role,
  usernameId,
  passwordId,
  onSubmit: () => emit('submitting'),
  onFailed: () => emit('failed'),
})
const visible = ref(false)
const usernamePlaceholder = computed(() =>
  props.role === null || props.role === 'mailboxUser' ? lt('login.email') : lt('login.username'),
)

// The "too many attempts" message goes once sign-in is possible again.
watch(throttle.active, (active) => {
  if (!active && problem.value?.is('too-many-requests')) problem.value = null
})
</script>

<template>
  <form
    novalidate
    class="flex flex-col gap-4"
    :aria-busy="pending ? 'true' : 'false'"
    @submit.prevent="submit"
  >
    <ErrorSummary :id="form.summaryId" :items="form.summary.value" />
    <ProblemMessage :problem="problem" />
    <p
      v-if="throttle.active.value"
      class="text-sm font-medium text-gray-800 tabular-nums dark:text-gray-200"
    >
      {{ t('auth.signIn.throttle.countdown', { time: throttle.clock.value }) }}
    </p>
    <FormField
      :id="usernameId"
      v-slot="field"
      :label="lt('login.username')"
      :errors="form.errorsFor('username')"
    >
      <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- labelled by FormField (for/id) -->
      <input
        v-bind="{ ...field, autocorrect: 'off' }"
        v-model="username"
        name="username"
        type="text"
        :autocomplete="webauthnAutofill ? 'username webauthn' : 'username'"
        autocapitalize="none"
        spellcheck="false"
        maxlength="255"
        :placeholder="usernamePlaceholder"
        class="form-control"
      />
    </FormField>
    <FormField
      :id="passwordId"
      v-slot="field"
      :label="lt('login.password')"
      :errors="form.errorsFor('password')"
    >
      <div class="relative">
        <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- labelled by FormField (for/id) -->
        <input
          v-bind="field"
          v-model="password"
          name="password"
          :type="visible ? 'text' : 'password'"
          autocomplete="current-password"
          maxlength="4096"
          :placeholder="lt('login.password')"
          class="form-control pe-12"
        />
        <button
          type="button"
          class="absolute inset-y-0 end-0 inline-flex size-11 items-center justify-center rounded-e-[10px] text-gray-600 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:text-white"
          :aria-label="t('auth.signIn.showPassword')"
          :aria-pressed="visible ? 'true' : 'false'"
          :aria-controls="passwordId"
          @click="visible = !visible"
        >
          <EyeOffIcon v-if="visible" class="size-5" />
          <EyeIcon v-else class="size-5" />
        </button>
      </div>
    </FormField>
    <button
      type="submit"
      :data-variant="secondary ? 'secondary' : 'primary'"
      :class="buttonVariants({ variant: secondary ? 'outline' : 'default', class: 'w-full' })"
      :disabled="pending || throttle.active.value"
      :aria-busy="pending ? 'true' : 'false'"
    >
      {{ pending ? lt('footer.loading') : lt('login.login') }}
    </button>
  </form>
</template>
