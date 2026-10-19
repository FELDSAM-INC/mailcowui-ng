// UI 011 (T145, constitution I): every operation that contracts/README.md lists is used through its
// contract path by the feature (or by the audit log screen), and the feature uses no other path of
// the monitoring modules.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? sources(path) : /\.(ts|vue)$/.test(name) ? [path] : []
  })
}

const feature = sources(join(root, 'src/features/operations'))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')
const auditLog = sources(join(root, 'src/features/audit-log'))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')

const readme = readFileSync(
  join(root, 'specs/011-monitoring-operations/contracts/README.md'),
  'utf8',
)
const listed = [...readme.matchAll(/^\| `(\w+)` \| (GET|POST|PUT|PATCH|DELETE) `([^`]+)`/gm)].map(
  ([, operationId, method, path]) => ({
    operationId: operationId!,
    method: method!,
    path: path!,
  }),
)

const contract = JSON.parse(readFileSync(join(root, 'contract/openapi.json'), 'utf8')) as {
  paths: Record<string, Record<string, { operationId?: string }>>
}

describe('contract usage of UI 011', () => {
  it('lists the 44 operations with their contract paths', () => {
    expect(listed).toHaveLength(44)
    for (const { operationId, method, path } of listed) {
      expect(contract.paths[path]?.[method.toLowerCase()]?.operationId, operationId).toBe(
        operationId,
      )
    }
  })

  it('uses every listed operation by its path', () => {
    for (const { operationId, path } of listed) {
      const source = operationId === 'listAuditEvents' ? auditLog : feature
      expect(source.includes(`'${path}'`), `${operationId} ${path}`).toBe(true)
    }
  })

  it('uses no other path of the monitoring modules', () => {
    const own = new Set(listed.map(({ path }) => path))
    const used = [
      ...feature.matchAll(
        /'(\/(?:capabilities\/monitoring|host|installation|containers|logs|rspamd|mail-queue|fail2ban|rate-limit-buckets)[^']*)'/g,
      ),
    ].map(([, path]) => path!)
    expect(used.filter((path) => !own.has(path))).toEqual([])
  })
})
