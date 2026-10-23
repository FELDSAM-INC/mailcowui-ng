import type { DnsCheck } from '@/api'
import { lt } from '@/i18n'
import type { LocalDataColumn } from '@/shared/composables/useLocalDataList'
export const dnsCheckColumns = (): LocalDataColumn<DnsCheck>[] => [
  { id: 'name', label: lt('diagnostics.dns_records_name'), value: (item) => item.recordName },
  { id: 'type', label: lt('diagnostics.dns_records_type'), value: (item) => item.recordType },
  { id: 'data', label: lt('diagnostics.dns_records_data'), value: (item) => item.expected },
  { id: 'status', label: lt('diagnostics.dns_records_status'), value: (item) => item.status },
]
