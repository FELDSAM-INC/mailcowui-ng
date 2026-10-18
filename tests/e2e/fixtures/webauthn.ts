// WebAuthn tools for end-to-end tests (research R24).
// - `virtualAuthenticator()`: a CDP virtual authenticator (Chromium only; tests using it are tagged
//   @virtual-authenticator and skipped on WebKit).
// - `withoutPasskeySupport()`: a device without passkeys (PublicKeyCredential deleted).
// - `stubCredentialsRejection(name)`: modal navigator.credentials requests reject with a named
//   DOMException.
// - `stubCredentials(credentialId)`: modal requests resolve with a contract-valid fake credential
//   for the challenge they were given, so flows that only need a submitted credential also run on
//   WebKit (the mock does not verify signatures).
// Both stubs keep conditional requests pending (the user has not picked a passkey from the
// autofill) and record every call, see installCredentialStub.
import { generateKeyPairSync, randomBytes } from 'node:crypto'

import type { BrowserContext, CDPSession, Page } from '@playwright/test'

import { fakeAttestationObject, MOCK_RP_ID } from '../../mocks/factories/webauthn'

export interface VirtualAuthenticator {
  authenticatorId: string
  client: CDPSession
  /** Adds a resident credential for the mock's relying party and returns its credential ID. */
  addCredential(init?: { credentialId?: string; userHandle?: string }): Promise<string>
}

export interface WebAuthnTools {
  virtualAuthenticator(): Promise<VirtualAuthenticator>
  withoutPasskeySupport(): Promise<void>
  /**
   * No passkeys in the autofill. Chromium's virtual authenticator answers a conditional request by
   * itself, which a real browser does only after the user picks a passkey; tests of the passkey
   * action use this so that the page does not sign in on load.
   */
  withoutConditionalMediation(): Promise<void>
  stubCredentialsRejection(name: string): Promise<void>
  stubCredentials(
    credentialId: string,
    options?: { conditional?: 'pending' | 'release' },
  ): Promise<void>
  /** The stubbed navigator.credentials calls of a page, in order. */
  credentialCalls(target?: Page): Promise<string[]>
  /** Resolves the page's held conditional request (`conditional: 'release'`). */
  releaseConditional(target?: Page): Promise<void>
}

export function createWebAuthnTools(page: Page, context: BrowserContext): WebAuthnTools {
  return {
    async virtualAuthenticator() {
      const client = await context.newCDPSession(page)
      await client.send('WebAuthn.enable')
      const { authenticatorId } = await client.send('WebAuthn.addVirtualAuthenticator', {
        options: {
          protocol: 'ctap2',
          transport: 'internal',
          hasResidentKey: true,
          hasUserVerification: true,
          isUserVerified: true,
          automaticPresenceSimulation: true,
        },
      })
      return {
        authenticatorId,
        client,
        async addCredential(init = {}) {
          const credentialId = init.credentialId ?? randomBytes(32).toString('base64url')
          const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
          await client.send('WebAuthn.addCredential', {
            authenticatorId,
            credential: {
              credentialId: Buffer.from(credentialId, 'base64url').toString('base64'),
              isResidentCredential: true,
              rpId: MOCK_RP_ID,
              privateKey: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
              userHandle: Buffer.from(init.userHandle ?? 'user').toString('base64'),
              signCount: 0,
            },
          })
          return credentialId
        },
      }
    },

    async withoutPasskeySupport() {
      await context.addInitScript(() => {
        Reflect.deleteProperty(window, 'PublicKeyCredential')
      })
    },

    async withoutConditionalMediation() {
      await context.addInitScript(() => {
        if (typeof window.PublicKeyCredential !== 'function') return
        Object.defineProperty(window.PublicKeyCredential, 'isConditionalMediationAvailable', {
          configurable: true,
          value: () => Promise.resolve(false),
        })
      })
    },

    async stubCredentialsRejection(name) {
      const init: StubInit = {
        mode: 'reject',
        errorName: name,
        id: '',
        attestationObject: '',
        conditional: 'pending',
      }
      await context.addInitScript(installCredentialStub, init)
    },

    async stubCredentials(credentialId, options = {}) {
      const init: StubInit = {
        mode: 'resolve',
        errorName: '',
        id: credentialId,
        attestationObject: fakeAttestationObject(credentialId),
        conditional: options.conditional ?? 'pending',
      }
      await context.addInitScript(installCredentialStub, init)
    },

    async credentialCalls(target = page) {
      return target.evaluate(() => window.__mailcowuiNgCredentialCalls ?? [])
    },

    async releaseConditional(target = page) {
      await target.evaluate(() => window.__mailcowuiNgReleaseConditional?.())
    },
  }
}

declare global {
  interface Window {
    /** Each navigator.credentials call of a stub: `get:conditional`, `get:modal` or `create`. */
    __mailcowuiNgCredentialCalls?: string[]
    /** Resolves a held conditional request (stubCredentials with `conditional: 'release'`). */
    __mailcowuiNgReleaseConditional?: () => void
  }
}

interface StubInit {
  mode: 'resolve' | 'reject'
  errorName: string
  id: string
  attestationObject: string
  conditional: 'pending' | 'release'
}

/**
 * Replaces navigator.credentials in the page (an init script, so it runs before the app). A
 * device with WebAuthn and conditional mediation is assumed, also on WebKit, whose test build may
 * lack PublicKeyCredential. A conditional request stays pending, as in a browser where the user
 * has not picked a passkey from the autofill, and rejects with AbortError when aborted; with
 * `conditional: 'release'` it resolves once the test calls `__mailcowuiNgReleaseConditional()`.
 * Modal requests resolve with a contract-valid fake credential for the challenge they were given,
 * or reject with the named DOMException.
 */
function installCredentialStub(init: StubInit) {
  const toB64 = (buffer: ArrayBuffer | ArrayBufferView) => {
    const bytes =
      buffer instanceof ArrayBuffer
        ? new Uint8Array(buffer)
        : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  const fromB64 = (value: string) => {
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
    return Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer
  }
  const clientData = (type: string, challenge: BufferSource) =>
    toB64(
      new TextEncoder().encode(
        JSON.stringify({ type, challenge: toB64(challenge), origin: location.origin }),
      ),
    )
  const random = (length: number) => toB64(crypto.getRandomValues(new Uint8Array(length)))
  const credential = (response: Record<string, string>, json: Record<string, unknown>) => ({
    id: init.id,
    rawId: fromB64(init.id),
    type: 'public-key',
    authenticatorAttachment: 'platform',
    response: Object.fromEntries(
      Object.entries(response).map(([key, value]) => [key, fromB64(value)]),
    ),
    getClientExtensionResults: () => ({}),
    toJSON: () => json,
  })
  const assertion = (options: CredentialRequestOptions) => {
    const challenge = options.publicKey?.challenge ?? new Uint8Array()
    const response = {
      clientDataJSON: clientData('webauthn.get', challenge),
      authenticatorData: random(37),
      signature: random(70),
      userHandle: random(16),
    }
    return credential(response, {
      id: init.id,
      rawId: init.id,
      type: 'public-key',
      authenticatorAttachment: 'platform',
      response,
      clientExtensionResults: {},
    })
  }
  const aborted = () => new DOMException('The operation was aborted.', 'AbortError')

  if (typeof window.PublicKeyCredential !== 'function') {
    Object.defineProperty(window, 'PublicKeyCredential', {
      configurable: true,
      value: function PublicKeyCredential() {},
    })
  }
  Object.defineProperty(window.PublicKeyCredential, 'isConditionalMediationAvailable', {
    configurable: true,
    value: () => Promise.resolve(true),
  })

  const calls: string[] = []
  window.__mailcowuiNgCredentialCalls = calls
  const held: (() => void)[] = []
  window.__mailcowuiNgReleaseConditional = () => held.splice(0).forEach((release) => release())

  Object.defineProperty(navigator, 'credentials', {
    configurable: true,
    value: {
      get: (options: CredentialRequestOptions) => {
        const conditional = options.mediation === 'conditional'
        calls.push(conditional ? 'get:conditional' : 'get:modal')
        if (conditional) {
          return new Promise((resolve, reject) => {
            options.signal?.addEventListener('abort', () => reject(aborted()))
            if (init.conditional === 'release' && init.mode === 'resolve') {
              held.push(() => resolve(assertion(options)))
            }
          })
        }
        if (init.mode === 'reject') {
          return Promise.reject(new DOMException('Stubbed rejection', init.errorName))
        }
        return Promise.resolve(assertion(options))
      },
      create: (options: CredentialCreationOptions) => {
        calls.push('create')
        if (init.mode === 'reject') {
          return Promise.reject(new DOMException('Stubbed rejection', init.errorName))
        }
        const challenge = options.publicKey?.challenge ?? new Uint8Array()
        const response = {
          clientDataJSON: clientData('webauthn.create', challenge),
          attestationObject: init.attestationObject,
        }
        return Promise.resolve(
          credential(response, {
            id: init.id,
            rawId: init.id,
            type: 'public-key',
            authenticatorAttachment: 'platform',
            response: { ...response, transports: ['internal', 'hybrid'] },
            clientExtensionResults: {},
          }),
        )
      },
    },
  })
}
