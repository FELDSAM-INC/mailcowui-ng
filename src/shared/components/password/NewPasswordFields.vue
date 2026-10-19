<script setup lang="ts">
// A new password and its confirmation (UI 005 research R7, FR-022 to FR-025; legacy form map
// "Own password", decisions D7 and D8), as the classic forms have them: the new password with its
// "generate" action, the haveibeenpwned check under it where legacy has `data-hibp`, the policy as
// legacy lists it (each rule marked met or not met in text, announced once all are met), and the
// confirmation. The labels are the calling form's legacy keys. "Generate" fills both fields with a
// password that meets the policy, shows them in clear text and offers a copy button. A show/hide
// toggle (aria-pressed) reveals both. A hidden username field tells password managers which entry
// to update. The confirmation mismatch is reported with legacy's `danger.password_mismatch` once
// the confirmation was left or the form is submitted. The checklist never blocks submitting: the
// API decides. Values live in the parent's memory only.
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt, type LegacyKey } from '@/i18n'
import { generatePassword } from '@/shared/password/generate'
import {
  evaluatePolicy,
  type PolicyRuleId,
  type PolicyValues,
} from '@/shared/password/policy-rules'
import { MAILBOX_PASSWORD_MAX } from '@/shared/validation/limits'

import { announce } from '../../composables/useAnnouncer'
import { CheckIcon, CloseIcon, EyeIcon, EyeOffIcon } from '../../icons'
import CopyButton from '../CopyButton.vue'
import FormField from '../FormField.vue'
import HibpCheck from '../HibpCheck.vue'
import LegacyText from '../LegacyText.vue'

const props = withDefaults(
  defineProps<{
    idPrefix: string
    password: string
    password2: string
    /** The policy, or null when it could not be read (no rules are listed, as in legacy). */
    policy?: PolicyValues | null
    /** The account whose password this is, for password managers. */
    username?: string | null
    labelKey: LegacyKey
    repeatKey: LegacyKey
    /** The label of the generate action; none hides the generator. */
    generateKey?: LegacyKey | null
    /** The haveibeenpwned check, where the classic field has `data-hibp`. */
    hibp?: boolean
    errors?: readonly string[]
    repeatErrors?: readonly string[]
    /** Rules a server refusal named (`tooShort`, `missingCharacterClass`): marked not met. */
    failedRules?: readonly PolicyRuleId[]
  }>(),
  {
    policy: null,
    username: null,
    generateKey: null,
    hibp: false,
    errors: () => [],
    repeatErrors: () => [],
    failedRules: () => [],
  },
)
const emit = defineEmits<{
  'update:password': [value: string]
  'update:password2': [value: string]
}>()

const { t } = useI18n()
const shown = ref(false)
const generated = ref<string | null>(null)
const repeatTouched = ref(false)
const input = ref<HTMLInputElement | null>(null)
const passwordId = computed(() => `${props.idPrefix}-new-password`)
const repeatId = computed(() => `${props.idPrefix}-new-password2`)
const usernameId = computed(() => `${props.idPrefix}-username`)

const rules = computed(() => (props.policy ? evaluatePolicy(props.policy, props.password) : []))
const allMet = computed(
  () => rules.value.length > 0 && props.password !== '' && rules.value.every((rule) => rule.met),
)
const mismatch = computed(
  () => repeatTouched.value && props.password2 !== '' && props.password !== props.password2,
)
const repeatMessages = computed(() =>
  mismatch.value ? [lt('danger.password_mismatch'), ...props.repeatErrors] : props.repeatErrors,
)
const isMet = (id: PolicyRuleId, met: boolean) => met && !props.failedRules.includes(id)

watch(allMet, (met) => {
  if (met) announce(t('forms.passwordRules.allMet'))
})
watch(
  () => props.password,
  (value) => {
    if (generated.value !== null && value !== generated.value) generated.value = null
  },
)

function generate() {
  const value = generatePassword(props.policy)
  shown.value = true
  generated.value = value
  emit('update:password', value)
  emit('update:password2', value)
}

async function focusPassword() {
  await nextTick()
  input.value?.focus()
}

/** Marks the confirmation as checked; true when both values match (submit calls it). */
function validate(): boolean {
  repeatTouched.value = true
  return props.password === props.password2
}

/** Forgets the shown state and the generated value (after a submit, on session end). */
function reset() {
  shown.value = false
  generated.value = null
  repeatTouched.value = false
}

defineExpose({ validate, reset, focus: focusPassword })
</script>

<template>
  <div class="flex flex-col gap-3">
    <input
      v-if="username"
      :id="usernameId"
      :value="username"
      type="text"
      name="username"
      autocomplete="username"
      readonly
      tabindex="-1"
      :aria-label="lt('user.username')"
      class="sr-only"
    />
    <FormField :id="passwordId" :label="lt(labelKey)" :errors="errors">
      <template #default="control">
        <div class="flex flex-col gap-1">
          <button
            v-if="generateKey"
            type="button"
            data-generate
            class="text-link self-start text-sm"
            @click="generate"
          >
            ({{ lt(generateKey) }})
          </button>
          <div class="relative">
            <input
              v-bind="control"
              ref="input"
              :value="password"
              :type="shown ? 'text' : 'password'"
              autocomplete="new-password"
              autocapitalize="none"
              autocorrect="off"
              spellcheck="false"
              :maxlength="MAILBOX_PASSWORD_MAX"
              class="form-control pe-12"
              @input="emit('update:password', ($event.target as HTMLInputElement).value)"
            />
            <button
              type="button"
              class="absolute inset-y-0 end-0 inline-flex size-11 items-center justify-center rounded-e-[10px] text-gray-600 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:text-white"
              :aria-label="t('auth.signIn.showPassword')"
              :aria-pressed="shown ? 'true' : 'false'"
              :aria-controls="`${passwordId} ${repeatId}`"
              @click="shown = !shown"
            >
              <EyeOffIcon v-if="shown" class="size-5" />
              <EyeIcon v-else class="size-5" />
            </button>
          </div>
          <CopyButton
            v-if="generated"
            :text="generated"
            :label="t('forms.passwordRules.copyGenerated')"
          />
        </div>
      </template>
    </FormField>
    <HibpCheck v-if="hibp" :password="password" @empty="focusPassword" />
    <ul v-if="rules.length > 0" data-password-policy class="flex flex-col gap-1 text-sm">
      <li
        v-for="rule in rules"
        :key="rule.id"
        :data-rule="rule.id"
        :data-met="isMet(rule.id, rule.met) ? 'true' : 'false'"
        class="flex items-start gap-2"
        :class="
          isMet(rule.id, rule.met)
            ? 'text-green-700 dark:text-green-400'
            : 'text-gray-700 dark:text-gray-300'
        "
      >
        <CheckIcon v-if="isMet(rule.id, rule.met)" class="mt-0.5 size-4 shrink-0" />
        <CloseIcon v-else class="mt-0.5 size-4 shrink-0" />
        <span>
          <LegacyText :k="rule.key" :args="rule.args" />
          <span class="sr-only">
            {{
              ` (${isMet(rule.id, rule.met) ? t('forms.passwordRules.met') : t('forms.passwordRules.notMet')})`
            }}
          </span>
        </span>
      </li>
    </ul>
    <FormField :id="repeatId" :label="lt(repeatKey)" :errors="repeatMessages">
      <template #default="control">
        <input
          v-bind="control"
          :value="password2"
          :type="shown ? 'text' : 'password'"
          autocomplete="new-password"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          :maxlength="MAILBOX_PASSWORD_MAX"
          class="form-control"
          @input="emit('update:password2', ($event.target as HTMLInputElement).value)"
          @blur="repeatTouched = true"
        />
      </template>
    </FormField>
  </div>
</template>
