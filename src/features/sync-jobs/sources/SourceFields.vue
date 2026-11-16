<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { lt } from '@/i18n'
import type { Role } from '@/api'
import { domainPickerSource } from '@/features/aliases-common'
import DomainPicker from '@/shared/components/DomainPicker.vue'
import MailboxSearchPicker from '@/shared/components/MailboxSearchPicker.vue'
import FormField from '@/shared/components/FormField.vue'
import { buttonVariants } from '@/shared/ui/button'
import { applyPreset, passwordProviders, type ProviderPreset } from './presets'
import { sourceFieldId as id, type SourceForm } from './form'
import type { SyncSource } from './api'
const form = defineModel<SourceForm>({ required: true })
const props = defineProps<{
  role: Role
  creating: boolean
  stored?: SyncSource
  errorsFor: (path: string) => readonly string[]
}>()
const { t } = useI18n()
const preset = ref<ProviderPreset>('gmail'),
  tenant = ref('')
const oauth = computed(() => form.value.authMechanism === 'xoauth2')
const privateOnly = computed(
  () =>
    props.role === 'mailboxUser' || (oauth.value && form.value.oauth.flow === 'client_credentials'),
)
watch(privateOnly, (value) => {
  if (value) {
    form.value.scope = 'user'
    form.value.domains = []
    form.value.users = []
  }
})
const oauthTextFields = computed(
  () =>
    [
      'tokenEndpoint',
      ...(form.value.oauth.flow === 'authorization_code'
        ? ['authorizationEndpoint', 'userInfoEndpoint']
        : []),
      'clientId',
      'scope',
    ] as (keyof Pick<
      SourceForm['oauth'],
      'tokenEndpoint' | 'authorizationEndpoint' | 'userInfoEndpoint' | 'clientId' | 'scope'
    >)[],
)
</script>
<template>
  <div v-if="creating" class="space-y-3 border-b border-line pb-4">
    <div class="flex flex-wrap items-end gap-3">
      <FormField id="source-preset" :label="t('syncSources.preset')"
        ><template #default="control"
          ><select v-bind="control" v-model="preset" class="form-control">
            <option v-for="key in Object.keys(passwordProviders)" :key="key" :value="key">
              {{ t(`syncSources.providers.${key}`) }}
            </option>
            <template v-if="role !== 'mailboxUser'"
              ><option
                v-for="key in ['microsoftApp', 'microsoftUser', 'googleUser']"
                :key="key"
                :value="key"
              >
                {{ t(`syncSources.providers.${key}`) }}
              </option></template
            >
          </select></template
        ></FormField
      >
      <FormField
        v-if="preset.startsWith('microsoft')"
        id="source-tenant"
        :label="t('syncSources.tenant')"
        ><template #default="control"
          ><input
            v-bind="control"
            v-model="tenant"
            class="form-control"
            placeholder="common" /></template
      ></FormField>
      <button
        type="button"
        :class="buttonVariants({ variant: 'outline' })"
        @click="applyPreset(form, preset, tenant)"
      >
        {{ t('syncSources.applyPreset') }}
      </button>
    </div>
    <p class="text-sm text-muted">
      {{
        preset in passwordProviders
          ? lt('syncjobs.source_presets_hint')
          : t('syncSources.oauthPresetHelp')
      }}
    </p>
  </div>
  <div class="grid min-w-0 gap-4 md:grid-cols-2">
    <FormField
      v-for="field in ['name', 'remoteHost'] as const"
      :id="id(field)"
      :key="field"
      :label="t(`syncSources.fields.${field}`)"
      :errors="errorsFor(field)"
      required
      ><template #default="control"
        ><input
          v-bind="control"
          v-model="form[field]"
          class="form-control"
          required
          :maxlength="field === 'name' ? 100 : 253" /></template
    ></FormField>
    <FormField
      :id="id('remotePort')"
      :label="t('syncSources.fields.remotePort')"
      :errors="errorsFor('remotePort')"
      required
      ><template #default="control"
        ><input
          v-bind="control"
          v-model.number="form.remotePort"
          class="form-control"
          type="number"
          min="1"
          max="65535"
          step="1"
          required /></template
    ></FormField>
    <FormField
      :id="id('encryption')"
      :label="t('syncSources.fields.encryption')"
      :errors="errorsFor('encryption')"
      ><template #default="control"
        ><select v-bind="control" v-model="form.encryption" class="form-control">
          <option v-for="value in ['ssl', 'starttls', 'plain']" :key="value" :value="value">
            {{ t(`enums.syncJobEncryption.${value}`) }}
          </option>
        </select></template
      ></FormField
    >
    <FormField
      :id="id('authMechanism')"
      :label="t('syncSources.fields.authMechanism')"
      :errors="errorsFor('authMechanism')"
      ><template #default="control"
        ><select v-bind="control" v-model="form.authMechanism" class="form-control">
          <option
            v-for="value in role === 'mailboxUser'
              ? ['plain', 'login', 'cram-md5']
              : ['plain', 'login', 'cram-md5', 'xoauth2']"
            :key="value"
            :value="value"
          >
            {{ value.toUpperCase() }}
          </option>
        </select></template
      ></FormField
    >
    <FormField
      v-for="flag in ['active', 'verifyCertificate'] as const"
      :id="id(flag)"
      :key="flag"
      :label="t(`syncSources.fields.${flag}`)"
      :errors="errorsFor(flag)"
      ><template #default="control"
        ><input
          v-bind="control"
          v-model="form[flag]"
          type="checkbox"
          role="switch"
          class="size-5 accent-accent" /></template
    ></FormField>
    <FormField
      :id="id('description')"
      :label="t('syncSources.fields.description')"
      :errors="errorsFor('description')"
      class="md:col-span-2"
      ><template #default="control">
        <textarea
          v-bind="control"
          v-model="form.description"
          class="form-control"
          maxlength="255"
          rows="2"
        /></template
    ></FormField>
  </div>
  <div v-if="!privateOnly" class="space-y-3 border-t border-line pt-4">
    <FormField
      :id="id('scope')"
      :label="t('syncSources.fields.scope')"
      :description="t('syncSources.scopeHelp')"
      :errors="errorsFor('scope')"
      ><template #default="control"
        ><select v-bind="control" v-model="form.scope" class="form-control">
          <option
            v-for="value in role === 'admin' ? ['user', 'domain', 'all'] : ['user', 'domain']"
            :key="value"
            :value="value"
          >
            {{ t(`syncSources.scopes.${value}`) }}
          </option>
        </select></template
      ></FormField
    >
    <DomainPicker
      v-if="form.scope === 'domain'"
      :id="id('domains')"
      :label="t('syncSources.fields.domains')"
      :sources="[domainPickerSource()]"
      :model-value="form.domains"
      multiple
      :errors="errorsFor('domains')"
      @update:model-value="form.domains = Array.isArray($event) ? $event : []"
    />
    <MailboxSearchPicker
      v-if="form.scope === 'user'"
      :id="id('users')"
      :label="t('syncSources.fields.users')"
      :model-value="form.users"
      multiple
      :errors="errorsFor('users')"
      @update:model-value="form.users = Array.isArray($event) ? $event : []"
    />
  </div>
  <p v-else class="text-sm text-muted">{{ t('syncSources.privateHelp') }}</p>
  <fieldset v-if="oauth" class="min-w-0 space-y-4 border-t border-line pt-4">
    <legend class="text-base font-semibold">OAuth 2.0</legend>
    <FormField
      :id="id('oauth.flow')"
      :label="t('syncSources.fields.flow')"
      :errors="errorsFor('oauth.flow')"
      ><template #default="control"
        ><select v-bind="control" v-model="form.oauth.flow" class="form-control">
          <option value="authorization_code">
            {{ t('syncSources.flows.authorization_code') }}
          </option>
          <option value="client_credentials">
            {{ t('syncSources.flows.client_credentials') }}
          </option>
        </select></template
      ></FormField
    >
    <p
      v-if="stored?.oauth?.redirectUri && form.oauth.flow === 'authorization_code'"
      class="wrap-anywhere text-sm text-muted"
    >
      {{ t('syncSources.redirectHelp') }} <code>{{ stored.oauth.redirectUri }}</code>
    </p>
    <div class="grid min-w-0 gap-4 md:grid-cols-2">
      <FormField
        v-for="field in oauthTextFields"
        :id="id(`oauth.${field}`)"
        :key="field"
        :label="t(`syncSources.fields.${field === 'scope' ? 'oauthScope' : field}`)"
        :errors="errorsFor(`oauth.${field}`)"
        :required="field !== 'userInfoEndpoint'"
        ><template #default="control"
          ><input
            v-bind="control"
            v-model="form.oauth[field]"
            class="form-control"
            maxlength="500"
            :required="field !== 'userInfoEndpoint'"
            :type="field.endsWith('Endpoint') ? 'url' : 'text'" /></template
      ></FormField>
      <FormField
        :id="id('oauth.clientSecret')"
        :label="t('syncSources.fields.clientSecret')"
        :errors="errorsFor('oauth.clientSecret')"
        :description="stored?.oauth?.clientSecretSet ? t('syncSources.secretKept') : undefined"
        :required="!stored?.oauth?.clientSecretSet"
        ><template #default="control"
          ><input
            v-bind="control"
            v-model="form.oauth.clientSecret"
            type="password"
            autocomplete="new-password"
            class="form-control"
            maxlength="500"
            :required="!stored?.oauth?.clientSecretSet" /></template
      ></FormField>
    </div>
    <FormField
      :id="id('oauth.extraParameters')"
      :label="t('syncSources.fields.extraParameters')"
      :errors="errorsFor('oauth.extraParameters')"
      :description="t('syncSources.extraHelp')"
      ><template #default="control">
        <textarea
          v-bind="control"
          v-model="form.oauth.extraParameters"
          class="form-control font-mono"
          rows="4"
          maxlength="4000"
        /></template
    ></FormField>
  </fieldset>
  <p
    v-if="!form.verifyCertificate || form.encryption === 'plain'"
    role="status"
    class="text-sm text-warning"
  >
    {{ t('syncSources.insecure') }}
  </p>
</template>
