// UI 006 (T025, T107): the quarantine settings. Unset values are null and their defaults apply
// (retention 0, maximum size 0 — the quarantine is inactive —, maximum age 365, release format
// `original`, sender `quarantine@localhost`, subject "Spam Quarantine Notification", the default
// template). Administrators read every value (`visibility: full`); others read whether the
// quarantine is active, the retention and the maximum size (`visibility: public`).
import { createHash } from 'node:crypto'

import type { QuarantineSettings } from '@/api'

import type { MockQuarantineSettings } from '../scenarios/state'

export const MIB = 1_048_576
export const DEFAULT_SENDER = 'quarantine@localhost'
export const DEFAULT_SUBJECT = 'Spam Quarantine Notification'
export const DEFAULT_MAX_AGE = 365

/** A shortened copy of mailcow's default notification template (`quarantine_notification.tpl`). */
export const DEFAULT_TEMPLATE = `<html>
  <head>
    <meta name="x-apple-disable-message-reformatting" />
    <style>
      body { font-family: Helvetica, Arial, Sans-Serif; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
    </style>
  </head>
  <body>
    <p>Hi {{username}}!<br>
    {% if counter == 1 %}
    There is 1 new message waiting in quarantine:<br>
    {% else %}
    There are {{counter}} new messages waiting in quarantine:<br>
    {% endif %}
    <table>
      <tr><th>Subject</th><th>Sender</th><th>Score</th><th>Action</th><th>Arrived on</th>
      {% if quarantine_acl == 1 %}<th>Actions</th>{% endif %}</tr>
      {% for line in meta|reverse %}
      <tr>
        <td>{{ line.subject|e }}</td>
        <td>{{ line.sender|e }}</td>
        <td>{{ line.score }}</td>
        <td>{{ line.action }}</td>
        <td>{{ line.created }}</td>
        {% if quarantine_acl == 1 %}
        <td>
          <a href="https://{{ hostname }}/qhandler/release/{{ line.qhash }}">Release to inbox</a> |
          <a href="https://{{ hostname }}/qhandler/delete/{{ line.qhash }}">delete</a>
        </td>
        {% endif %}
      </tr>
      {% endfor %}
    </table>
  </body>
</html>
`

/** A server on which nothing was saved: every value unset. */
export function freshQuarantineSettings(): MockQuarantineSettings {
  return {
    retentionPerMailbox: null,
    maxMessageSize: null,
    notificationScoreLimit: null,
    maxAgeDays: null,
    excludedDomains: [],
    releaseFormat: null,
    notificationSender: null,
    notificationSubject: null,
    copyRecipient: null,
    redirectRecipient: null,
    notificationTemplate: null,
  }
}

/** The quarantine active as mailcow seeds it: 20 items per mailbox, 15 MiB. */
export function activeQuarantineSettings(): MockQuarantineSettings {
  return { ...freshQuarantineSettings(), retentionPerMailbox: 20, maxMessageSize: 15 * MIB }
}

/** Custom values everywhere, with a template that carries markup and an event handler. */
export function customQuarantineSettings(): MockQuarantineSettings {
  return {
    retentionPerMailbox: 50,
    maxMessageSize: 10 * MIB,
    notificationScoreLimit: 30.5,
    maxAgeDays: 90,
    excludedDomains: ['example.com', 'example.net'],
    releaseFormat: 'attachment',
    notificationSender: 'noreply@example.org',
    notificationSubject: 'Your quarantine',
    copyRecipient: 'copy@example.org',
    redirectRecipient: 'redirect@example.org',
    notificationTemplate:
      '<p>Hi {{username}}</p>\n<img src=x onerror=alert(1)>\n{% for line in meta %}{{ line.subject|e }}\n{% endfor %}\n',
  }
}

/** The version tag over the eleven stored values. */
export function quarantineSettingsEtag(settings: MockQuarantineSettings): string {
  const stored = JSON.stringify({ ...settings, excludedDomains: [...settings.excludedDomains] })
  return `"s${createHash('sha256').update(stored).digest('hex').slice(0, 23)}"`
}

export const isActive = (settings: MockQuarantineSettings) =>
  (settings.retentionPerMailbox ?? 0) > 0 && (settings.maxMessageSize ?? 0) > 0

/**
 * The representation for a caller. `knownDomains` are the domains and alias domains that exist,
 * for `missingExcludedDomains`.
 */
export function quarantineSettingsView(
  settings: MockQuarantineSettings,
  visibility: 'full' | 'public',
  knownDomains: ReadonlySet<string>,
): QuarantineSettings {
  const etag = quarantineSettingsEtag(settings)
  const publicPart = {
    visibility,
    active: isActive(settings),
    retentionPerMailbox: settings.retentionPerMailbox ?? 0,
    maxMessageSize: settings.maxMessageSize ?? 0,
    etag,
  }
  if (visibility === 'public') return publicPart
  const excluded = [...settings.excludedDomains].sort()
  return {
    ...publicPart,
    notificationScoreLimit: settings.notificationScoreLimit,
    maxAgeDays: settings.maxAgeDays ?? DEFAULT_MAX_AGE,
    excludedDomains: excluded,
    missingExcludedDomains: excluded.filter((name) => !knownDomains.has(name)),
    releaseFormat: settings.releaseFormat ?? 'original',
    notificationSender: settings.notificationSender ?? DEFAULT_SENDER,
    notificationSenderIsDefault: settings.notificationSender === null,
    notificationSubject: settings.notificationSubject ?? DEFAULT_SUBJECT,
    notificationSubjectIsDefault: settings.notificationSubject === null,
    copyRecipient: settings.copyRecipient,
    redirectRecipient: settings.redirectRecipient,
    notificationTemplate: settings.notificationTemplate ?? DEFAULT_TEMPLATE,
    notificationTemplateIsDefault: settings.notificationTemplate === null,
  }
}
