// RFC 9457 problem details as one runtime error type (research R8, data-model §2 ProblemView).
// Fields are typed from the generated schema. The list of problem types is never written by hand:
// a problem is named by the last path segment of its `type`.
import type {
  FieldViolation,
  PendingAction,
  Problem,
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

/** Reads an error response (status 400 or more) into an ApiProblem. */
export async function problemFromResponse(response: Response): Promise<ApiProblem> {
  const serverDate = serverDateOf(response)
  if (!isProblemContentType(response)) {
    return ApiProblem.fromParts({
      kind: response.status >= 500 ? 'unavailable' : 'problem',
      status: response.status,
      serverDate,
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
  return ApiProblem.fromParts({
    kind: 'problem',
    type: typeof body.type === 'string' ? body.type : null,
    status: typeof body.status === 'number' ? body.status : response.status,
    requestId: typeof body.requestId === 'string' ? body.requestId : null,
    retryAfter: retryAfterOf(body, response),
    fieldErrors,
    pendingActions: Array.isArray(body.pendingActions)
      ? (body.pendingActions as PendingAction[])
      : [],
    serverDate,
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
