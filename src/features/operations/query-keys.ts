// The query keys of UI 011 (data-model §3). They live in the feature rather than in the shared
// factory (`@/api` `queryKeys`), so that the shell's initial payload does not carry them
// (constitution VII, research R22); only the feature uses them. Only `['monitoring', 'live', …]`
// ever polls. The list parameter types are aliases of the generated operations (`@/api`).
import type {
  Fail2BanActiveBanListParams,
  Fail2BanPermanentBanListParams,
  MailQueueListParams,
  RspamdHistoryParams,
} from '@/api'

export const operationsKeys = {
  monitoring: {
    all: () => ['monitoring'] as const,
    capabilities: () => ['monitoring', 'capabilities'] as const,
    live: () => ['monitoring', 'live'] as const,
    host: () => ['monitoring', 'live', 'host'] as const,
    containers: () => ['monitoring', 'live', 'containers'] as const,
    resourceUsage: (name: string) => ['monitoring', 'live', 'resource-usage', name] as const,
    mailStorage: () => ['monitoring', 'live', 'mail-storage'] as const,
    installation: () => ['monitoring', 'installation'] as const,
    updateStatus: () => ['monitoring', 'update-status'] as const,
    publicAddresses: () => ['monitoring', 'public-addresses'] as const,
  },
  containers: {
    all: () => ['containers'] as const,
    detail: (name: string) => ['containers', 'detail', name] as const,
  },
  logs: {
    all: () => ['logs'] as const,
    type: (slug: string) => ['logs', slug] as const,
    list: (slug: string, params: Readonly<Record<string, unknown>>) =>
      ['logs', slug, params] as const,
  },
  rspamd: {
    all: () => ['rspamd'] as const,
    statistics: () => ['rspamd', 'statistics'] as const,
    histories: () => ['rspamd', 'history'] as const,
    history: (params: RspamdHistoryParams) => ['rspamd', 'history', params] as const,
  },
  mailQueue: {
    all: () => ['mail-queue'] as const,
    lists: () => ['mail-queue', 'list'] as const,
    list: (params: MailQueueListParams) => ['mail-queue', 'list', params] as const,
    counts: () => ['mail-queue', 'counts'] as const,
    content: (queueId: string) => ['mail-queue', 'content', queueId] as const,
  },
  fail2ban: {
    all: () => ['fail2ban'] as const,
    settings: () => ['fail2ban', 'settings'] as const,
    rules: () => ['fail2ban', 'rules'] as const,
    activeBanLists: () => ['fail2ban', 'active-bans'] as const,
    activeBans: (params: Fail2BanActiveBanListParams) =>
      ['fail2ban', 'active-bans', params] as const,
    permanentBanLists: () => ['fail2ban', 'permanent-bans'] as const,
    permanentBans: (params: Fail2BanPermanentBanListParams) =>
      ['fail2ban', 'permanent-bans', params] as const,
  },
}
