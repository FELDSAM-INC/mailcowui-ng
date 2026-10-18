// The add domain form (UI 002 data-model §4, FR-018 to FR-024), mirroring the classic "Add domain"
// form `templates/modals/mailbox.twig` #addDomainModal 1:1 (owner rule): domain, description,
// template, then the values a template gives (tags, limits, quotas in MiB, Global Address List,
// active, rate limit, DKIM selector and key length, relay options; see template-form.ts). As in
// `js/site/mailbox.js`, the Default template is chosen and applied when the form opens, and
// choosing another template replaces those values without asking.
import type { DomainCapabilities, DomainCreateRequest, DomainTemplate } from '@/api'
import { legacy } from '@/i18n'

import { isValidDomainName } from './domain-name'
import { add, checkLength, type ClientErrors, type RuleFormat } from './form-rules'
import {
  newTemplateValues,
  templateFormValues,
  templateValues,
  validateTemplate,
  type TemplateFormValues,
} from './template-form'

export type DomainValues = Omit<TemplateFormValues, 'name'>

export interface CreateFormValues extends DomainValues {
  name: string
  description: string
  templateId: number | null
}

type Defaults = Pick<DomainCapabilities, 'dkim' | 'templateDefaults'>

/** The values a template gives, or the template defaults without one. */
export function templateFields(
  template: DomainTemplate | null,
  capabilities: Defaults,
): DomainValues {
  const { name: _name, ...values } = template
    ? templateFormValues(template)
    : newTemplateValues(capabilities)
  return values
}

/** The Default template comes first and is chosen (`js/site/mailbox.js`). */
export function orderTemplates<T extends Pick<DomainTemplate, 'isDefault'>>(
  templates: readonly T[],
): T[] {
  return [
    ...templates.filter((item) => item.isDefault),
    ...templates.filter((item) => !item.isDefault),
  ]
}

export function initialValues(
  templates: readonly DomainTemplate[],
  capabilities: Defaults,
): CreateFormValues {
  const template = orderTemplates(templates)[0] ?? null
  return {
    name: '',
    description: '',
    templateId: template?.id ?? null,
    ...templateFields(template, capabilities),
  }
}

/** Choosing a template replaces its values; the domain and description are kept. */
export function applyTemplate(
  values: CreateFormValues,
  template: DomainTemplate | null,
  capabilities: Defaults,
): CreateFormValues {
  return {
    ...values,
    templateId: template?.id ?? null,
    ...templateFields(template, capabilities),
  }
}

/**
 * The request with every value of the form. The Global Address List is left out when the
 * groupware is disabled, as the classic form leaves out its checkbox; `restartGroupware` is the
 * button chosen ("Add domain and restart SOGo").
 */
export function toCreateRequest(
  values: CreateFormValues,
  capabilities: Pick<DomainCapabilities, 'groupwareEnabled'>,
  restartGroupware: boolean,
): DomainCreateRequest {
  const {
    name: _template,
    dkimKeySize,
    globalAddressList,
    ...rest
  } = templateValues({
    ...values,
    name: '',
  })
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    ...(values.templateId !== null ? { templateId: values.templateId } : {}),
    ...rest,
    ...(capabilities.groupwareEnabled ? { globalAddressList } : {}),
    dkimKeySize: dkimKeySize as DomainCreateRequest['dkimKeySize'],
    restartGroupware: capabilities.groupwareEnabled && restartGroupware,
  }
}

/** The client rules (data-model §6): the domain name, the description and the domain values. */
export function validateCreate(
  values: CreateFormValues,
  capabilities: Pick<DomainCapabilities, 'taggingLimit' | 'maxDescriptionLength' | 'dkim'>,
  format: RuleFormat,
): ClientErrors {
  const errors: ClientErrors = {}
  if (!isValidDomainName(values.name)) add(errors, 'name', { key: legacy('danger.domain_invalid') })
  checkLength(
    errors,
    'description',
    values.description.trim(),
    capabilities.maxDescriptionLength,
    format,
  )
  const { name: _name, ...domainErrors } = validateTemplate(
    { ...values, name: 'template' },
    capabilities,
    format,
  )
  return { ...errors, ...domainErrors }
}
