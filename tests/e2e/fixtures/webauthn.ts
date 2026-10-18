// WebAuthn tools for end-to-end tests (research R24).
// - `virtualAuthenticator()`: a CDP virtual authenticator (Chromium only; tests using it are tagged
//   @virtual-authenticator and skipped on WebKit).
// - `withoutPasskeySupport()`: a device without passkeys (PublicKeyCredential deleted).
// - `stubCredentialsRejection(name)`: navigator.credentials rejects with a named DOMException.
// - `stubCredentials(credentialId)`: navigator.credentials resolves with a contract-valid fake
//   credential for the challenge it was given, so flows that only need a submitted credential also
//   run on WebKit (the mock does not verify signatures).
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
  stubCredentialsRejection(name: string): Promise<void>
  stubCredentials(credentialId: string): Promise<void>
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

    async stubCredentialsRejection(name) {
      await context.addInitScript((errorName: string) => {
        // A device that supports WebAuthn (WebKit's test build may lack PublicKeyCredential).
        if (typeof window.PublicKeyCredential !== 'function') {
          Object.defineProperty(window, 'PublicKeyCredential', {
            configurable: true,
            value: Object.assign(function PublicKeyCredential() {}, {
              isConditionalMediationAvailable: () => Promise.resolve(false),
            }),
          })
        }
        const reject = () => Promise.reject(new DOMException('Stubbed rejection', errorName))
        Object.defineProperty(navigator, 'credentials', {
          configurable: true,
          value: { get: reject, create: reject },
        })
      }, name)
    },

    async stubCredentials(credentialId) {
      await context.addInitScript(
        ({ id, attestationObject }: { id: string; attestationObject: string }) => {
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
          const credential = (response: Record<string, string>, json: Record<string, unknown>) => ({
            id,
            rawId: fromB64(id),
            type: 'public-key',
            authenticatorAttachment: 'platform',
            response: Object.fromEntries(
              Object.entries(response).map(([key, value]) => [key, fromB64(value)]),
            ),
            getClientExtensionResults: () => ({}),
            toJSON: () => json,
          })
          const random = (length: number) => toB64(crypto.getRandomValues(new Uint8Array(length)))
          if (typeof window.PublicKeyCredential !== 'function') {
            Object.defineProperty(window, 'PublicKeyCredential', {
              configurable: true,
              value: Object.assign(function PublicKeyCredential() {}, {
                isConditionalMediationAvailable: () => Promise.resolve(false),
              }),
            })
          }
          Object.defineProperty(navigator, 'credentials', {
            configurable: true,
            value: {
              get: (options: CredentialRequestOptions) => {
                const challenge = options.publicKey?.challenge ?? new Uint8Array()
                const response = {
                  clientDataJSON: clientData('webauthn.get', challenge),
                  authenticatorData: random(37),
                  signature: random(70),
                  userHandle: random(16),
                }
                return Promise.resolve(
                  credential(response, {
                    id,
                    rawId: id,
                    type: 'public-key',
                    authenticatorAttachment: 'platform',
                    response,
                    clientExtensionResults: {},
                  }),
                )
              },
              create: (options: CredentialCreationOptions) => {
                const challenge = options.publicKey?.challenge ?? new Uint8Array()
                const response = {
                  clientDataJSON: clientData('webauthn.create', challenge),
                  attestationObject,
                }
                return Promise.resolve(
                  credential(response, {
                    id,
                    rawId: id,
                    type: 'public-key',
                    authenticatorAttachment: 'platform',
                    response: { ...response, transports: ['internal', 'hybrid'] },
                    clientExtensionResults: {},
                  }),
                )
              },
            },
          })
        },
        { id: credentialId, attestationObject: fakeAttestationObject(credentialId) },
      )
    },
  }
}
