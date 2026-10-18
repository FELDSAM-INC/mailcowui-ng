// The mock factories produce contract-valid data (research R22), and the WebAuthn helpers find
// the credential ID and challenge inside credentials.
import { describe, expect, it } from 'vitest'

import { contractValidator } from '../../mocks/contract/validator'
import { apiKey, apiKeyCreated } from '../../mocks/factories/api-key'
import { auditEvent } from '../../mocks/factories/audit-event'
import { randomBase64url } from '../../mocks/factories/ids'
import { passkey, toPasskey } from '../../mocks/factories/passkey'
import {
  challengeOf,
  creationOptions,
  credentialIdFromAssertion,
  credentialIdFromRegistration,
  fakeAssertion,
  fakeRegistration,
  requestOptions,
} from '../../mocks/factories/webauthn'
import { createScenarioState, scenarios } from '../../mocks/scenarios'
import { PUBLIC_CONFIG_VARIANTS, publicConfig } from '../../mocks/scenarios/public-config'

const validator = contractValidator()
const schema = (name: string) => `#/components/schemas/${name}`

describe('mock factories', () => {
  it('build contract-valid objects', () => {
    expect(validator.validateSchema(schema('Passkey'), toPasskey(passkey()))).toEqual([])
    expect(validator.validateSchema(schema('ApiKey'), apiKey())).toEqual([])
    expect(validator.validateSchema(schema('ApiKeyCreated'), apiKeyCreated())).toEqual([])
    expect(validator.validateSchema(schema('AuditEvent'), auditEvent())).toEqual([])
    expect(
      validator.validateSchema(
        schema('WebAuthnRequestOptions'),
        requestOptions({ allowCredentials: ['abc'] }),
      ),
    ).toEqual([])
    expect(
      validator.validateSchema(
        schema('WebAuthnCreationOptions'),
        creationOptions({ username: 'alice@example.org' }),
      ),
    ).toEqual([])
  })

  it('build every public configuration variant contract-valid', () => {
    for (const variant of PUBLIC_CONFIG_VARIANTS) {
      expect(
        validator.validateSchema(schema('PublicConfig'), publicConfig(variant)),
        variant,
      ).toEqual([])
    }
  })

  it('create every registered scenario', () => {
    for (const name of Object.keys(scenarios)) {
      expect(createScenarioState(name).name).toBe(name)
    }
  })

  it('build fake credentials that carry their credential ID and challenge', () => {
    const credentialId = randomBase64url(32)
    const challenge = randomBase64url(32)
    const assertion = fakeAssertion(credentialId, challenge)
    const registration = fakeRegistration(credentialId, challenge)
    expect(validator.validateSchema(schema('WebAuthnAuthenticationResponse'), assertion)).toEqual(
      [],
    )
    expect(validator.validateSchema(schema('WebAuthnRegistrationResponse'), registration)).toEqual(
      [],
    )
    expect(credentialIdFromAssertion(assertion)).toBe(credentialId)
    expect(credentialIdFromRegistration(registration)).toBe(credentialId)
    expect(challengeOf(assertion.response.clientDataJSON)).toBe(challenge)
    expect(challengeOf('not-json')).toBeNull()
  })
})
