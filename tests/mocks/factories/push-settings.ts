// Pushover settings of the mock (UI 005 T011, research R16).
import type { PushNotificationSettings } from '@/api'

import type { MockPushSettings } from '../scenarios/self-service/state'

export function mockPushSettings(overrides: Partial<MockPushSettings> = {}): MockPushSettings {
  return {
    token: 'a'.repeat(30),
    userKey: 'u'.repeat(30),
    active: true,
    title: 'Mail',
    text: '',
    senders: [],
    senderPattern: '',
    sound: 'pushover',
    evaluatePriority: false,
    onlyHighPriority: false,
    version: 1,
    ...overrides,
  }
}

export const pushEtag = (settings: MockPushSettings | null) =>
  settings ? `"po-${settings.version}"` : '"po-none"'

export function pushSettingsView(settings: MockPushSettings | null): PushNotificationSettings {
  if (!settings) {
    return {
      configured: false,
      active: false,
      tokenSet: false,
      userKeySet: false,
      title: '',
      text: '',
      senders: [],
      senderPattern: '',
      sound: 'pushover',
      evaluatePriority: false,
      onlyHighPriority: false,
      etag: pushEtag(null),
    }
  }
  return {
    configured: true,
    active: settings.active,
    tokenSet: settings.token !== '',
    userKeySet: settings.userKey !== '',
    title: settings.title,
    text: settings.text,
    senders: [...settings.senders],
    senderPattern: settings.senderPattern,
    sound: settings.sound,
    evaluatePriority: settings.evaluatePriority,
    onlyHighPriority: settings.onlyHighPriority,
    etag: pushEtag(settings),
  }
}
