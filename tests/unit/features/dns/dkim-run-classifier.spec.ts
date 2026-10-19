// The refusal classifier of DKIM runs (T045, research R8 table): refusals of one name continue the
// run; refusals of the whole form stop it.
import { describe, expect, it } from 'vitest'

import { ApiProblem } from '@/api'
import { dkimRunClassifier } from '@/features/dns/dkim/generate-run'

const problem = (status: number, type: string | null, errors: string[] = []) =>
  ApiProblem.fromParts({
    kind: 'problem',
    status,
    type: type ? `/api/v2/problems/${type}` : 'about:blank',
    fieldErrors: new Map(
      errors.map((path) => [path, [{ code: 'invalidFormat' as const, message: 'x', params: {} }]]),
    ),
  })

describe('dkimRunClassifier', () => {
  it.each([
    ['409 dkim-key-exists', problem(409, 'dkim-key-exists')],
    ['404', problem(404, null)],
    ['422 on name', problem(422, 'validation-failed', ['name'])],
    ['422 on target', problem(422, 'validation-failed', ['target'])],
  ])('continues after %s', (_label, value) => {
    expect(dkimRunClassifier(value)).toBe('entry')
  })

  it.each([
    ['422 on selector', problem(422, 'validation-failed', ['selector'])],
    ['422 on keySize', problem(422, 'validation-failed', ['keySize'])],
    ['422 on name and selector', problem(422, 'validation-failed', ['name', 'selector'])],
    ['422 without field errors', problem(422, 'validation-failed')],
    ['403 forbidden', problem(403, 'forbidden')],
    ['503 temporary-failure', problem(503, 'temporary-failure')],
    ['409 about:blank (incomplete copy source)', problem(409, null)],
    ['an unknown problem', problem(400, 'something-new')],
  ])('stops after %s', (_label, value) => {
    expect(dkimRunClassifier(value)).toBe('form')
  })
})
