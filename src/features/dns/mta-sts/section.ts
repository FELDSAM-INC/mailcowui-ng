// The state of the domain page's MTA-STS section (FR-046 to FR-053 as settled): the form opened
// from the policy as read, or from the classic defaults for a new one; the client checks with the
// classic messages; a creation, or a merge patch of the changed members with the version tag; the
// outdated, conflict and validation outcomes; and what the API reports back: a renewed identifier
// (notice and highlighted record until the page is left) and an activation (certificate notice).
// A save that deactivates asks first (conventions "Confirmations"). Leaving with unsaved changes
// asks too.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { problemOf, type ApiProblem, type DnsCapabilities, type MtaStsPolicy } from '@/api'
import { legacy, lt, type LegacyKey } from '@/i18n'
import type { SectionChange, SectionStatus } from '@/shared/components/editable-section'
import { announce } from '@/shared/composables/useAnnouncer'
import { useClientErrors } from '@/shared/composables/useClientErrors'
import { useConfirm } from '@/shared/composables/useConfirm'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { changedSince, useVersionedSave } from '@/shared/composables/useVersionedSave'
import { add, type ClientErrors } from '@/shared/validation/client-errors'
import { MTA_STS_MX_HOSTS_MAX_ITEMS } from '@/shared/validation/limits'

import { createMtaStsPolicy, updateMtaStsPolicy } from '../api/mta-sts'
import { maxAgeInRange, parseMaxAge } from './max-age'
import { formatMxHosts, parseMxHosts, validateMxHosts } from './mx-hosts'
import {
  activationChange,
  formFromPolicy,
  mergeFormChanges,
  newPolicyForm,
  policyIdChanged,
  policyPatch,
  type MtaStsFormValues,
  type MtaStsValues,
} from './policy-change'

const LABELS: Record<string, LegacyKey> = {
  version: 'edit.mta_sts_version',
  mode: 'edit.mta_sts_mode',
  maxAge: 'edit.mta_sts_max_age',
  mxHosts: 'edit.mta_sts_mx',
  active: 'edit.active',
}

const FIELD_IDS: Record<string, string> = {
  version: 'mta-sts-version',
  mode: 'mta-sts-mode',
  maxAge: 'mta-sts-max-age',
  mxHosts: 'mta-sts-mx',
  active: 'mta-sts-active',
}

const OUTDATED_FIELDS = ['mode', 'maxAge', 'mxHosts', 'active'] as const

export interface MtaStsSectionOptions {
  domain: () => string
  policy: () => MtaStsPolicy | null | undefined
  caps: () => DnsCapabilities | undefined
  /** Reads the policy again (after an outdated save or a conflict). */
  refetch: () => Promise<MtaStsPolicy | null | undefined>
  /** Called after a save, when the read view is back. */
  onSaved?: () => void
}

export function useMtaStsSection(options: MtaStsSectionOptions) {
  const { t } = useI18n()
  const client = useQueryClient()
  const confirm = useConfirm()
  const translate = useClientErrors()

  const editing = ref(false)
  const base = shallowRef<MtaStsPolicy | null>(null)
  const opened = shallowRef<MtaStsFormValues | null>(null)
  const form = ref<MtaStsFormValues | null>(null) as Ref<MtaStsFormValues | null>
  const status = ref<SectionStatus | null>(null)
  const problem = shallowRef<ApiProblem | null>(null)
  const pending = ref(false)
  const outdatedFields = shallowRef<{ field: string; savedValue: unknown }[] | null>(null)
  /** The identifier the last save renewed; the TXT record stays highlighted until the page is left. */
  const idChange = shallowRef<{ previous: string; current: string } | null>(null)
  const activated = ref(false)
  let sentHosts: string[] = []

  const problemForm = useProblemForm({
    fieldId: (path) => FIELD_IDS[path.split('.')[0] ?? path] ?? null,
    labelFor: (field) => (LABELS[field] ? lt(LABELS[field]) : field),
    formKey: 'dns.mtaSts.form',
    valueAt: (path) => {
      if (path === 'domain') return options.domain()
      const entry = /^mxHosts\.(\d+)$/.exec(path)
      if (entry) return sentHosts[Number(entry[1])]
      if (path === 'version') return form.value?.version
      return undefined
    },
    problemParams: () => ({ domain: options.domain() }),
  })

  const versioned = useVersionedSave<MtaStsPolicy>({
    current: () => base.value,
    refetch: async () => (await options.refetch()) ?? undefined,
  })

  function clearFormState() {
    outdatedFields.value = null
    problem.value = null
    problemForm.clear()
    versioned.discard()
  }

  function open() {
    const caps = options.caps()
    if (!caps) return
    const policy = options.policy() ?? null
    base.value = policy
    opened.value = policy ? formFromPolicy(policy) : newPolicyForm(caps)
    form.value = { ...opened.value }
    status.value = null
    clearFormState()
    editing.value = true
  }

  function close() {
    editing.value = false
    form.value = null
    clearFormState()
  }

  const dirty = computed(
    () =>
      editing.value &&
      !!form.value &&
      !!opened.value &&
      JSON.stringify(form.value) !== JSON.stringify(opened.value),
  )
  useLeaveGuard(dirty, { messageKey: 'leaveGuard.body' })

  /** The client checks (FR-048 as settled) with the classic messages. */
  function check(values: MtaStsFormValues, caps: DnsCapabilities): ClientErrors {
    const domain = options.domain()
    const errors: ClientErrors = {}
    if (values.version !== caps.mtaSts.version) {
      add(errors, 'version', { key: legacy('danger.version_invalid', values.version) })
    }
    if (!(caps.mtaSts.modes as readonly string[]).includes(values.mode)) {
      add(errors, 'mode', { key: legacy('danger.mode_invalid', domain) })
    }
    const maxAge = parseMaxAge(values.maxAge)
    if (maxAge === null || !maxAgeInRange(maxAge, caps.mtaSts)) {
      add(errors, 'maxAge', { key: legacy('danger.max_age_invalid', domain) })
    }
    const mx = validateMxHosts(
      parseMxHosts(values.mx).hosts,
      caps.mtaSts.mxMaxLength,
      MTA_STS_MX_HOSTS_MAX_ITEMS,
    )
    for (const list of Object.values(mx)) for (const error of list) add(errors, 'mxHosts', error)
    return errors
  }

  function setStatus(next: SectionStatus, extra: string[] = []) {
    status.value = next
    announce([next.message, ...extra].join(' '))
  }

  function finish(before: MtaStsPolicy | null, after: MtaStsPolicy) {
    const notices: string[] = []
    if (policyIdChanged(before, after)) {
      idChange.value = { previous: before!.policyId, current: after.policyId }
      notices.push(t('dns.mtaSts.idChanged', { ...idChange.value, domain: after.domain }))
    }
    activated.value = activationChange(before, after) === 'activated'
    if (activated.value) notices.push(t('dns.mtaSts.certificateNotice', { domain: after.domain }))
    close()
    setStatus(
      { kind: 'success', message: lt('success.object_modified', options.domain()) },
      notices,
    )
    options.onSaved?.()
  }

  async function failed(failure: ApiProblem) {
    if (failure.status === 422) await problemForm.setProblem(failure)
    else problem.value = failure
  }

  async function create(values: MtaStsValues) {
    const domain = options.domain()
    try {
      const created = await createMtaStsPolicy(client, {
        domain,
        version: form.value?.version ?? 'STSv1',
        mode: values.mode,
        maxAge: values.maxAge,
        mxHosts: values.mxHosts,
        active: values.active,
      })
      finish(null, created)
    } catch (error) {
      const failure = problemOf(error)!
      if (failure.is('mta-sts-policy-exists')) {
        // Created elsewhere: continue as a change of that policy, keeping the input.
        const latest = (await options.refetch()) ?? null
        if (latest) {
          base.value = latest
          opened.value = formFromPolicy(latest)
        }
        problem.value = failure
        return
      }
      await failed(failure)
    }
  }

  async function update(from: MtaStsPolicy, values: MtaStsValues) {
    const patch = policyPatch(from, values)
    if (Object.keys(patch).length === 0) {
      finish(from, from)
      return
    }
    if (patch.active === false && from.active) {
      const leave = await confirm({
        title: t('dns.mtaSts.deactivate.title'),
        description: t('dns.mtaSts.deactivate.body', { domain: from.displayDomain }),
        confirmLabel: t('dns.mtaSts.deactivate.confirm'),
        destructive: true,
      })
      if (!leave) return
    }
    const result = await versioned.save(patch, (body, ifMatch) =>
      updateMtaStsPolicy(client, from, body, ifMatch),
    )
    if (result.status === 'saved') finish(from, result.result)
    else if (result.status === 'outdated') {
      outdatedFields.value = changedSince(from, result.latest ?? from, OUTDATED_FIELDS, {
        mxHosts: 'value',
      })
    } else if (result.status === 'failed') await failed(result.problem)
  }

  async function save() {
    const caps = options.caps()
    if (!form.value || !caps || pending.value) return
    problem.value = null
    const errors = check(form.value, caps)
    if (Object.keys(errors).length > 0) {
      await problemForm.setClientMessages(translate(errors))
      return
    }
    problemForm.clear()
    const { hosts, duplicates } = parseMxHosts(form.value.mx)
    for (const host of duplicates) announce(t('dns.mtaSts.duplicateDropped', { host }))
    if (duplicates.length > 0) form.value.mx = formatMxHosts(hosts)
    sentHosts = hosts
    const values: MtaStsValues = {
      mode: form.value.mode,
      maxAge: parseMaxAge(form.value.maxAge)!,
      mxHosts: hosts,
      active: form.value.active,
    }
    pending.value = true
    try {
      if (base.value) await update(base.value, values)
      else await create(values)
    } finally {
      pending.value = false
    }
  }

  /** "Save again": the user's changes on top of the policy saved in the meantime. */
  async function saveAgain() {
    const latest = versioned.latest.value
    if (!form.value || !opened.value) return
    if (latest) {
      form.value = mergeFormChanges(opened.value, latest, form.value)
      base.value = latest
      opened.value = formFromPolicy(latest)
    }
    outdatedFields.value = null
    await save()
  }

  /** "Discard my changes": the policy saved in the meantime. */
  function discard() {
    const latest = versioned.discard() ?? base.value
    outdatedFields.value = null
    if (!latest) return
    base.value = latest
    opened.value = formFromPolicy(latest)
    form.value = { ...opened.value }
  }

  const display = (field: string, value: unknown): string => {
    if (typeof value === 'boolean') return value ? lt('mailbox.active') : lt('mailbox.inactive')
    if (Array.isArray(value)) return formatMxHosts(value as string[])
    return String(value)
  }

  const outdated = computed<SectionChange[] | null>(
    () =>
      outdatedFields.value?.map((item) => ({
        field: item.field,
        label: LABELS[item.field] ? lt(LABELS[item.field]!) : item.field,
        saved: display(item.field, item.savedValue),
      })) ?? null,
  )

  /** The errors of a field; the MX servers collect those of their entries. */
  function errorsFor(path: string): string[] {
    if (path !== 'mxHosts') return problemForm.errorsFor(path)
    return problemForm.summary.value
      .filter((item) => item.path === 'mxHosts' || item.path.startsWith('mxHosts.'))
      .flatMap((item) => item.messages)
  }

  return {
    editing,
    form,
    status,
    problem,
    pending,
    dirty,
    problemForm,
    outdated,
    idChange,
    activated,
    errorsFor,
    open,
    close,
    save,
    saveAgain,
    discard,
  }
}
