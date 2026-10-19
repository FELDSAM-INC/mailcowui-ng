// The alias forms (data-model §2, research R8–R10; legacy form map): the classic "Add alias" form
// (`#addAliasModal`) and "Edit alias" form (`templates/edit/alias.twig`). The destination is the
// goto textarea plus legacy's three mutually exclusive goto checkboxes (`gotoAction`); a special
// action disables the textarea, which keeps its text. Requests carry only what the forms show:
// creations no comments (the add form has none), patches only the changed members.
import type { Alias, AliasCreateRequest, AliasPatch, ApiProblem } from '@/api'
import { parseEntryList } from '@/shared/validation/entry-list'

export type GotoAction = 'none' | 'discard' | 'learnSpam' | 'learnHam'

/**
 * A creation request as sent: the contract gives defaults for every member but the address, which
 * the generated type marks as required; omitted members take the API's defaults.
 */
export type AliasCreateBody = Partial<AliasCreateRequest> & Pick<AliasCreateRequest, 'address'>

export interface AliasCreateForm {
  addressesText: string
  destinationsText: string
  gotoAction: GotoAction
  groupwareVisible: boolean
  internal: boolean
  senderAllowed: boolean
  active: boolean
}

export interface AliasEditForm {
  address: string
  destinationsText: string
  gotoAction: GotoAction
  groupwareVisible: boolean
  internal: boolean
  senderAllowed: boolean
  privateComment: string
  publicComment: string
  active: boolean
}

/** The checked boxes of the classic add form: SOGo visible, allowed to send and active. */
export function createFormDefaults(): AliasCreateForm {
  return {
    addressesText: '',
    destinationsText: '',
    gotoAction: 'none',
    groupwareVisible: true,
    internal: false,
    senderAllowed: true,
    active: true,
  }
}

export interface FormOptions {
  groupwareEnabled: boolean | undefined
}

function destinationMembers(
  gotoAction: GotoAction,
  destinationsText: string,
): Pick<AliasCreateBody, 'destinationType' | 'destinations'> {
  if (gotoAction !== 'none') return { destinationType: gotoAction }
  return { destinations: parseEntryList(destinationsText).map((entry) => entry.value) }
}

/** One creation request per address (research R8). */
export function toCreateRequest(
  form: AliasCreateForm,
  address: string,
  options: FormOptions,
): AliasCreateBody {
  return {
    address,
    ...destinationMembers(form.gotoAction, form.destinationsText),
    active: form.active,
    senderAllowed: form.senderAllowed,
    internal: form.internal,
    ...(options.groupwareEnabled ? { groupwareVisible: form.groupwareVisible } : {}),
  }
}

/** The edit form of an alias as read: legacy shows the goto list separated by ", ". */
export function editFormFrom(alias: Alias): AliasEditForm {
  return {
    address: alias.address,
    destinationsText: alias.destinations.join(', '),
    gotoAction: alias.destinationType === 'addresses' ? 'none' : alias.destinationType,
    groupwareVisible: alias.groupwareVisible,
    internal: alias.internal,
    senderAllowed: alias.senderAllowed,
    privateComment: alias.privateComment,
    publicComment: alias.publicComment,
    active: alias.active,
  }
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index])

/**
 * The members of the edit form that differ from the alias as read (FR-022), or null. Destinations
 * are sent only when the choice or the parsed list changed, so destinations stored by another tool
 * are never sent back unedited; the groupware option is never sent while the groupware is disabled.
 */
export function buildAliasPatch(
  read: Alias,
  form: AliasEditForm,
  options: FormOptions,
): AliasPatch | null {
  const patch: AliasPatch = {}
  if (form.address.trim() !== read.address) patch.address = form.address.trim()
  const readAction: GotoAction =
    read.destinationType === 'addresses' ? 'none' : read.destinationType
  if (form.gotoAction !== readAction) {
    Object.assign(patch, destinationMembers(form.gotoAction, form.destinationsText))
    if (form.gotoAction === 'none') patch.destinationType = 'addresses'
  } else if (form.gotoAction === 'none') {
    const destinations = parseEntryList(form.destinationsText).map((entry) => entry.value)
    if (!sameList(destinations, read.destinations)) {
      patch.destinationType = 'addresses'
      patch.destinations = destinations
    }
  }
  for (const key of ['internal', 'senderAllowed', 'active'] as const) {
    if (form[key] !== read[key]) patch[key] = form[key]
  }
  if (options.groupwareEnabled && form.groupwareVisible !== read.groupwareVisible) {
    patch.groupwareVisible = form.groupwareVisible
  }
  for (const key of ['privateComment', 'publicComment'] as const) {
    if (form[key] !== read[key]) patch[key] = form[key]
  }
  return Object.keys(patch).length > 0 ? patch : null
}

const ENTRY_PROBLEMS = new Set(['address-in-use', 'domain-alias-limit-reached'])

/**
 * Whether a refused creation concerns only its address, so that the run goes on with the next one,
 * or the whole form, so that it stops (research R9).
 */
export function classifyAliasRefusal(problem: ApiProblem): 'entry' | 'form' {
  const name = problem.problemName
  if (name && ENTRY_PROBLEMS.has(name)) return 'entry'
  if (name === 'validation-failed' || problem.status === 422) {
    const paths = [...problem.fieldErrors.keys()]
    return paths.length > 0 && paths.every((path) => path === 'address') ? 'entry' : 'form'
  }
  return 'form'
}
