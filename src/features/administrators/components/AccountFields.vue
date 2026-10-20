<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PasswordPolicy } from '@/api'
import { domainPickerSource } from '@/features/aliases-common'
import { lt } from '@/i18n'
import DomainPicker from '@/shared/components/DomainPicker.vue'
import FormField from '@/shared/components/FormField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import NewPasswordFields from '@/shared/components/password/NewPasswordFields.vue'
import { Switch } from '@/shared/ui/switch'
import type { AccountForm } from '../account-form'
import type { AccountRole } from '../api'
import { normaliseUsername } from '../username'
const props = withDefaults(
  defineProps<{
    modelValue: AccountForm
    role: AccountRole
    mode: 'create' | 'edit'
    idPrefix: string
    policy?: PasswordPolicy | null
    productName?: string
    errors?: (path: string) => string[]
    activeDisabledReason?: string | null
    maxUsernameLength?: number
  }>(),
  {
    policy: null,
    productName: 'mailcow',
    errors: () => [],
    activeDisabledReason: null,
    maxUsernameLength: 255,
  },
)
const emit = defineEmits<{ 'update:modelValue': [value: AccountForm] }>()
const { t } = useI18n()
const sources = [domainPickerSource()]
const editing = computed(() => props.mode === 'edit')
const keys = computed(() =>
  editing.value
    ? {
        username: 'edit.username' as const,
        password: 'edit.password' as const,
        repeat: 'edit.password_repeat' as const,
        generate: 'edit.generate' as const,
        active: 'edit.active' as const,
      }
    : {
        username: 'admin.username' as const,
        password: 'admin.password' as const,
        repeat: 'admin.password_repeat' as const,
        generate: 'admin.generate' as const,
        active: 'admin.active' as const,
      },
)
const hashPrefix = computed(() => /^\{[a-z0-9-]+\}/i.test(props.modelValue.password))
const current = shallowRef(props.modelValue)
watch(
  () => props.modelValue,
  (value) => {
    current.value = value
  },
  { flush: 'sync' },
)
function update<K extends keyof AccountForm>(key: K, value: AccountForm[K]) {
  // Generate emits password and confirmation together, before parent props flush.
  current.value = { ...current.value, [key]: value }
  emit('update:modelValue', current.value)
}
</script>
<template>
  <div class="flex min-w-0 flex-col gap-4" data-account-fields>
    <FormField
      :id="`${idPrefix}-username`"
      :label="lt(keys.username)"
      :description="t('accounts.usernameHint')"
      :errors="errors('username')"
      required
    >
      <template #default="control"
        ><input
          v-bind="control"
          name="accountUsername"
          :value="modelValue.username"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          :maxlength="maxUsernameLength"
          class="form-control"
          @input="update('username', ($event.target as HTMLInputElement).value)"
          @blur="update('username', normaliseUsername(modelValue.username))"
      /></template>
    </FormField>
    <DomainPicker
      v-if="role === 'domainAdmin'"
      :id="`${idPrefix}-domains`"
      :label="editing ? lt('edit.domains') : lt('admin.admin_domains')"
      :model-value="modelValue.domains"
      :sources="sources"
      multiple
      required
      :errors="errors('domains')"
      :placeholder="lt('admin.search_domain_da')"
      @update:model-value="update('domains', Array.isArray($event) ? $event : [])"
    />
    <p v-if="editing" class="text-sm text-gray-600 dark:text-gray-400">
      {{ lt('edit.unchanged_if_empty') }}
    </p>
    <NewPasswordFields
      :id-prefix="idPrefix"
      :password="modelValue.password"
      :password2="modelValue.password2"
      :policy="hashPrefix ? null : policy"
      :username="modelValue.username"
      :label-key="keys.password"
      :repeat-key="keys.repeat"
      :generate-key="keys.generate"
      hibp
      :errors="errors('password')"
      :repeat-errors="errors('password2')"
      @update:password="update('password', $event)"
      @update:password2="update('password2', $event)"
    />
    <p v-if="hashPrefix" class="text-sm text-gray-600 dark:text-gray-400">
      {{ t('accounts.preHashedPassword') }}
    </p>
    <div class="flex min-h-11 items-center justify-between gap-4">
      <label
        :for="`${idPrefix}-active`"
        class="text-sm font-medium text-gray-800 dark:text-gray-200"
        >{{ lt(keys.active) }}</label
      >
      <Switch
        :id="`${idPrefix}-active`"
        :model-value="modelValue.active"
        :disabled="!!activeDisabledReason"
        :aria-describedby="activeDisabledReason ? `${idPrefix}-active-reason` : undefined"
        @update:model-value="update('active', $event)"
      />
    </div>
    <p
      v-if="activeDisabledReason"
      :id="`${idPrefix}-active-reason`"
      class="text-sm text-gray-600 dark:text-gray-400"
    >
      {{ activeDisabledReason }}
    </p>
    <template v-if="editing">
      <slot name="suspension" />
      <div class="flex min-h-11 items-center justify-between gap-4">
        <label
          :for="`${idPrefix}-forceSecondFactorSetup`"
          class="text-sm font-medium text-gray-800 dark:text-gray-200"
          >{{ lt('tfa.force_tfa') }}</label
        >
        <Switch
          :id="`${idPrefix}-forceSecondFactorSetup`"
          :model-value="modelValue.forceSecondFactorSetup"
          :aria-describedby="`${idPrefix}-tfa-help`"
          @update:model-value="update('forceSecondFactorSetup', $event)"
        />
      </div>
      <LegacyText
        :id="`${idPrefix}-tfa-help`"
        k="tfa.force_tfa_info"
        as="p"
        class="text-sm text-gray-600 dark:text-gray-400"
      />
      <div class="flex min-h-11 items-center justify-between gap-4">
        <label
          :for="`${idPrefix}-forcePasswordChange`"
          class="text-sm font-medium text-gray-800 dark:text-gray-200"
          >{{ lt('edit.force_pw_update') }}</label
        >
        <Switch
          :id="`${idPrefix}-forcePasswordChange`"
          :model-value="modelValue.forcePasswordChange"
          :aria-describedby="`${idPrefix}-password-help`"
          @update:model-value="update('forcePasswordChange', $event)"
        />
      </div>
      <LegacyText
        :id="`${idPrefix}-password-help`"
        k="edit.force_pw_update_info"
        :args="[productName]"
        as="p"
        class="text-sm text-gray-600 dark:text-gray-400"
      />
    </template>
  </div>
</template>
