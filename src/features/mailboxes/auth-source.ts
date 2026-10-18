// Authentication sources (FR-024, FR-036, the classic `admin.iam` select): the built-in source
// (named by the product, as the fork's template hard-codes its product name) and the sources the
// capabilities allow, plus an existing mailbox's own external source. Legacy shows the password,
// its repeat and the recovery e-mail only for the built-in source; the API keeps forced password
// changes off for external sources and forced second-factor setup off for generic OIDC.
import type { MailboxAuthSource, MailboxCapabilities } from '@/api'

export function authSourceOptions(
  capabilities: Pick<MailboxCapabilities, 'authSources'> | undefined,
  current?: MailboxAuthSource,
): MailboxAuthSource[] {
  const options: MailboxAuthSource[] = ['mailcow']
  for (const source of capabilities?.authSources ?? []) {
    if (!options.includes(source)) options.push(source)
  }
  if (current && !options.includes(current)) options.push(current)
  return options
}

/** The new string naming an external source, or null for the built-in one (the product name). */
export function authSourceLabelKey(source: MailboxAuthSource): string | null {
  return source === 'mailcow' ? null : `mailboxes.authSource.${source}`
}

export interface SourceControls {
  password: boolean
  recoveryEmail: boolean
  forcePasswordChange: boolean
  forceSecondFactorSetup: boolean
}

export function controlsFor(source: MailboxAuthSource): SourceControls {
  const builtIn = source === 'mailcow'
  return {
    password: builtIn,
    recoveryEmail: builtIn,
    forcePasswordChange: builtIn,
    forceSecondFactorSetup: source !== 'genericOidc',
  }
}
