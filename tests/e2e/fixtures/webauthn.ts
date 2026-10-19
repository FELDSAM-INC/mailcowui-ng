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
// autofill) and record every call, see installCredentialStub. `rejectConditional(name)` settles
// the pending conditional request as the browser does when the user dismisses its prompt.
// `pendingConditional()` counts the conditional requests still pending, and `overlappingCalls()`
// the calls made while one was: the app aborts its autofill request before any other ceremony
// (research R14), so the `webauthn` fixture expects none after every test.
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
  /** Rejects the page's pending conditional request with a named DOMException, as the browser does. */
  rejectConditional(name: string, target?: Page): Promise<void>
  /** The page's conditional requests that are still pending (neither settled nor aborted). */
  pendingConditional(target?: Page): Promise<number>
  /** The page's credential calls made while a conditional request was still pending. */
  overlappingCalls(target?: Page): Promise<number>
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

    async rejectConditional(name, target = page) {
      await target.evaluate((errorName) => window.__mailcowuiNgRejectConditional?.(errorName), name)
    },

    async pendingConditional(target = page) {
      return target.evaluate(() => window.__mailcowuiNgCredentialState?.().pendingConditional ?? 0)
    },

    async overlappingCalls(target = page) {
      return target.evaluate(() => window.__mailcowuiNgCredentialState?.().overlapping ?? 0)
    },
  }
}

declare global {
  interface Window {
    /** Each navigator.credentials call of a stub: `get:conditional`, `get:modal` or `create`. */
    __mailcowuiNgCredentialCalls?: string[]
    /** Resolves a held conditional request (stubCredentials with `conditional: 'release'`). */
    __mailcowuiNgReleaseConditional?: () => void
    /** Rejects the pending conditional requests with a named DOMException. */
    __mailcowuiNgRejectConditional?: (name: string) => void
    /** Conditional requests still pending, and calls made while one was. */
    __mailcowuiNgCredentialState?: () => { pendingConditional: number; overlapping: number }
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
 * `__mailcowuiNgRejectConditional(name)` rejects it as the browser does after a dismissed prompt.
 * A conditional request counts as pending until it settles or its signal aborts (synchronously, as
 * in a browser); a call made meanwhile counts as overlapping. Modal requests resolve with a contract-valid fake credential for the challenge they were given,
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
  const pending: ((error: DOMException) => void)[] = []
  window.__mailcowuiNgRejectConditional = (name) => {
    held.length = 0
    pending.splice(0).forEach((reject) => reject(new DOMException('Stubbed rejection', name)))
  }
  let pendingConditional = 0
  let overlapping = 0
  window.__mailcowuiNgCredentialState = () => ({ pendingConditional, overlapping })
  const record = (call: string) => {
    if (pendingConditional > 0) overlapping += 1
    calls.push(call)
  }

  Object.defineProperty(navigator, 'credentials', {
    configurable: true,
    value: {
      get: (options: CredentialRequestOptions) => {
        const conditional = options.mediation === 'conditional'
        record(conditional ? 'get:conditional' : 'get:modal')
        if (conditional) {
          return new Promise((resolve, reject) => {
            pendingConditional += 1
            let open = true
            const settle =
              <T>(done: (value: T) => void) =>
              (value: T) => {
                if (!open) return
                open = false
                pendingConditional -= 1
                done(value)
              }
            const fail = settle(reject)
            options.signal?.addEventListener('abort', () => fail(aborted()))
            pending.push(fail)
            if (init.conditional === 'release' && init.mode === 'resolve') {
              held.push(() => settle(resolve)(assertion(options)))
            }
          })
        }
        if (init.mode === 'reject') {
          return Promise.reject(new DOMException('Stubbed rejection', init.errorName))
        }
        return Promise.resolve(assertion(options))
      },
      create: (options: CredentialCreationOptions) => {
        record('create')
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
