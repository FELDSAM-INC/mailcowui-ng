// Sieve filters of the mock (UI 005 T011, research R19): stored rows, their views and the minimal
// syntax rule that stands in for Sieve's parser.
import type { SieveFilter } from '@/api'

import type { MockSieveFilter } from '../scenarios/self-service/state'

export function mockSieveFilter(
  overrides: Partial<MockSieveFilter> & { id: number; mailbox: string },
): MockSieveFilter {
  return {
    description: `Filter ${overrides.id}`,
    kind: 'prefilter',
    script: 'if header :contains "subject" "[SPAM]" {\n  fileinto "Junk";\n}',
    active: true,
    createdAt: '2026-09-01T08:00:00.000Z',
    modifiedAt: null,
    version: 1,
    ...overrides,
  }
}

export const sieveFilterEtag = (item: MockSieveFilter) => `"sf-${item.id}-${item.version}"`

export function sieveFilterView(item: MockSieveFilter): SieveFilter {
  return {
    id: item.id,
    mailbox: item.mailbox,
    description: item.description,
    kind: item.kind,
    script: item.script,
    active: item.active,
    createdAt: item.createdAt,
    modifiedAt: item.modifiedAt,
    etag: sieveFilterEtag(item),
  }
}

const COMMANDS = new Set([
  'require',
  'if',
  'elsif',
  'else',
  'fileinto',
  'redirect',
  'keep',
  'discard',
  'stop',
  'reject',
  'vacation',
  'addflag',
  'setflag',
  'removeflag',
  'set',
  'notify',
])

/**
 * A minimal stand-in for the Sieve parser: unbalanced braces, or a statement that starts with an
 * unknown command, give the parser's message and line.
 */
export function checkSieve(script: string): { message: string; line: number } | null {
  let depth = 0
  const lines = script.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!
    const trimmed = line.trim()
    const word = /^([A-Za-z_]+)/.exec(trimmed.replace(/^\}\s*/, ''))?.[1]?.toLowerCase()
    if (
      word &&
      !trimmed.startsWith('#') &&
      !COMMANDS.has(word) &&
      !/^(header|address|envelope|anyof|allof|not|exists|true|false|size)$/.test(word)
    ) {
      return { message: `line ${index + 1}: unknown command '${word}'`, line: index + 1 }
    }
    for (const char of line) {
      if (char === '{') depth += 1
      if (char === '}') depth -= 1
      if (depth < 0) return { message: `line ${index + 1}: unexpected '}'`, line: index + 1 }
    }
  }
  if (depth > 0) {
    return {
      message: `line ${lines.length}: unexpected end of script, missing '}'`,
      line: lines.length,
    }
  }
  return null
}
