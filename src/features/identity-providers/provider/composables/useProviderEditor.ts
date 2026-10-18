// The identity provider form's behaviour (UI 012 US1, US4, plan "Legacy form map"): one form for the
// first setup and for changes of the stored configuration.
// - The client rules and the secret rule run before anything is sent (FR-018, FR-024, FR-025).
// - A first setup is a create-only whole save; a change of the stored type sends the merge patch of
//   the user's changes against the version the form was opened with; another type is a whole save
//   with the version tag read (FR-012, FR-013, FR-015).
// - An outdated save keeps the input, reloads, lists what changed elsewhere, and saves again only
//   when asked (FR-017); "not configured" means it was removed elsewhere.
// - Field errors land on their fields with a summary (FR-069); the secret is emptied after every
//   outcome (FR-026); outcomes use legacy's messages (`success.object_modified`).
// - The connection test uses the entered values, completed by the stored secret only where the API
//   allows it (FR-034).
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  ApiProblem,
  isApiProblem,
  type FieldViolation,
  type IdentityProviderCapabilities,
  type IdentityProviderType,
} from '@/api'
import { lt, type LegacyKey } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import { DEFAULT_LOCALE, isAppLocale } from '@/i18n/locales'
import { useProblemMessages } from '@/i18n/problems'
import type { SectionChange, SectionStatus } from '@/shared/components/editable-section'
import { announce } from '@/shared/composables/useAnnouncer'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useVersionedSave } from '@/shared/composables/useVersionedSave'

import {
  forgetConfiguration,
  saveIdentityProvider,
  updateIdentityProvider,
  type IdentityProviderConfig,
} from '../api'
import {
  formFromConfig,
  formFromDefaults,
  SECRET_OF,
  toInput,
  toPatch,
  type ProviderForm,
} from '../form-model'
import { secretRequirement } from '../secret-rule'
import { validateForm, type RuleErrors } from '../validation'
import { useConnectionTest } from './useConnectionTest'

export const FORM_ID = 'idp'

/** Legacy's label of every member, for the outdated notice and rule parameters. */
export const FIELD_LABELS: Record<string, LegacyKey> = {
  type: 'admin.iam',
  serverUrl: 'admin.iam_server_url',
  realm: 'admin.iam_realm',
  clientId: 'admin.iam_client_id',
  clientSecret: 'admin.iam_client_secret',
  version: 'admin.iam_version',
  authorizationEndpoint: 'admin.iam_authorize_url',
  tokenEndpoint: 'admin.iam_token_url',
  userInfoEndpoint: 'admin.iam_userinfo_url',
  scopes: 'admin.iam_client_scopes',
  legacyReturnUrl: 'admin.iam_redirect_url',
  additionalReturnUrls: 'admin.iam_redirect_url',
  hosts: 'admin.iam_host',
  port: 'admin.iam_port',
  useSsl: 'admin.iam_use_ssl',
  useStartTls: 'admin.iam_use_tls',
  baseDn: 'admin.iam_basedn',
  usernameField: 'admin.iam_username_field',
  filter: 'admin.filter',
  attributeField: 'admin.iam_attribute_field',
  bindDn: 'admin.iam_binddn',
  bindPassword: 'admin.iam_bindpass',
  attributeMapping: 'admin.iam_mapping',
  defaultTemplate: 'admin.iam_default_template',
  createMailboxOnSignIn: 'admin.iam_login_provisioning',
  ignoreTlsErrors: 'admin.ignore_ssl_error',
  mailpasswordFlow: 'admin.iam_rest_flow',
  importUsers: 'admin.iam_import_users',
  periodicSync: 'admin.iam_periodic_full_sync',
  syncInterval: 'admin.iam_sync_interval',
}

/** The members each type's form shows, for mapping the API's error paths to fields. */
const MEMBERS: Record<IdentityProviderType, readonly string[]> = {
  keycloak: [
    'type',
    'serverUrl',
    'realm',
    'clientId',
    'clientSecret',
    'legacyReturnUrl',
    'additionalReturnUrls',
    'version',
    'attributeMapping',
    'defaultTemplate',
    'mailpasswordFlow',
    'ignoreTlsErrors',
    'createMailboxOnSignIn',
    'periodicSync',
    'importUsers',
    'syncInterval',
  ],
  genericOidc: [
    'type',
    'authorizationEndpoint',
    'tokenEndpoint',
    'userInfoEndpoint',
    'clientId',
    'clientSecret',
    'legacyReturnUrl',
    'additionalReturnUrls',
    'scopes',
    'attributeMapping',
    'defaultTemplate',
    'ignoreTlsErrors',
    'createMailboxOnSignIn',
  ],
  ldap: [
    'type',
    'hosts',
    'port',
    'useSsl',
    'useStartTls',
    'ignoreTlsErrors',
    'baseDn',
    'usernameField',
    'filter',
    'attributeField',
    'bindDn',
    'bindPassword',
    'attributeMapping',
    'defaultTemplate',
    'createMailboxOnSignIn',
    'periodicSync',
    'importUsers',
    'syncInterval',
  ],
}

/** The element ID of a field path (`attributeMapping.2.template`), or null when not shown. */
export function fieldIdOf(type: IdentityProviderType, path: string): string | null {
  const [member = '', index, sub] = path.split('.')
  if (!MEMBERS[type].includes(member)) return null
  if (member === 'attributeMapping') {
    return index === undefined
      ? `${FORM_ID}-attributeMapping-add`
      : `${FORM_ID}-attributeMapping-${index}-${sub ?? 'attributeValue'}`
  }
  if (member === 'additionalReturnUrls' && index !== undefined) {
    return `${FORM_ID}-additionalReturnUrls-${index}`
  }
  return `${FORM_ID}-${member}`
}

/** The API reports host errors per entry (`hosts.0`); the form has legacy's single host field. */
function onFormPaths(problem: ApiProblem): ApiProblem {
  if (problem.fieldErrors.size === 0) return problem
  const fieldErrors = new Map<string, FieldViolation[]>()
  for (const [path, violations] of problem.fieldErrors) {
    const target = /^hosts\.\d+$/.test(path) ? 'hosts' : path
    fieldErrors.set(target, [...(fieldErrors.get(target) ?? []), ...violations])
  }
  return ApiProblem.fromParts({
    kind: problem.kind,
    type: problem.type,
    status: problem.status,
    requestId: problem.requestId,
    fieldErrors,
    extensions: { ...problem.extensions },
  })
}

export type SaveOutcome =
  'saved' | 'created' | 'invalid' | 'failed' | 'outdated' | 'unchanged' | 'removed'

export interface ProviderEditorOptions {
  capabilities: () => IdentityProviderCapabilities | undefined
  /** The stored configuration as last read; null when none is stored. */
  config: () => IdentityProviderConfig | null | undefined
  refetch: () => Promise<IdentityProviderConfig | null | undefined>
}

export function useProviderEditor(options: ProviderEditorOptions) {
  const { t, locale } = useI18n()
  const { problemMessage } = useProblemMessages()
  const queryClient = useQueryClient()
  const form = ref<ProviderForm | null>(null) as Ref<ProviderForm | null>
  /** The version the form was opened with: the patch holds the user's changes against it. */
  const opened = ref<IdentityProviderConfig | null>(null) as Ref<IdentityProviderConfig | null>
  const pristine = ref('')
  const outdated = ref<SectionChange[] | null>(null)
  const saving = ref(false)
  const status = ref<SectionStatus | null>(null)
  const test = useConnectionTest()

  const problemForm = useProblemForm({
    fieldId: (path) => (form.value ? fieldIdOf(form.value.type, path) : null),
    labelFor: (field) => (FIELD_LABELS[field] ? lt(FIELD_LABELS[field]) : field),
  })
  const versioned = useVersionedSave<IdentityProviderConfig>({
    current: () => options.config(),
    refetch: async () => (await options.refetch()) ?? undefined,
  })

  const capabilities = () => options.capabilities()
  const secret = computed(() => (form.value ? secretRequirement(form.value, opened.value) : null))
  const keepsStored = computed(
    () =>
      !!form.value &&
      !!opened.value &&
      form.value.type === opened.value.type &&
      secret.value === null,
  )
  const dirty = computed(() => !!form.value && JSON.stringify(form.value) !== pristine.value)

  function setStatus(next: SectionStatus | null) {
    status.value = next
    if (next) announce(next.message, { assertive: next.kind === 'error' })
  }

  /** Opens the form: the defaults for a first setup, or the stored configuration. */
  function open(config: IdentityProviderConfig | null) {
    const caps = capabilities()
    if (!caps) return
    form.value = config ? formFromConfig(config, caps) : formFromDefaults(caps)
    opened.value = config
    pristine.value = JSON.stringify(form.value)
    outdated.value = null
    problemForm.clear()
    test.reset()
  }

  function close() {
    form.value = null
    opened.value = null
    outdated.value = null
    problemForm.clear()
    test.reset()
  }

  function clearSecrets() {
    if (!form.value) return
    form.value.clientSecret = ''
    form.value.bindPassword = ''
  }

  /** Rule parameters as the server's messages show them: numbers in the user's locale. */
  function named(params: Record<string, unknown>): Record<string, unknown> {
    const current = isAppLocale(locale.value) ? locale.value : DEFAULT_LOCALE
    return Object.fromEntries(
      Object.entries(params).map(([key, value]) => [
        key,
        typeof value === 'number' ? formatNumber(value, current) : value,
      ]),
    )
  }

  function translate(errors: RuleErrors): Record<string, string[]> {
    return Object.fromEntries(
      Object.entries(errors).map(([path, messages]) => [
        /^hosts\.\d+$/.test(path) ? 'hosts' : path,
        messages.map((message) =>
          message.params ? t(message.key, named(message.params)) : t(message.key),
        ),
      ]),
    )
  }

  /** The client rules; false (with the errors shown) when something is to correct. */
  async function check(): Promise<boolean> {
    const caps = capabilities()
    if (!form.value || !caps) return false
    const errors = validateForm(form.value, { limits: caps.limits, secret: secret.value })
    if (Object.keys(errors).length === 0) return true
    await problemForm.setClientMessages(translate(errors))
    return false
  }

  /** What changed elsewhere between the opened version and the reloaded one (FR-017). */
  function changesBetween(
    before: IdentityProviderConfig,
    after: IdentityProviderConfig | undefined,
  ): SectionChange[] {
    const caps = capabilities()
    if (!after || !caps) return []
    if (after.type !== before.type) {
      return [
        { field: 'type', label: lt('admin.iam'), saved: t(`identityProvider.type.${after.type}`) },
      ]
    }
    const a = toInput(formFromConfig(before, caps), caps.defaults) as Record<string, unknown>
    const b = toInput(formFromConfig(after, caps), caps.defaults) as Record<string, unknown>
    const show = (value: unknown): string => {
      if (value === null || value === undefined || value === '') return t('domains.values.none')
      if (typeof value === 'boolean') return t(value ? 'domains.values.yes' : 'domains.values.no')
      if (Array.isArray(value)) {
        if (value.length === 0) return t('domains.values.none')
        return value
          .map((item) =>
            typeof item === 'object' && item
              ? `${(item as { attributeValue: string }).attributeValue} → ${(item as { template: string }).template}`
              : String(item),
          )
          .join(', ')
      }
      return typeof value === 'number' || typeof value === 'string' ? String(value) : ''
    }
    const changes: SectionChange[] = Object.keys(b)
      .filter((key) => key !== 'type' && JSON.stringify(a[key]) !== JSON.stringify(b[key]))
      .map((key) => ({
        field: key,
        label: lt(FIELD_LABELS[key] ?? 'admin.iam'),
        saved: show(b[key]),
      }))
    const secretSet = (config: IdentityProviderConfig) =>
      config.type === 'ldap' ? config.bindPasswordSet : config.clientSecretSet
    const secretChanged = before.etag !== after.etag && changes.length === 0
    if (secretSet(before) !== secretSet(after) || secretChanged) {
      const field = SECRET_OF[after.type]
      changes.push({
        field,
        label: lt(FIELD_LABELS[field]!),
        saved: t('identityProvider.changedElsewhere'),
      })
    }
    return changes
  }

  async function onProblem(problem: ApiProblem): Promise<SaveOutcome> {
    if (problem.is('identity-provider-not-configured')) {
      await forgetConfiguration(queryClient)
      return 'removed'
    }
    await problemForm.setProblem(onFormPaths(problem))
    return 'failed'
  }

  /** Saves the form; resolves with what happened. */
  async function save(): Promise<SaveOutcome> {
    const caps = capabilities()
    if (!form.value || !caps || saving.value) return 'failed'
    setStatus(null)
    if (!(await check())) return 'invalid'
    const current = form.value
    const base = opened.value
    saving.value = true
    try {
      if (!base) {
        try {
          await saveIdentityProvider(queryClient, toInput(current, caps.defaults), { create: true })
        } catch (error) {
          const problem = isApiProblem(error)
            ? error
            : ApiProblem.fromParts({ kind: 'network', cause: error })
          if (problem.status === 412) {
            // Set up elsewhere in the meantime: keep the input and show what is stored now.
            opened.value = (await options.refetch()) ?? null
            setStatus({ kind: 'error', message: problemMessage(problem) })
            return 'outdated'
          }
          return await onProblem(problem)
        }
        clearSecrets()
        setStatus({ kind: 'success', message: lt('success.object_modified', '') })
        return 'created'
      }
      const result =
        current.type !== base.type
          ? await versioned.save(toInput(current, caps.defaults), (input, ifMatch) =>
              saveIdentityProvider(queryClient, input, { ifMatch }),
            )
          : await (async () => {
              const patch = toPatch(current, base, caps.defaults, caps)
              if (!patch) return null
              return versioned.save(patch, (body, ifMatch) =>
                updateIdentityProvider(queryClient, body, ifMatch),
              )
            })()
      if (result === null) return 'unchanged'
      switch (result.status) {
        case 'saved':
          clearSecrets()
          outdated.value = null
          setStatus({ kind: 'success', message: lt('success.object_modified', '') })
          return 'saved'
        case 'outdated':
          if (!result.latest) {
            await forgetConfiguration(queryClient)
            return 'removed'
          }
          outdated.value = changesBetween(base, result.latest)
          return 'outdated'
        case 'cancelled':
          return 'failed'
        case 'failed':
          return await onProblem(result.problem)
      }
      return 'failed'
    } finally {
      saving.value = false
      // FR-026: the secret is never kept after an outcome.
      if (form.value) clearSecrets()
    }
  }

  /** "Discard my changes" after an outdated save: the reloaded values. */
  function discard() {
    const latest = versioned.discard() ?? options.config() ?? null
    open(latest)
  }

  /** The connection test of the entered values (FR-034, FR-038). */
  async function runTest() {
    const caps = capabilities()
    if (!form.value || !caps || test.running.value) return
    if (!(await check())) return
    problemForm.clear()
    await test.run(toInput(form.value, caps.defaults))
    const problem = test.problem.value
    if (problem?.status === 422 && problem.fieldErrors.size > 0) {
      test.problem.value = null
      await problemForm.setProblem(onFormPaths(problem))
    }
  }

  return {
    form,
    opened,
    secret,
    keepsStored,
    dirty,
    saving,
    status,
    outdated,
    problemForm,
    test,
    open,
    close,
    save,
    discard,
    runTest,
    setStatus,
    clearSecrets,
  }
}

export type ProviderEditor = ReturnType<typeof useProviderEditor>
