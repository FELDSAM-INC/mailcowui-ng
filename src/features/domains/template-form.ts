// The domain template form (UI 002 data-model §4 "Domain template", FR-051, FR-052), mirroring the
// classic interface's forms 1:1 (owner rule): `templates/modals/mailbox.twig`
// (#addDomainTemplateModal) and `templates/edit/domain-templates.twig`. The fields, in that order:
// template name, tags, max. aliases, max. mailboxes, the maximum mailbox quota and the domain quota
// in MiB, Global Address List, active, rate limit (a value, empty for none, and a frame), DKIM
// selector (empty for no key) and key length, and the relay options. A new template starts with the
// template defaults (G29). The default mailbox quota is left out and never sent (owner decision,
// docs/conventions.md "Follow the legacy form"): the API lowers it to the maximum mailbox quota.
import type {
  DomainCapabilities,
  DomainRateLimit,
  DomainTemplate,
  DomainTemplateCreateRequest,
} from '@/api'
import { legacy } from '@/i18n'
import {
  QUOTA_MAX_BYTES,
  RATE_LIMIT_MAX,
  RATE_LIMIT_MIN,
  TEMPLATE_NAME_MAX_LENGTH,
} from '@/shared/validation/limits'

import { DOMAIN_DEFAULTS } from './defaults'
import {
  add,
  checkDkim,
  checkLength,
  checkLimit,
  checkQuotaOrder,
  checkTags,
  checkWhole,
  type ClientErrors,
  type RuleFormat,
} from './form-rules'
import type { RelayOptions } from './relay'
import type { TemplateCreateBody } from './templates-api'

/** The classic forms take quotas in MiB. */
export const MIB = 1_048_576

export interface TemplateFormValues {
  name: string
  tags: string[]
  maxAliases: string
  maxMailboxes: string
  /** MiB */
  maxMailboxQuota: string
  /** MiB */
  domainQuota: string
  globalAddressList: boolean
  active: boolean
  /** Empty for no rate limit, as the classic placeholder "Disabled" says. */
  rateLimitValue: string
  rateLimitFrame: DomainRateLimit['frame']
  /** Empty for no DKIM key (`DomainTemplate.dkimSelector`). */
  dkimSelector: string
  dkimKeySize: number
  relay: RelayOptions
}

/** The template members the form edits. */
export const TEMPLATE_FIELDS = [
  'name',
  'tags',
  'maxAliases',
  'maxMailboxes',
  'maxMailboxQuota',
  'domainQuota',
  'globalAddressList',
  'active',
  'rateLimit',
  'dkimSelector',
  'dkimKeySize',
  'backupMx',
  'relayAllRecipients',
  'relayUnknownOnly',
] as const satisfies readonly (keyof DomainTemplate)[]

export type TemplateField = (typeof TEMPLATE_FIELDS)[number]

type Stored = Pick<
  DomainTemplate,
  | 'tags'
  | 'maxMailboxes'
  | 'maxAliases'
  | 'maxMailboxQuota'
  | 'domainQuota'
  | 'rateLimit'
  | 'active'
  | 'globalAddressList'
  | 'backupMx'
  | 'relayAllRecipients'
  | 'relayUnknownOnly'
>

const mib = (bytes: number) => String(bytes / MIB)

function fromStored(
  source: Stored,
  name: string,
  dkim: { selector: string; keySize: number },
): TemplateFormValues {
  return {
    name,
    tags: [...source.tags],
    maxAliases: String(source.maxAliases),
    maxMailboxes: String(source.maxMailboxes),
    maxMailboxQuota: mib(source.maxMailboxQuota),
    domainQuota: mib(source.domainQuota),
    globalAddressList: source.globalAddressList,
    active: source.active,
    rateLimitValue: source.rateLimit ? String(source.rateLimit.value) : '',
    rateLimitFrame: source.rateLimit?.frame ?? 'second',
    dkimSelector: dkim.selector,
    dkimKeySize: dkim.keySize,
    relay: {
      backupMx: source.backupMx,
      relayAllRecipients: source.relayAllRecipients,
      relayUnknownOnly: source.relayUnknownOnly,
    },
  }
}

/**
 * A new template (FR-052): the capabilities' template defaults (G29), or the documented ones. The
 * selector is the server's default selector, as the classic form fills it in.
 */
export function newTemplateValues(
  capabilities: Pick<DomainCapabilities, 'dkim' | 'templateDefaults'>,
): TemplateFormValues {
  const defaults = capabilities.templateDefaults
  return fromStored(defaults ?? DOMAIN_DEFAULTS, '', {
    selector: defaults?.dkimSelector ?? capabilities.dkim?.defaultSelector ?? '',
    keySize: defaults?.dkimKeySize ?? capabilities.dkim?.defaultKeySize ?? 2048,
  })
}

export function templateFormValues(template: DomainTemplate): TemplateFormValues {
  return fromStored(template, template.name, {
    selector: template.dkimSelector,
    keySize: template.dkimKeySize,
  })
}

const whole = (value: string) => Number(value.trim())

/** The template members of the form, which a save compares with the stored template. */
export function templateValues(values: TemplateFormValues): Pick<DomainTemplate, TemplateField> {
  const rateLimit = values.rateLimitValue.trim()
  return {
    name: values.name.trim(),
    tags: [...values.tags],
    maxAliases: whole(values.maxAliases),
    maxMailboxes: whole(values.maxMailboxes),
    maxMailboxQuota: whole(values.maxMailboxQuota) * MIB,
    domainQuota: whole(values.domainQuota) * MIB,
    globalAddressList: values.globalAddressList,
    active: values.active,
    rateLimit: rateLimit === '' ? null : { value: whole(rateLimit), frame: values.rateLimitFrame },
    dkimSelector: values.dkimSelector.trim(),
    dkimKeySize: values.dkimKeySize,
    ...values.relay,
  }
}

/** The create request with every value of the form. */
export function toTemplateCreateRequest(values: TemplateFormValues): TemplateCreateBody {
  const { dkimKeySize, ...rest } = templateValues(values)
  return { ...rest, dkimKeySize: dkimKeySize as DomainTemplateCreateRequest['dkimKeySize'] }
}

const QUOTA_RANGE = { min: 1, max: Math.floor(QUOTA_MAX_BYTES / MIB) }

/**
 * The client rules of the domain fields (data-model §6), for the field paths of the API. `stored`
 * is the template's current tag set, which may stay above the tagging limit while it shrinks.
 */
export function validateTemplate(
  values: TemplateFormValues,
  capabilities: Pick<DomainCapabilities, 'taggingLimit' | 'dkim'>,
  format: RuleFormat,
  stored: readonly string[] = [],
): ClientErrors {
  const errors: ClientErrors = {}
  const name = values.name.trim()
  if (name === '') add(errors, 'name', { key: legacy('danger.template_name_invalid') })
  else checkLength(errors, 'name', name, TEMPLATE_NAME_MAX_LENGTH, format)
  checkTags(errors, values.tags, stored, capabilities.taggingLimit, format)
  checkLimit(errors, 'maxAliases', values.maxAliases, format)
  checkLimit(errors, 'maxMailboxes', values.maxMailboxes, format)
  const quota = (path: 'maxMailboxQuota' | 'domainQuota') => {
    const value = checkWhole(errors, path, values[path], QUOTA_RANGE, format)
    return value === null ? null : value * MIB
  }
  checkQuotaOrder(
    errors,
    {
      maxMailboxQuota: quota('maxMailboxQuota'),
      domainQuota: quota('domainQuota'),
    },
    format,
  )
  if (values.rateLimitValue.trim() !== '') {
    checkWhole(
      errors,
      'rateLimit.value',
      values.rateLimitValue,
      { min: RATE_LIMIT_MIN, max: RATE_LIMIT_MAX },
      format,
    )
  }
  checkDkim(
    errors,
    { generate: true, selector: values.dkimSelector, keySize: values.dkimKeySize },
    capabilities,
    format,
  )
  return errors
}
