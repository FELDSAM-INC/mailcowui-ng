// Host figures for the operations mock (UI 011 T044): the overview with figures from a
// deterministic sequence per request, the mail storage usage (measured, approximate or not
// measured), the installed version and the update status with release notes that contain every
// construct the app must show safely.
import type {
  HostOverview,
  InstallationUpdateStatus,
  InstallationVersion,
  MailStorageUsage,
} from '@/api'

const GiB = 1024 ** 3

export interface MockHost {
  hostName: string
  architecture: string
  timeZone: string
  /** Epoch ms of the host's last boot. */
  bootedAt: number
  cores: number
  memoryTotal: number
  swapTotal: number
  swapUsed: number
}

export interface MockStorage {
  measured: boolean
  approximate: boolean
  device: string
  total: number
  used: number
}

export const CPU_SEQUENCE = [12, 31, 48, 27, 19, 36]
export const MEMORY_SEQUENCE = [41, 42, 44, 43, 45, 46]

export function mockHost(now: number): MockHost {
  return {
    hostName: 'mail.example.org',
    architecture: 'x86_64',
    timeZone: 'Europe/Prague',
    bootedAt: now - (3 * 86_400 + 4 * 3_600 + 5 * 60) * 1000,
    cores: 4,
    memoryTotal: 8 * GiB,
    swapTotal: 2 * GiB,
    swapUsed: 256 * 1024 ** 2,
  }
}

export function mockStorage(): MockStorage {
  return {
    measured: true,
    approximate: false,
    device: '/dev/sda1',
    total: 100 * GiB,
    used: 42 * GiB,
  }
}

export function mockVersion(): InstallationVersion {
  return {
    tag: '2026-09a',
    branch: 'master',
    commit: '3f2c1a9b7d4e5f60718293a4b5c6d7e8f9a0b1c2',
    commitDate: '2026-09-30T12:00:00Z',
    projectUrl: 'https://github.com/mailcow/mailcow-dockerized',
  }
}

export function hostOverview(
  host: MockHost,
  version: InstallationVersion,
  sequence: number,
  now: number,
  collectedAt: string,
): HostOverview {
  const swapPercent = Math.round((host.swapUsed / host.swapTotal) * 1000) / 10
  return {
    hostName: host.hostName,
    timeZone: host.timeZone,
    architecture: host.architecture,
    version,
    currentTime: new Date(now).toISOString(),
    uptimeSeconds: Math.max(0, Math.floor((now - host.bootedAt) / 1000)),
    cpu: { cores: host.cores, usagePercent: CPU_SEQUENCE[sequence % CPU_SEQUENCE.length]! },
    memory: {
      totalBytes: host.memoryTotal,
      usagePercent: MEMORY_SEQUENCE[sequence % MEMORY_SEQUENCE.length]!,
    },
    swap: { totalBytes: host.swapTotal, usedBytes: host.swapUsed, usagePercent: swapPercent },
    collectedAt,
  }
}

export function storageUsage(storage: MockStorage, collectedAt: string): MailStorageUsage {
  if (!storage.measured) {
    return {
      measured: false,
      device: null,
      totalBytes: null,
      usedBytes: null,
      availableBytes: null,
      usedPercent: null,
      approximate: false,
      collectedAt,
    }
  }
  return {
    measured: true,
    device: storage.device,
    totalBytes: storage.total,
    usedBytes: storage.used,
    availableBytes: storage.total - storage.used,
    usedPercent: Math.round((storage.used / storage.total) * 100),
    approximate: storage.approximate,
    collectedAt,
  }
}

/** Release notes with headings, a table, code, a remote image, raw HTML and links (FR-028). */
export const RELEASE_NOTES = [
  '## Highlights',
  '',
  'This release **improves** the *queue* handling. See [the docs](https://docs.mailcow.email/).',
  '',
  '| Component | Version |',
  '|---|---|',
  '| Postfix | 3.9 |',
  '',
  '```',
  'docker compose pull',
  '```',
  '',
  '> Back up first.',
  '',
  '![Release diagram](https://images.example.net/diagram.png)',
  '',
  '<script>window.__releaseNotesScript = true</script>',
  '',
  '<img src="https://images.example.net/x.png" onerror="window.__releaseNotesOnerror = true">',
  '',
  '<iframe src="https://evil.example.net/"></iframe>',
  '',
  '[Click me](javascript:alert(1))',
].join('\n')

export const INSTALLED_NOTES = '## 2026-09a\n\n- Fixes in the **Fail2ban** parameters.'

export function updateStatus(
  status: InstallationUpdateStatus['status'],
  collectedAt: string,
): InstallationUpdateStatus {
  return {
    status,
    installedVersion: status === 'disabled' ? null : '2026-09a',
    latestRelease:
      status === 'updateAvailable'
        ? {
            tag: '2026-10',
            url: 'https://github.com/mailcow/mailcow-dockerized/releases/tag/2026-10',
            publishedAt: '2026-10-15T09:00:00Z',
            notes: RELEASE_NOTES,
          }
        : null,
    installedReleaseNotes: status === 'updateAvailable' ? INSTALLED_NOTES : null,
    collectedAt,
  }
}
