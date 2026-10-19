// RFC 9457 problem details as one runtime error type (research R8, data-model §2 ProblemView).
// Fields are typed from the generated schema. The list of problem types is never written by hand:
// a problem is named by the last path segment of its `type`.
import type {
  FieldViolation,
  IdentityProviderInUseProblem,
  PasswordResetSecondFactorRequiredProblem,
  PendingAction,
  PermissionFlagRequiredProblem,
  Problem,
  QuarantineDeliveryRefusedProblem,
  QuarantineMessageTooLargeProblem,
  QuarantineNotificationAttributeNotPermittedProblem,
  SpamFilterPermissionFlagProblem,
  SpamFilterTemporaryFailureProblem,
  SpamPolicyEntryExistsProblem,
  SecondFactorEnrolmentFailedProblem,
  SelfServiceTemporaryFailureProblem,
  TooManyRequestsProblem,
} from './generated/schema'

/** `problem`: a problem response; `network`: no response; `unavailable`: a non-problem 5xx. */
export type ProblemKind = 'problem' | 'network' | 'unavailable'

const PROBLEM_PREFIX = '/api/v2/problems/'

/** The name of a problem type (`/api/v2/problems/<name>`), or null for `about:blank` and others. */
export function problemName(type: string | null | undefined): string | null {
  if (!type || !type.startsWith(PROBLEM_PREFIX)) return null
  const name = type.slice(PROBLEM_PREFIX.length)
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) ? name : null
}

export interface ApiProblemParts {
  kind: ProblemKind
  type?: Problem['type'] | null
  status?: Problem['status'] | null
  requestId?: Problem['requestId'] | null
  retryAfter?: TooManyRequestsProblem['retryAfter'] | null
  fieldErrors?: Map<string, FieldViolation[]>
  pendingActions?: PendingAction[]
  serverDate?: Date | null
  /**
   * The members a problem type adds (UI 002), for example `attributes` of
   * `attribute-not-permitted` or `mailboxes` and `resources` of `domain-not-empty`.
   */
  extensions?: Record<string, unknown>
  /**
   * UI 011 (research R17): false only when the response carries `Audit-Recorded: false`, an
   * action carried out without its audit record.
   */
  auditRecorded?: boolean
  /** English title and detail, kept for logs only and never shown (FR-075). */
  title?: string
  detail?: string
  cause?: unknown
}

export class ApiProblem extends Error {
  readonly kind: ProblemKind
  readonly type: Problem['type'] | null
  readonly status: Problem['status'] | null
  readonly requestId: Problem['requestId'] | null
  readonly retryAfter: TooManyRequestsProblem['retryAfter'] | null
  readonly fieldErrors: Map<string, FieldViolation[]>
  readonly pendingActions: PendingAction[]
  readonly serverDate: Date | null
  readonly extensions: Readonly<Record<string, unknown>>
  readonly auditRecorded: boolean
  readonly title: string | undefined
  readonly detail: string | undefined

  private constructor(parts: ApiProblemParts) {
    super(`API problem (${parts.kind}${parts.status ? ` ${parts.status}` : ''})`, {
      cause: parts.cause,
    })
    this.kind = parts.kind
    this.type = parts.type ?? null
    this.status = parts.status ?? null
    this.requestId = parts.requestId ?? null
    this.retryAfter = parts.retryAfter ?? null
    this.fieldErrors = parts.fieldErrors ?? new Map<string, FieldViolation[]>()
    this.pendingActions = parts.pendingActions ?? []
    this.serverDate = parts.serverDate ?? null
    this.extensions = parts.extensions ?? {}
    this.auditRecorded = parts.auditRecorded ?? true
    this.title = parts.title
    this.detail = parts.detail
  }

  static fromParts(parts: ApiProblemParts): ApiProblem {
    return new ApiProblem(parts)
  }

  /** The problem's name (`sign-in-failed`); null for `about:blank` and transport failures. */
  get problemName(): string | null {
    return problemName(this.type)
  }

  /** True when this is the problem type `/api/v2/problems/<name>`. */
  is(name: string): boolean {
    return this.kind === 'problem' && problemName(this.type) === name
  }

  // UI 005 (research R6): extension members of the self-service problems, typed from the
  // generated problem schemas; empty values when the problem has none.

  /** The flags a refused change needs (`permission-flag-required`). */
  get requiredFlags(): PermissionFlagRequiredProblem['requiredFlags'] {
    const value = this.extensions.requiredFlags
    return Array.isArray(value) ? value.filter((flag) => typeof flag === 'string') : []
  }

  /** Whether all or any of `requiredFlags` allow the change; `all` when not given. */
  get requiredFlagsMatch(): NonNullable<PermissionFlagRequiredProblem['requiredFlagsMatch']> {
    return this.extensions.requiredFlagsMatch === 'any' ? 'any' : 'all'
  }

  /** The unavailable service of a `temporary-failure`. */
  get dependency(): NonNullable<SelfServiceTemporaryFailureProblem['dependency']> | null {
    const value = this.extensions.dependency
    return typeof value === 'string' ? value : null
  }

  /** Wrong TOTP codes left before an enrolment is cancelled. */
  get attemptsRemaining(): NonNullable<
    SecondFactorEnrolmentFailedProblem['attemptsRemaining']
  > | null {
    const value = this.extensions.attemptsRemaining
    return typeof value === 'number' ? value : null
  }

  /** The usable second factors of a password reset's `second-factor-required`. */
  get methods(): PasswordResetSecondFactorRequiredProblem['methods'] {
    const value = this.extensions.methods
    return Array.isArray(value)
      ? (value as PasswordResetSecondFactorRequiredProblem['methods'])
      : []
  }
}

export function isApiProblem(value: unknown): value is ApiProblem {
  return value instanceof ApiProblem
}

function serverDateOf(response: Response): Date | null {
  const header = response.headers.get('date')
  if (!header) return null
  const date = new Date(header)
  return Number.isNaN(date.getTime()) ? null : date
}

function isProblemContentType(response: Response): boolean {
  const type = (response.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase()
  return type === 'application/problem+json'
}

function retryAfterOf(body: Record<string, unknown>, response: Response): number | null {
  if (typeof body.retryAfter === 'number') return body.retryAfter
  const header = Number(response.headers.get('retry-after'))
  return Number.isFinite(header) && header > 0 ? header : null
}

/**
 * UI 011 (research R17): whether an answer's action has its audit record. The API sends
 * `Audit-Recorded: false` only when the action was carried out but its record could not be written.
 */
export function isAuditRecorded(response: Response | null | undefined): boolean {
  return response?.headers.get('audit-recorded')?.trim().toLowerCase() !== 'false'
}

/** The members every problem may carry; anything else is an extension member. */
const STANDARD_MEMBERS = new Set([
  'type',
  'title',
  'status',
  'detail',
  'instance',
  'requestId',
  'errors',
  'retryAfter',
  'pendingActions',
])

/** Reads an error response (status 400 or more) into an ApiProblem. */
export async function problemFromResponse(response: Response): Promise<ApiProblem> {
  const serverDate = serverDateOf(response)
  const auditRecorded = isAuditRecorded(response)
  if (!isProblemContentType(response)) {
    return ApiProblem.fromParts({
      kind: response.status >= 500 ? 'unavailable' : 'problem',
      status: response.status,
      serverDate,
      auditRecorded,
    })
  }
  let body: Record<string, unknown>
  try {
    body = (await response.clone().json()) as Record<string, unknown>
  } catch {
    return ApiProblem.fromParts({ kind: 'problem', status: response.status, serverDate })
  }
  const fieldErrors = new Map<string, FieldViolation[]>()
  if (body.errors && typeof body.errors === 'object') {
    for (const [path, violations] of Object.entries(body.errors as Record<string, unknown>)) {
      if (Array.isArray(violations)) fieldErrors.set(path, violations as FieldViolation[])
    }
  }
  const extensions = Object.fromEntries(
    Object.entries(body).filter(([key]) => !STANDARD_MEMBERS.has(key)),
  )
  return ApiProblem.fromParts({
    kind: 'problem',
    extensions,
    type: typeof body.type === 'string' ? body.type : null,
    status: typeof body.status === 'number' ? body.status : response.status,
    requestId: typeof body.requestId === 'string' ? body.requestId : null,
    retryAfter: retryAfterOf(body, response),
    fieldErrors,
    pendingActions: Array.isArray(body.pendingActions)
      ? (body.pendingActions as PendingAction[])
      : [],
    serverDate,
    auditRecorded,
    title: typeof body.title === 'string' ? body.title : undefined,
    detail: typeof body.detail === 'string' ? body.detail : undefined,
  })
}

/** Reads the problem name of a response without consuming it (null when it is not a problem). */
export async function peekProblemName(response: Response): Promise<string | null> {
  if (!isProblemContentType(response)) return null
  try {
    const body = (await response.clone().json()) as { type?: unknown }
    return typeof body.type === 'string' ? problemName(body.type) : null
  } catch {
    return null
  }
}

/** A query or mutation error as a problem (the client turns every failure into ApiProblem). */
export function problemOf(error: unknown): ApiProblem | null {
  if (!error) return null
  return isApiProblem(error) ? error : ApiProblem.fromParts({ kind: 'problem', cause: error })
}

/** UI 012 (FR-014): the members of an "identity provider in use" refusal. */
export type IdentityProviderInUseDetails = Pick<
  IdentityProviderInUseProblem,
  'blockingMailboxes' | 'mailboxCounts'
>

/**
 * The blocking mailbox count and the counts per source of an `identity-provider-in-use` problem;
 * null for any other problem, or a body without these members.
 */
export function identityProviderInUseDetails(
  problem: ApiProblem | null | undefined,
): IdentityProviderInUseDetails | null {
  if (!problem?.is('identity-provider-in-use')) return null
  const { blockingMailboxes, mailboxCounts } = problem.extensions
  const counts = mailboxCounts as Record<string, unknown> | null | undefined
  if (typeof blockingMailboxes !== 'number' || !counts || typeof counts !== 'object') return null
  const sources = ['keycloak', 'genericOidc', 'ldap'] as const
  if (!sources.every((source) => typeof counts[source] === 'number')) return null
  return {
    blockingMailboxes,
    mailboxCounts: {
      keycloak: counts.keycloak as number,
      genericOidc: counts.genericOidc as number,
      ldap: counts.ldap as number,
    },
  }
}

// UI 006 (research R24): the extension members of the quarantine, spam policy and rate limit
// problems, read through guards over the generated types; null when the problem is another one or
// its body lacks the members.

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

/** `permission-flag-required`: the flags and how they combine (`all` when absent). */
export function requiredFlagsOf(problem: ApiProblem | null | undefined): {
  requiredFlags: SpamFilterPermissionFlagProblem['requiredFlags']
  requiredFlagsMatch: 'all' | 'any'
} | null {
  if (!problem?.is('permission-flag-required')) return null
  const { requiredFlags, requiredFlagsMatch } = problem.extensions
  if (!isStringArray(requiredFlags) || requiredFlags.length === 0) return null
  return {
    requiredFlags: requiredFlags,
    requiredFlagsMatch: requiredFlagsMatch === 'any' ? 'any' : 'all',
  }
}

/** `attribute-not-permitted` of the notification settings: the members and their flags. */
export function notPermittedAttributesOf(
  problem: ApiProblem | null | undefined,
): Pick<QuarantineNotificationAttributeNotPermittedProblem, 'attributes' | 'requiredFlags'> | null {
  if (!problem?.is('attribute-not-permitted')) return null
  const { attributes, requiredFlags } = problem.extensions
  if (!isStringArray(attributes)) return null
  const flags =
    requiredFlags && typeof requiredFlags === 'object' && !Array.isArray(requiredFlags)
      ? (requiredFlags as Record<string, string>)
      : {}
  return {
    attributes: attributes as QuarantineNotificationAttributeNotPermittedProblem['attributes'],
    requiredFlags: flags as QuarantineNotificationAttributeNotPermittedProblem['requiredFlags'],
  }
}

/** `temporary-failure`: the unavailable service and, when given, the step. */
export function temporaryFailureOf(
  problem: ApiProblem | null | undefined,
): Pick<SpamFilterTemporaryFailureProblem, 'dependency' | 'step'> | null {
  if (!problem?.is('temporary-failure')) return null
  const { dependency, step } = problem.extensions
  if (typeof dependency !== 'string') return null
  return {
    dependency: dependency as SpamFilterTemporaryFailureProblem['dependency'],
    ...(typeof step === 'string'
      ? { step: step as SpamFilterTemporaryFailureProblem['step'] }
      : {}),
  }
}

/** `quarantine-delivery-refused`: the mail server's code and answer. */
export function deliveryRefusalOf(
  problem: ApiProblem | null | undefined,
): Pick<QuarantineDeliveryRefusedProblem, 'smtpCode' | 'smtpResponse'> | null {
  if (!problem?.is('quarantine-delivery-refused')) return null
  const { smtpCode, smtpResponse } = problem.extensions
  if (typeof smtpCode !== 'number' || typeof smtpResponse !== 'string') return null
  return { smtpCode, smtpResponse }
}

/** `quarantine-message-too-large`: the message size and the limit, in bytes. */
export function messageTooLargeOf(
  problem: ApiProblem | null | undefined,
): Pick<QuarantineMessageTooLargeProblem, 'size' | 'limit'> | null {
  if (!problem?.is('quarantine-message-too-large')) return null
  const { size, limit } = problem.extensions
  if (typeof size !== 'number' || typeof limit !== 'number') return null
  return { size, limit }
}

/** `spam-policy-entry-exists`: the list that holds the pattern and the existing entry. */
export function existingEntryOf(
  problem: ApiProblem | null | undefined,
): Pick<SpamPolicyEntryExistsProblem, 'list' | 'entryId'> | null {
  if (!problem?.is('spam-policy-entry-exists')) return null
  const { list, entryId } = problem.extensions
  if ((list !== 'allow' && list !== 'block') || typeof entryId !== 'number') return null
  return { list, entryId }
}
