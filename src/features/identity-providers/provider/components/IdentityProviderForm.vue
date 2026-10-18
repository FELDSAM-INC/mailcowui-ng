<script setup lang="ts">
// The classic identity provider form (`templates/admin/tab-config-identity-provider.twig`, plan
// "Legacy form map"): legacy's provider select (`admin.iam`, the options Keycloak, Generic-OIDC and
// LDAP), then the chosen type's fields in legacy's order with legacy's labels, help texts and
// placeholders, and the connection test. Help that legacy shows as a tooltip is visible text
// (FR-074). The LDAP hosts are legacy's one comma-separated field, and SSL and StartTLS legacy's
// two switches, of which only one can be on (legacy's `onchange`).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import {
  identityProviderTypeValues,
  type ApiProblem,
  type IdentityProviderCapabilities,
  type IdentityProviderConnectionTestResult,
  type IdentityProviderType,
} from '@/api'
import FormField from '@/shared/components/FormField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'

import { SECRET_OF, type ProviderForm } from '../form-model'
import { typeLabelKey } from '../labels'
import type { SecretRequirement } from '../secret-rule'
import ConnectionTest from './ConnectionTest.vue'
import MappingField from './MappingField.vue'
import ProviderSecretField from './ProviderSecretField.vue'
import ReturnUrlFields from './ReturnUrlFields.vue'
import { SELECT } from './styles'
import SwitchField from './SwitchField.vue'
import TextField from './TextField.vue'

const form = defineModel<ProviderForm>('form', { required: true })
const props = defineProps<{
  idPrefix: string
  capabilities: IdentityProviderCapabilities
  templates: readonly string[]
  templatesProblem: ApiProblem | null
  secret: SecretRequirement
  /** A secret of the form's type is stored, so an empty field keeps it. */
  keepsStored: boolean
  errorsFor: (path: string) => string[]
  test: {
    running: boolean
    result: IdentityProviderConnectionTestResult | null
    noResult: boolean
    problem: ApiProblem | null
  }
}>()
const emit = defineEmits<{ test: []; retryTemplates: [] }>()
const { t } = useI18n()

const id = (field: string) => `${props.idPrefix}-${field}`
const secretField = computed(() => SECRET_OF[form.value.type])
const secretLabel = computed(() =>
  secretField.value === 'bindPassword' ? lt('admin.iam_bindpass') : lt('admin.iam_client_secret'),
)
const defaults = computed(() => props.capabilities.defaults)
const limits = computed(() => props.capabilities.limits)

function setSsl(on: boolean) {
  form.value.useSsl = on
  if (on) form.value.useStartTls = false
}
function setStartTls(on: boolean) {
  form.value.useStartTls = on
  if (on) form.value.useSsl = false
}
function setType(event: Event) {
  form.value.type = (event.target as HTMLSelectElement).value as IdentityProviderType
}
</script>

<template>
  <div class="flex flex-col gap-4" :data-provider-type="form.type">
    <FormField :id="id('type')" :label="lt('admin.iam')" required>
      <template #default="control">
        <select
          v-bind="control"
          :value="form.type"
          :class="SELECT"
          class="sm:max-w-sm"
          @change="setType"
        >
          <option v-for="type in identityProviderTypeValues" :key="type" :value="type">
            {{ t(typeLabelKey(type)) }}
          </option>
        </select>
      </template>
    </FormField>

    <template v-if="form.type === 'keycloak'">
      <TextField
        :id="id('serverUrl')"
        v-model="form.serverUrl"
        type="url"
        :label="lt('admin.iam_server_url')"
        required
        :errors="errorsFor('serverUrl')"
      />
      <TextField
        :id="id('realm')"
        v-model="form.realm"
        :label="lt('admin.iam_realm')"
        required
        :errors="errorsFor('realm')"
      />
    </template>

    <template v-if="form.type === 'genericOidc'">
      <TextField
        :id="id('authorizationEndpoint')"
        v-model="form.authorizationEndpoint"
        type="url"
        :label="lt('admin.iam_authorize_url')"
        required
        :errors="errorsFor('authorizationEndpoint')"
      />
      <TextField
        :id="id('tokenEndpoint')"
        v-model="form.tokenEndpoint"
        type="url"
        :label="lt('admin.iam_token_url')"
        required
        :errors="errorsFor('tokenEndpoint')"
      />
      <TextField
        :id="id('userInfoEndpoint')"
        v-model="form.userInfoEndpoint"
        type="url"
        :label="lt('admin.iam_userinfo_url')"
        required
        :errors="errorsFor('userInfoEndpoint')"
      />
    </template>

    <template v-if="form.type !== 'ldap'">
      <TextField
        :id="id('clientId')"
        v-model="form.clientId"
        :label="lt('admin.iam_client_id')"
        required
        :errors="errorsFor('clientId')"
      />
      <ProviderSecretField
        :id="id('clientSecret')"
        v-model="form.clientSecret"
        :label="secretLabel"
        :required="secret !== null"
        :keeps-stored="keepsStored"
        :errors="errorsFor('clientSecret')"
      />
      <ReturnUrlFields
        v-model:legacy-return-url="form.legacyReturnUrl"
        v-model:additional-return-urls="form.additionalReturnUrls"
        :id-prefix="idPrefix"
        :app-return-urls="capabilities.appReturnUrls"
        :errors-for="errorsFor"
      />
    </template>

    <TextField
      v-if="form.type === 'keycloak'"
      :id="id('version')"
      v-model="form.version"
      :label="lt('admin.iam_version')"
      required
      :errors="errorsFor('version')"
    />
    <TextField
      v-if="form.type === 'genericOidc'"
      :id="id('scopes')"
      v-model="form.scopes"
      :label="lt('admin.iam_client_scopes')"
      :placeholder="defaults.scopes"
      :errors="errorsFor('scopes')"
    />

    <template v-if="form.type === 'ldap'">
      <TextField
        :id="id('hosts')"
        v-model="form.hosts"
        :label="lt('admin.iam_host')"
        :description="lt('admin.iam_host_info')"
        required
        :errors="errorsFor('hosts')"
      />
      <TextField
        :id="id('port')"
        v-model="form.port"
        type="number"
        :min="1"
        :max="65535"
        :label="lt('admin.iam_port')"
        required
        :errors="errorsFor('port')"
      />
      <SwitchField
        :id="id('useSsl')"
        :model-value="form.useSsl"
        :label="lt('admin.iam_use_ssl')"
        help="admin.iam_use_ssl_info"
        @update:model-value="setSsl"
      />
      <SwitchField
        :id="id('useStartTls')"
        :model-value="form.useStartTls"
        :label="lt('admin.iam_use_tls')"
        help="admin.iam_use_tls_info"
        @update:model-value="setStartTls"
      />
      <SwitchField
        :id="id('ignoreTlsErrors')"
        v-model="form.ignoreTlsErrors"
        :label="lt('admin.ignore_ssl_error')"
      />
      <TextField
        :id="id('baseDn')"
        v-model="form.baseDn"
        :label="lt('admin.iam_basedn')"
        required
        :errors="errorsFor('baseDn')"
      />
      <TextField
        :id="id('usernameField')"
        v-model="form.usernameField"
        :label="lt('admin.iam_username_field')"
        :placeholder="defaults.usernameField"
        :errors="errorsFor('usernameField')"
      />
      <TextField
        :id="id('filter')"
        v-model="form.filter"
        :label="lt('admin.filter')"
        :errors="errorsFor('filter')"
      />
      <TextField
        :id="id('attributeField')"
        v-model="form.attributeField"
        :label="lt('admin.iam_attribute_field')"
        :required="form.importUsers || form.periodicSync"
        :errors="errorsFor('attributeField')"
      />
      <TextField
        :id="id('bindDn')"
        v-model="form.bindDn"
        :label="lt('admin.iam_binddn')"
        required
        :errors="errorsFor('bindDn')"
      />
      <ProviderSecretField
        :id="id('bindPassword')"
        v-model="form.bindPassword"
        :label="secretLabel"
        :required="secret !== null"
        :keeps-stored="keepsStored"
        :errors="errorsFor('bindPassword')"
      />
    </template>

    <MappingField
      v-model:rows="form.attributeMapping"
      v-model:default-template="form.defaultTemplate"
      :id-prefix="idPrefix"
      :templates="templates"
      :templates-problem="templatesProblem"
      :max="limits.attributeMappingMaxEntries"
      :errors-for="errorsFor"
      @retry-templates="emit('retryTemplates')"
    />

    <template v-if="form.type === 'keycloak'">
      <LegacyText
        k="admin.iam_extra_permission"
        as="p"
        class="text-sm text-gray-700 dark:text-gray-300 [&_code]:font-mono"
      />
      <SwitchField
        :id="id('mailpasswordFlow')"
        v-model="form.mailpasswordFlow"
        :label="lt('admin.iam_rest_flow')"
        help="admin.iam_auth_flow_info"
      />
    </template>
    <SwitchField
      v-if="form.type !== 'ldap'"
      :id="id('ignoreTlsErrors')"
      v-model="form.ignoreTlsErrors"
      :label="lt('admin.ignore_ssl_error')"
    />
    <SwitchField
      :id="id('createMailboxOnSignIn')"
      v-model="form.createMailboxOnSignIn"
      :label="lt('admin.iam_login_provisioning')"
    />
    <template v-if="form.type !== 'genericOidc'">
      <SwitchField
        :id="id('periodicSync')"
        v-model="form.periodicSync"
        :label="lt('admin.iam_periodic_full_sync')"
      />
      <SwitchField
        :id="id('importUsers')"
        v-model="form.importUsers"
        :label="lt('admin.iam_import_users')"
      />
      <TextField
        :id="id('syncInterval')"
        v-model="form.syncInterval"
        type="number"
        :min="limits.syncIntervalMinMinutes"
        :max="limits.syncIntervalMaxMinutes"
        :label="lt('admin.iam_sync_interval')"
        :errors="errorsFor('syncInterval')"
      />
    </template>

    <ConnectionTest
      :running="test.running"
      :result="test.result"
      :no-result="test.noResult"
      :problem="test.problem"
      @test="emit('test')"
    />
  </div>
</template>
