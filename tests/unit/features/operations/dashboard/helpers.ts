// Shared fixtures of the dashboard component tests (UI 011 T051, T052).
import type { Container, HostOverview, MailStorageUsage } from '@/api'

export const overview: HostOverview = {
  hostName: 'mail.example.org',
  timeZone: 'Europe/Prague',
  architecture: 'x86_64',
  version: {
    tag: '2026-09a',
    branch: 'master',
    commit: null,
    commitDate: null,
    projectUrl: null,
  },
  currentTime: '2026-10-19T08:00:00Z',
  uptimeSeconds: 3 * 86_400 + 4 * 3_600 + 5 * 60,
  cpu: { cores: 4, usagePercent: 12 },
  memory: { totalBytes: 8 * 1024 ** 3, usagePercent: 41 },
  swap: { totalBytes: 0, usedBytes: 0, usagePercent: 0 },
  collectedAt: '2026-10-19T08:00:00Z',
}

export const storage: MailStorageUsage = {
  measured: true,
  device: '/dev/sda1',
  totalBytes: 100 * 1024 ** 3,
  usedBytes: 42 * 1024 ** 3,
  availableBytes: 58 * 1024 ** 3,
  usedPercent: 42,
  approximate: false,
  collectedAt: '2026-10-19T08:00:00Z',
}

export function container(overrides: Partial<Container> = {}): Container {
  return {
    name: 'sogo-mailcow',
    image: 'ghcr.io/mailcow/sogo:1.133',
    state: 'running',
    running: true,
    startedAt: '2026-10-19T07:00:00Z',
    health: null,
    protected: false,
    role: 'webmail',
    availableActions: ['stop', 'restart'],
    collectedAt: '2026-10-19T08:00:00Z',
    ...overrides,
  }
}
