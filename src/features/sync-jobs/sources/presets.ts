import type { SourceForm } from './form'
export const passwordProviders = {
  gmail: 'imap.gmail.com',
  gmx: 'imap.gmx.net',
  webde: 'imap.web.de',
  tonline: 'secureimap.t-online.de',
  icloud: 'imap.mail.me.com',
  yahoo: 'imap.mail.yahoo.com',
  ionos: 'imap.ionos.de',
  strato: 'imap.strato.de',
} as const
export type ProviderPreset =
  keyof typeof passwordProviders | 'microsoftApp' | 'microsoftUser' | 'googleUser'
export function applyPreset(form: SourceForm, preset: ProviderPreset, tenant: string) {
  form.remotePort = 993
  form.encryption = 'ssl'
  form.verifyCertificate = true
  form.oauth.extraParameters = '{}'
  if (preset in passwordProviders) {
    form.remoteHost = passwordProviders[preset as keyof typeof passwordProviders]
    form.authMechanism = 'plain'
    return
  }
  form.authMechanism = 'xoauth2'
  form.oauth.flow = preset === 'microsoftApp' ? 'client_credentials' : 'authorization_code'
  if (preset === 'googleUser') {
    form.remoteHost = 'imap.gmail.com'
    form.oauth.authorizationEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth'
    form.oauth.tokenEndpoint = 'https://oauth2.googleapis.com/token'
    form.oauth.userInfoEndpoint = 'https://openidconnect.googleapis.com/v1/userinfo'
    form.oauth.scope = 'https://mail.google.com/ openid email'
    form.oauth.extraParameters = JSON.stringify(
      { access_type: 'offline', prompt: 'consent select_account' },
      null,
      2,
    )
  } else {
    form.remoteHost = 'outlook.office365.com'
    const base = `https://login.microsoftonline.com/${encodeURIComponent(tenant.trim() || 'common')}/oauth2/v2.0/`
    form.oauth.authorizationEndpoint = base + 'authorize'
    form.oauth.tokenEndpoint = base + 'token'
    form.oauth.userInfoEndpoint = ''
    form.oauth.scope =
      preset === 'microsoftApp'
        ? 'https://outlook.office365.com/.default'
        : 'https://outlook.office.com/IMAP.AccessAsUser.All offline_access openid email profile'
  }
  if (preset === 'microsoftApp') {
    form.scope = 'user'
    form.domains = []
    form.users = []
  }
}
