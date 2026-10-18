// The display name of a passkey (FR-052, data-model §2): its name, else its authenticator
// description, else "Unknown passkey" with the registration date, as legacy shows it.
import type { Passkey } from '@/api'

type Translate = (key: string, named?: Record<string, unknown>) => string

export function passkeyDisplayName(
  passkey: Pick<Passkey, 'name' | 'authenticatorDescription' | 'registeredAt'>,
  t: Translate,
  formatDate: (value: string) => string,
): string {
  const name = passkey.name?.trim()
  if (name) return name
  const description = passkey.authenticatorDescription?.trim()
  if (description) return description
  return t('passkeys.unknown', { date: formatDate(passkey.registeredAt) })
}
