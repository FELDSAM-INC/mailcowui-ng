// Contract validator of the mock API (research R22). Every mocked request is matched to exactly
// one operation of the pinned contract (contract/openapi.json) and validated; every mocked
// response must use a documented status, documented required headers and a body that satisfies
// the documented schema. Violations are recorded, and the mock answers them with a 500
// `mock-contract-violation`, so tests fail instead of passing on data the API could never return.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020'
import addFormats from 'ajv-formats'

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
type JsonObject = { [key: string]: Json }

interface ParameterObject {
  name: string
  in: 'path' | 'query' | 'header' | 'cookie'
  required?: boolean
  schema?: JsonObject
  explode?: boolean
}

interface OperationObject {
  operationId: string
  parameters?: JsonObject[]
  requestBody?: JsonObject
  responses: Record<string, JsonObject>
}

const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const SERVER_BASE = '/api/v2'

export interface RequestInfo {
  method: string
  url: string
  headers: Headers
  /** Parsed JSON body, raw text for other content types, undefined when there is none. */
  body?: unknown
}

export interface ResponseInfo {
  status: number
  headers: Headers
  body?: unknown
}

export interface OperationMatch {
  operationId: string
  method: string
  pathTemplate: string
  pathParams: Record<string, string>
}

export interface Violation {
  at: string
  method: string
  path: string
  operationId: string | null
  messages: string[]
}

interface CompiledPath {
  template: string
  segments: string[]
  literalCount: number
}

function isJsonContentType(contentType: string): boolean {
  return contentType === 'application/json' || contentType.endsWith('+json')
}

function mediaType(headers: Headers): string | null {
  const value = headers.get('content-type')
  return value ? (value.split(';')[0] ?? '').trim().toLowerCase() : null
}

function escapePointer(part: string): string {
  return part.replace(/~/g, '~0').replace(/\//g, '~1')
}

function formatErrors(prefix: string, errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((error) => {
    const where = error.instancePath || '(root)'
    const extra =
      'allowedValues' in error.params
        ? ` (${JSON.stringify(error.params.allowedValues)})`
        : 'additionalProperty' in error.params
          ? ` (${String(error.params.additionalProperty)})`
          : ''
    return `${prefix}: ${where} ${error.message ?? 'is invalid'}${extra}`
  })
}

export class ContractValidator {
  private readonly ajv: Ajv2020
  private readonly compiled = new Map<string, ValidateFunction>()
  private readonly paths: CompiledPath[]

  constructor(private readonly spec: JsonObject) {
    this.ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false, validateFormats: true })
    addFormats(this.ajv)
    this.ajv.addFormat('password', true)
    // OpenAPI-only schema keywords are annotations. The document's own top-level keys are
    // registered too, because Ajv compiles the root when it resolves `openapi.json#/...` refs.
    this.ajv.addVocabulary([
      'discriminator',
      'example',
      'xml',
      'externalDocs',
      'openapi',
      'info',
      'servers',
      'tags',
      'paths',
      'components',
      'security',
      'webhooks',
      'jsonSchemaDialect',
    ])
    this.ajv.addSchema(spec, 'openapi.json')
    this.paths = Object.keys(spec.paths as JsonObject).map((template) => {
      const segments = template.split('/').slice(1)
      return {
        template,
        segments,
        literalCount: segments.filter((segment) => !segment.startsWith('{')).length,
      }
    })
  }

  /** Validates a value against the schema at a JSON pointer of the contract, e.g. `#/components/schemas/Role`. */
  validateSchema(pointer: string, value: unknown, prefix = pointer): string[] {
    let validate = this.compiled.get(pointer)
    if (!validate) {
      validate = this.ajv.compile({ $ref: `openapi.json${pointer}` })
      this.compiled.set(pointer, validate)
    }
    return validate(value) ? [] : formatErrors(prefix, validate.errors)
  }

  /** Matches a method and a path below the server base (`/session`) to one operation. */
  match(method: string, path: string): OperationMatch | null {
    const segments = path.split('/').slice(1)
    const lower = method.toLowerCase()
    let best: { compiled: CompiledPath; params: Record<string, string> } | null = null
    for (const compiled of this.paths) {
      if (compiled.segments.length !== segments.length) continue
      const item = (this.spec.paths as JsonObject)[compiled.template] as JsonObject
      if (!(lower in item)) continue
      const params: Record<string, string> = {}
      let matches = true
      compiled.segments.forEach((segment, index) => {
        const actual = segments[index] ?? ''
        if (segment.startsWith('{')) {
          if (actual === '') matches = false
          else params[segment.slice(1, -1)] = decodeURIComponent(actual)
        } else if (segment !== actual) {
          matches = false
        }
      })
      if (matches && (!best || compiled.literalCount > best.compiled.literalCount)) {
        best = { compiled, params }
      }
    }
    if (!best) return null
    const operation = this.operation(best.compiled.template, lower)
    return {
      operationId: operation.operationId,
      method: method.toUpperCase(),
      pathTemplate: best.compiled.template,
      pathParams: best.params,
    }
  }

  validateRequest(request: RequestInfo): { match: OperationMatch | null; violations: string[] } {
    const url = new URL(request.url)
    const method = request.method.toUpperCase()
    const label = `${method} ${url.pathname}`
    if (!url.pathname.startsWith(`${SERVER_BASE}/`)) {
      return { match: null, violations: [`${label} matches no contract operation (outside ${SERVER_BASE})`] }
    }
    const match = this.match(method, url.pathname.slice(SERVER_BASE.length))
    if (!match) {
      return { match: null, violations: [`${label} matches no contract operation (FR-093)`] }
    }
    const violations: string[] = []
    const operation = this.operation(match.pathTemplate, method.toLowerCase())
    const prefix = `request ${match.operationId}`

    if (UNSAFE.has(method) && !request.headers.get('x-csrf-token')) {
      violations.push(`${prefix}: an unsafe request must carry X-CSRF-Token`)
    }

    const declared = this.parameters(match.pathTemplate, operation)
    const queryNames = new Set(url.searchParams.keys())
    for (const { parameter, pointer } of declared) {
      const schemaPointer = `${pointer}/schema`
      const schema = this.resolveSchema(parameter.schema)
      if (parameter.in === 'path') {
        const value = match.pathParams[parameter.name]
        violations.push(
          ...this.validateSchema(schemaPointer, this.coerce(value, schema), `${prefix} path ${parameter.name}`),
        )
      } else if (parameter.in === 'query') {
        queryNames.delete(parameter.name)
        const values = url.searchParams.getAll(parameter.name)
        if (values.length === 0) {
          if (parameter.required) violations.push(`${prefix}: missing query parameter ${parameter.name}`)
          continue
        }
        let value: unknown
        if (schema?.type === 'array') {
          const items = this.resolveSchema(schema.items)
          value = values.map((item) => this.coerce(item, items))
        } else if (values.length > 1) {
          violations.push(`${prefix}: query parameter ${parameter.name} given more than once`)
          continue
        } else {
          value = this.coerce(values[0], schema)
        }
        violations.push(...this.validateSchema(schemaPointer, value, `${prefix} query ${parameter.name}`))
      } else if (parameter.in === 'header') {
        const value = request.headers.get(parameter.name)
        if (value === null) {
          if (parameter.required) violations.push(`${prefix}: missing header ${parameter.name}`)
          continue
        }
        violations.push(...this.validateSchema(schemaPointer, this.coerce(value, schema), `${prefix} header ${parameter.name}`))
      }
    }
    for (const name of queryNames) {
      violations.push(`${prefix}: undocumented query parameter ${name}`)
    }

    const body = operation.requestBody ? (this.resolveRef(operation.requestBody) as JsonObject) : null
    const contentType = mediaType(request.headers)
    if (!body) {
      if (request.body !== undefined && request.body !== '') {
        violations.push(`${prefix}: the operation takes no request body`)
      }
    } else if (request.body === undefined || request.body === '') {
      if (body.required) violations.push(`${prefix}: missing required request body`)
    } else {
      const content = body.content as JsonObject
      if (!contentType || !(contentType in content)) {
        violations.push(
          `${prefix}: undocumented content type ${contentType ?? '(none)'} (documented: ${Object.keys(content).join(', ')})`,
        )
      } else if (isJsonContentType(contentType)) {
        const pointer = `${this.operationPointer(match.pathTemplate, method.toLowerCase())}/requestBody/content/${escapePointer(contentType)}/schema`
        violations.push(...this.validateSchema(pointer, request.body, `${prefix} body`))
      }
    }
    return { match, violations }
  }

  validateResponse(match: OperationMatch, response: ResponseInfo): string[] {
    const method = match.method.toLowerCase()
    const operation = this.operation(match.pathTemplate, method)
    const prefix = `response ${match.operationId} ${response.status}`
    const status = String(response.status)
    const key = [status, `${status[0]}XX`, 'default'].find((candidate) => candidate in operation.responses)
    if (!key) {
      return [
        `${prefix}: status ${status} is not documented (documented: ${Object.keys(operation.responses).join(', ')})`,
      ]
    }
    let pointer = `${this.operationPointer(match.pathTemplate, method)}/responses/${key}`
    let definition = operation.responses[key] as JsonObject
    if (typeof definition.$ref === 'string') {
      pointer = definition.$ref
      definition = this.resolveRef(definition) as JsonObject
    }

    const violations: string[] = []
    for (const [name, header] of Object.entries((definition.headers ?? {}) as JsonObject)) {
      const headerObject = this.resolveRef(header) as JsonObject
      const value = response.headers.get(name)
      if (value === null) {
        if (headerObject.required) violations.push(`${prefix}: missing required header ${name}`)
        continue
      }
      const schema = this.resolveSchema(headerObject.schema)
      violations.push(
        ...this.validateSchema(`${pointer}/headers/${escapePointer(name)}/schema`, this.coerce(value, schema), `${prefix} header ${name}`),
      )
    }

    const contentType = mediaType(response.headers)
    const hasBody = response.body !== undefined && response.body !== ''
    const content = definition.content as JsonObject | undefined
    if (!content) {
      if (hasBody || contentType) violations.push(`${prefix}: the response must have no body`)
      return violations
    }
    if (!contentType || !(contentType in content)) {
      violations.push(
        `${prefix}: undocumented content type ${contentType ?? '(none)'} (documented: ${Object.keys(content).join(', ')})`,
      )
      return violations
    }
    if (!hasBody) {
      violations.push(`${prefix}: missing response body`)
    } else if (isJsonContentType(contentType)) {
      violations.push(
        ...this.validateSchema(`${pointer}/content/${escapePointer(contentType)}/schema`, response.body, `${prefix} body`),
      )
    }
    return violations
  }

  private operationPointer(template: string, method: string): string {
    return `#/paths/${escapePointer(template)}/${method}`
  }

  private operation(template: string, method: string): OperationObject {
    const item = (this.spec.paths as JsonObject)[template] as JsonObject
    if (!METHODS.includes(method as (typeof METHODS)[number]) || !(method in item)) {
      throw new Error(`No operation ${method} ${template}`)
    }
    return item[method] as unknown as OperationObject
  }

  private parameters(template: string, operation: OperationObject) {
    const item = (this.spec.paths as JsonObject)[template] as JsonObject
    const result: { parameter: ParameterObject; pointer: string }[] = []
    const add = (list: JsonObject[] | undefined, base: string) => {
      list?.forEach((entry, index) => {
        if (typeof entry.$ref === 'string') {
          result.push({ parameter: this.resolveRef(entry) as unknown as ParameterObject, pointer: entry.$ref })
        } else {
          result.push({ parameter: entry as unknown as ParameterObject, pointer: `${base}/parameters/${index}` })
        }
      })
    }
    add(item.parameters as JsonObject[] | undefined, `#/paths/${escapePointer(template)}`)
    const method = Object.keys(item).find((key) => item[key] === (operation as unknown as Json)) ?? ''
    add(operation.parameters, this.operationPointer(template, method))
    return result
  }

  private resolveRef(value: Json | undefined): Json | undefined {
    let current = value
    for (let depth = 0; depth < 10; depth++) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) return current
      const ref = current.$ref
      if (typeof ref !== 'string') return current
      let node: Json = this.spec
      for (const part of ref.replace(/^#\//, '').split('/')) {
        const key = part.replace(/~1/g, '/').replace(/~0/g, '~')
        node = (node as JsonObject)[key] as Json
      }
      current = node
    }
    return current
  }

  private resolveSchema(schema: Json | undefined): JsonObject | undefined {
    const resolved = this.resolveRef(schema)
    return resolved && typeof resolved === 'object' && !Array.isArray(resolved) ? resolved : undefined
  }

  /** Coerces a string from a path, query or header to the schema's primitive type. */
  private coerce(value: string | undefined, schema: JsonObject | undefined): unknown {
    if (value === undefined || !schema) return value
    const type = schema.type
    if ((type === 'integer' || type === 'number') && /^-?\d+(\.\d+)?$/.test(value)) return Number(value)
    if (type === 'boolean' && (value === 'true' || value === 'false')) return value === 'true'
    return value
  }
}

let singleton: ContractValidator | null = null

/** The validator over the vendored contract (contract/openapi.json). */
export function contractValidator(): ContractValidator {
  if (!singleton) {
    // Scripts and test runners start in the repository root (npm scripts, Vitest, Playwright).
    const path = process.env.MOCK_CONTRACT_PATH ?? join(process.cwd(), 'contract/openapi.json')
    const spec = JSON.parse(readFileSync(path, 'utf8')) as JsonObject
    singleton = new ContractValidator(spec)
  }
  return singleton
}

/** Reads a fetch Request into a RequestInfo without consuming it. */
export async function readRequest(request: Request): Promise<RequestInfo> {
  const text = await request.clone().text()
  const contentType = mediaType(request.headers)
  let body: unknown = text === '' ? undefined : text
  if (text !== '' && contentType && isJsonContentType(contentType)) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }
  return { method: request.method, url: request.url, headers: request.headers, body }
}

/** Reads a fetch Response into a ResponseInfo without consuming it. */
export async function readResponse(response: Response): Promise<ResponseInfo> {
  const contentType = mediaType(response.headers)
  if (contentType && !isJsonContentType(contentType) && !contentType.startsWith('text/')) {
    // Binary or image bodies (logos) are checked for their content type only.
    return { status: response.status, headers: response.headers, body: response.body ? '(binary)' : undefined }
  }
  const text = await response.clone().text()
  let body: unknown = text === '' ? undefined : text
  if (text !== '' && contentType && isJsonContentType(contentType)) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }
  return { status: response.status, headers: response.headers, body }
}

/** Records the violations of one scenario (or of the single Vitest state). */
export class ViolationRecorder {
  private readonly items: Violation[] = []

  record(violation: Violation): void {
    this.items.push(violation)
  }

  list(): readonly Violation[] {
    return this.items
  }

  clear(): void {
    this.items.length = 0
  }
}

export const MOCK_VIOLATION_HEADER = 'X-Mock-Contract-Violation'

/** The 500 answer to a violation. It is deliberately not a contract response. */
export function violationResponse(violation: Violation): Response {
  return new Response(
    JSON.stringify({
      type: 'urn:mailcowui-ng:mock-contract-violation',
      title: 'mock-contract-violation',
      status: 500,
      detail: violation.messages.join('; '),
      requestId: '0'.repeat(32),
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/problem+json', [MOCK_VIOLATION_HEADER]: '1' },
    },
  )
}
