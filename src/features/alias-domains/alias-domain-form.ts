// The domain alias forms (data-model §2; legacy form map): the classic "Add domain alias" form
// (`#addAliasDomainModal`) and "Edit Alias domain" form (`edit/aliasdomain.twig`). The DKIM selector
// is prefilled with the server default; emptied, no key is generated (`dkimSelector: ""` without a
// key size), as in legacy. The rate limit is sent only when a value is given and the user may set
// it. Patches carry only the changed members.
import type {
  AliasDomain,
  AliasDomainCreateRequest,
  AliasDomainPatch,
  AliasDomainRateLimit,
  ApiProblem,
} from '@/api'

export type RateLimitFrame = AliasDomainRateLimit['frame']

/**
 * A creation request as sent: the contract gives defaults for every member but the name and the
 * target, which the generated type marks as required; omitted members take the API's defaults.
 */
export type AliasDomainCreateBody = Partial<AliasDomainCreateRequest> &
  Pick<AliasDomainCreateRequest, 'name' | 'targetDomain'>

export interface AliasDomainCreateForm {
  namesText: string
  targetDomain: string | null
  active: boolean
  rateLimitValue: string
  rateLimitFrame: RateLimitFrame
  dkimSelector: string
  dkimKeySize: number
}

export interface AliasDomainEditForm {
  targetDomain: string
  active: boolean
}

export interface DkimDefaults {
  selector: string
  keySize: number
}

/** The classic add form: active checked, no rate limit, the server's DKIM defaults. */
export function createFormDefaults(dkim: DkimDefaults | null | undefined): AliasDomainCreateForm {
  return {
    namesText: '',
    targetDomain: null,
    active: true,
    rateLimitValue: '',
    rateLimitFrame: 'second',
    dkimSelector: dkim?.selector ?? '',
    dkimKeySize: dkim?.keySize ?? 2048,
  }
}

/** One creation request per name (research R8, R13). */
export function toCreateRequest(
  form: AliasDomainCreateForm,
  name: string,
  options: { canSetRateLimit: boolean },
): AliasDomainCreateBody {
  const selector = form.dkimSelector.trim()
  const body: AliasDomainCreateBody = {
    name,
    targetDomain: form.targetDomain ?? '',
    active: form.active,
    dkimSelector: selector,
  }
  if (selector !== '')
    body.dkimKeySize = form.dkimKeySize as AliasDomainCreateRequest['dkimKeySize']
  const value = form.rateLimitValue.trim()
  if (options.canSetRateLimit && value !== '') {
    body.rateLimit = { value: Number(value), frame: form.rateLimitFrame }
  }
  return body
}

export function editFormFrom(aliasDomain: AliasDomain): AliasDomainEditForm {
  return { targetDomain: aliasDomain.targetDomain, active: aliasDomain.active }
}

/** The members of the edit form that differ from the alias domain as read (FR-039), or null. */
export function buildAliasDomainPatch(
  read: AliasDomain,
  form: AliasDomainEditForm,
): AliasDomainPatch | null {
  const patch: AliasDomainPatch = {}
  if (form.targetDomain !== read.targetDomain) patch.targetDomain = form.targetDomain
  if (form.active !== read.active) patch.active = form.active
  return Object.keys(patch).length > 0 ? patch : null
}

/**
 * Whether a refused creation concerns only its name, so that the run goes on with the next one,
 * or the whole form, so that it stops (research R9).
 */
export function classifyAliasDomainRefusal(problem: ApiProblem): 'entry' | 'form' {
  if (problem.problemName === 'alias-domain-already-exists') return 'entry'
  if (problem.problemName === 'validation-failed' || problem.status === 422) {
    const paths = [...problem.fieldErrors.keys()]
    return paths.length > 0 && paths.every((path) => path === 'name') ? 'entry' : 'form'
  }
  return 'form'
}
