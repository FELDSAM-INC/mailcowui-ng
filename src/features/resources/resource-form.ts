// The resource forms (data-model §2; legacy form map): the classic "Add resource" form
// (`#addResourceModal`) and "Resource" form (`edit/resource.twig`). The kind starts unchosen, as
// legacy's select; the booking rule starts as legacy's "Unlimited, but show as busy when booked".
// The booking limit is sent only for a hard limit; patches carry only the changed members.
import type {
  Resource,
  ResourceBookingRule,
  ResourceCreateRequest,
  ResourceKind,
  ResourcePatch,
} from '@/api'

export interface ResourceCreateForm {
  description: string
  domain: string | null
  kind: ResourceKind | ''
  bookingRule: ResourceBookingRule
  bookingLimitText: string
  active: boolean
}

export interface ResourceEditForm {
  description: string
  kind: ResourceKind
  bookingRule: ResourceBookingRule
  bookingLimitText: string
  active: boolean
}

/** A creation request as sent; omitted members take the API's defaults. */
export type ResourceCreateBody = Partial<ResourceCreateRequest> &
  Pick<ResourceCreateRequest, 'description' | 'domain' | 'kind'>

export function createFormDefaults(): ResourceCreateForm {
  return {
    description: '',
    domain: null,
    kind: '',
    bookingRule: 'unlimited',
    bookingLimitText: '',
    active: true,
  }
}

export function toCreateRequest(form: ResourceCreateForm): ResourceCreateBody {
  const body: ResourceCreateBody = {
    description: form.description.trim(),
    domain: form.domain ?? '',
    kind: form.kind as ResourceKind,
    bookingRule: form.bookingRule,
    active: form.active,
  }
  if (form.bookingRule === 'limited') body.bookingLimit = Number(form.bookingLimitText.trim())
  return body
}

export function editFormFrom(resource: Resource): ResourceEditForm {
  return {
    description: resource.description,
    kind: resource.kind,
    bookingRule: resource.bookingRule,
    bookingLimitText: resource.bookingLimit === null ? '' : String(resource.bookingLimit),
    active: resource.active,
  }
}

/** The members of the edit form that differ from the resource as read (FR-046), or null. */
export function buildResourcePatch(read: Resource, form: ResourceEditForm): ResourcePatch | null {
  const patch: ResourcePatch = {}
  const description = form.description.trim()
  if (description !== read.description) patch.description = description
  if (form.kind !== read.kind) patch.kind = form.kind
  if (form.bookingRule !== read.bookingRule) patch.bookingRule = form.bookingRule
  if (form.bookingRule === 'limited') {
    const limit = Number(form.bookingLimitText.trim())
    if (form.bookingRule !== read.bookingRule || limit !== read.bookingLimit) {
      patch.bookingLimit = limit
    }
  }
  if (form.active !== read.active) patch.active = form.active
  return Object.keys(patch).length > 0 ? patch : null
}
