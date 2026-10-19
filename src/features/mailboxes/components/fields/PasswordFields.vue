<script setup lang="ts">
// The password of the classic add and edit forms (FR-028 to FR-030 under the forms rule): the
// password with its "generate" action, the haveibeenpwned check under it (shared `HibpCheck`), the
// password policy as legacy lists it, and the confirmation password. "generate" fills both fields
// with a password that meets the policy and shows them, as legacy's generator does. On the edit form
// the field says "If unchanged leave blank". The values live in the parent's memory only.
import { computed, nextTick, ref } from 'vue'

import { lt, type LegacyKey } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'
import HibpCheck from '@/shared/components/HibpCheck.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import { MAILBOX_PASSWORD_MAX } from '@/shared/validation/limits'

import { generatePassword } from '@/shared/password/generate'
import { policyRules, type PolicyValues } from '@/shared/password/policy-rules'

const props = withDefaults(
  defineProps<{
    idPrefix: string
    mode: 'add' | 'edit'
    password: string
    password2: string
    /** The policy, or null when it could not be read (no rules are listed, as in legacy). */
    policy?: PolicyValues | null
    errors?: readonly string[]
    repeatErrors?: readonly string[]
  }>(),
  { policy: null, errors: () => [], repeatErrors: () => [] },
)
const emit = defineEmits<{
  'update:password': [value: string]
  'update:password2': [value: string]
}>()

const shown = ref(false)
const input = ref<HTMLInputElement | null>(null)
const keys = computed(() => ({
  label: `${props.mode}.password` as LegacyKey,
  generate: `${props.mode}.generate` as LegacyKey,
  repeat: `${props.mode}.password_repeat` as LegacyKey,
}))
const rules = computed(() => (props.policy ? policyRules(props.policy) : []))
const passwordId = computed(() => `${props.idPrefix}-password`)
const repeatId = computed(() => `${props.idPrefix}-password2`)

function generate() {
  const value = generatePassword(props.policy)
  shown.value = true
  emit('update:password', value)
  emit('update:password2', value)
}

async function focusPassword() {
  await nextTick()
  input.value?.focus()
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <FormField :id="passwordId" :label="lt(keys.label)" :errors="errors">
      <template #default="control">
        <div class="flex flex-col gap-1">
          <button
            type="button"
            data-generate
            class="text-link self-start text-sm"
            @click="generate"
          >
            ({{ lt(keys.generate) }})
          </button>
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
            :placeholder="mode === 'edit' ? lt('edit.unchanged_if_empty') : undefined"
            class="form-control"
            @input="emit('update:password', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </template>
    </FormField>
    <HibpCheck :password="password" @empty="focusPassword" />
    <ul
      v-if="rules.length > 0"
      data-password-policy
      class="list-disc ps-5 text-sm text-gray-600 dark:text-gray-400"
    >
      <li v-for="rule in rules" :key="rule.key">
        <LegacyText :k="rule.key" :args="rule.args" />
      </li>
    </ul>
    <FormField :id="repeatId" :label="lt(keys.repeat)" :errors="repeatErrors">
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
        />
      </template>
    </FormField>
  </div>
</template>
