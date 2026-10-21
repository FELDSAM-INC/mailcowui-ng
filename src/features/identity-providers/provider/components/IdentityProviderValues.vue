<script setup lang="ts">
// The stored configuration, read-only (FR-005 to FR-007 within the legacy form map): the type's
// fields in legacy's order with legacy's labels, as text (never as disabled inputs). Secrets show
// only that one is stored (FR-023); switches show yes or no, empty optional values "None". The app's
// return addresses stay copyable here, so they can be registered without opening the form.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt, type LegacyKey } from '@/i18n'

import { typeLabelKey } from '../labels'
import type { IdentityProviderConfig } from '../types'
import AppReturnAddresses from './AppReturnAddresses.vue'

const props = defineProps<{ config: IdentityProviderConfig; idPrefix: string }>()
const { t } = useI18n()

interface Row {
  key: string
  label: string
  value: string
}

const none = () => t('domains.values.none')
const text = (value: string | null | undefined) => (value ? value : none())
const yesNo = (value: boolean) => t(value ? 'domains.values.yes' : 'domains.values.no')
const secret = (set: boolean) => (set ? t('identityProvider.stored') : none())
const row = (key: string, label: LegacyKey, value: string): Row => ({
  key,
  label: lt(label),
  value,
})

const rows = computed<Row[]>(() => {
  const c = props.config
  const head = [row('type', 'admin.iam', t(typeLabelKey(c.type)))]
  switch (c.type) {
    case 'keycloak':
      return [
        ...head,
        row('serverUrl', 'admin.iam_server_url', text(c.serverUrl)),
        row('realm', 'admin.iam_realm', text(c.realm)),
        row('clientId', 'admin.iam_client_id', text(c.clientId)),
        row('clientSecret', 'admin.iam_client_secret', secret(c.clientSecretSet)),
        row('legacyReturnUrl', 'admin.iam_redirect_url', text(c.legacyReturnUrl)),
        ...c.additionalReturnUrls.map((url, index) =>
          row(`additionalReturnUrls.${index}`, 'admin.iam_redirect_url', url),
        ),
        row('version', 'admin.iam_version', text(c.version)),
      ]
    case 'genericOidc':
      return [
        ...head,
        row('authorizationEndpoint', 'admin.iam_authorize_url', text(c.authorizationEndpoint)),
        row('tokenEndpoint', 'admin.iam_token_url', text(c.tokenEndpoint)),
        row('userInfoEndpoint', 'admin.iam_userinfo_url', text(c.userInfoEndpoint)),
        row('clientId', 'admin.iam_client_id', text(c.clientId)),
        row('clientSecret', 'admin.iam_client_secret', secret(c.clientSecretSet)),
        row('legacyReturnUrl', 'admin.iam_redirect_url', text(c.legacyReturnUrl)),
        ...c.additionalReturnUrls.map((url, index) =>
          row(`additionalReturnUrls.${index}`, 'admin.iam_redirect_url', url),
        ),
        row('scopes', 'admin.iam_client_scopes', text(c.scopes)),
      ]
    case 'ldap':
      return [
        ...head,
        row('hosts', 'admin.iam_host', text(c.hosts.join(', '))),
        row('port', 'admin.iam_port', String(c.port)),
        row('useSsl', 'admin.iam_use_ssl', yesNo(c.useSsl)),
        row('useStartTls', 'admin.iam_use_tls', yesNo(c.useStartTls)),
        row('ignoreTlsErrors', 'admin.ignore_ssl_error', yesNo(c.ignoreTlsErrors)),
        row('baseDn', 'admin.iam_basedn', text(c.baseDn)),
        row('usernameField', 'admin.iam_username_field', text(c.usernameField)),
        row('filter', 'admin.filter', text(c.filter)),
        row('attributeField', 'admin.iam_attribute_field', text(c.attributeField)),
        row('bindDn', 'admin.iam_binddn', text(c.bindDn)),
        row('bindPassword', 'admin.iam_bindpass', secret(c.bindPasswordSet)),
      ]
  }
})

const after = computed<Row[]>(() => {
  const c = props.config
  const switches: Row[] = []
  if (c.type === 'keycloak') {
    switches.push(row('mailpasswordFlow', 'admin.iam_rest_flow', yesNo(c.mailpasswordFlow)))
  }
  if (c.type !== 'ldap') {
    switches.push(row('ignoreTlsErrors', 'admin.ignore_ssl_error', yesNo(c.ignoreTlsErrors)))
  }
  switches.push(
    row('createMailboxOnSignIn', 'admin.iam_login_provisioning', yesNo(c.createMailboxOnSignIn)),
  )
  if (c.type !== 'genericOidc') {
    switches.push(
      row('periodicSync', 'admin.iam_periodic_full_sync', yesNo(c.periodicSync)),
      row('importUsers', 'admin.iam_import_users', yesNo(c.importUsers)),
      row('syncInterval', 'admin.iam_sync_interval', String(c.syncInterval)),
    )
  }
  return switches
})

const appReturnUrls = computed(() =>
  props.config.type === 'ldap' ? [] : props.config.appReturnUrls,
)
</script>

<template>
  <div class="flex flex-col gap-4">
    <dl class="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      <div v-for="item in rows" :key="item.key" :data-value="item.key" class="min-w-0">
        <dt class="text-gray-600 dark:text-gray-400">{{ item.label }}</dt>
        <dd class="break-words text-gray-900 [overflow-wrap:anywhere] dark:text-white">
          {{ item.value }}
        </dd>
      </div>
    </dl>
    <AppReturnAddresses :id-prefix="idPrefix" :urls="appReturnUrls" />
    <div data-value="attributeMapping" class="flex flex-col gap-2 text-sm">
      <p class="text-gray-600 dark:text-gray-400">{{ lt('admin.iam_mapping') }}</p>
      <dl class="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <div data-value="defaultTemplate" class="min-w-0">
          <dt class="text-gray-600 dark:text-gray-400">{{ lt('admin.iam_default_template') }}</dt>
          <dd class="break-words text-gray-900 dark:text-white">
            {{ text(config.defaultTemplate) }}
          </dd>
        </div>
      </dl>
      <div v-if="config.attributeMapping.length > 0" class="table-frame">
        <table class="data-table w-full table-fixed text-start">
          <thead>
            <tr>
              <th scope="col" class="pb-1 text-start">{{ lt('user.attribute') }}</th>
              <th scope="col" class="pb-1 text-start">{{ lt('mailbox.template') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(entry, index) in config.attributeMapping"
              :key="index"
              class="border-t border-gray-100 text-gray-900 dark:border-gray-800 dark:text-white"
            >
              <td class="py-1 pe-3 break-words [overflow-wrap:anywhere]">
                {{ entry.attributeValue }}
              </td>
              <td class="py-1 break-words [overflow-wrap:anywhere]">{{ entry.template }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="text-gray-900 dark:text-white">{{ none() }}</p>
    </div>
    <dl class="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      <div v-for="item in after" :key="item.key" :data-value="item.key" class="min-w-0">
        <dt class="text-gray-600 dark:text-gray-400">{{ item.label }}</dt>
        <dd class="break-words text-gray-900 dark:text-white">{{ item.value }}</dd>
      </div>
    </dl>
  </div>
</template>
