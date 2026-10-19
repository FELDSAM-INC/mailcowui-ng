<script setup lang="ts">
// An incomplete key (research R7, FR-016): it is not used for signing; the missing parts, and how
// to repair it: administrators remove it, import a complete key with overwrite or replace it;
// domain administrators ask an administrator.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DkimKey, Role } from '@/api'
import { formatList } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import { WarningIcon } from '@/shared/icons'

const props = defineProps<{ entry: DkimKey; role: Role | undefined }>()
const { t, locale } = useI18n()
const parts = computed(() =>
  formatList(
    (props.entry.key?.missingParts ?? []).map((part) => t(`dns.dkim.missingParts.${part}`)),
    locale.value as AppLocale,
  ),
)
</script>

<template>
  <div
    v-if="entry.key && !entry.key.complete"
    data-incomplete-notice
    role="note"
    class="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
  >
    <WarningIcon class="mt-0.5 size-5 shrink-0" />
    <div class="flex flex-col gap-1">
      <p class="font-semibold">{{ t('dns.dkim.incompleteNotice.title') }}</p>
      <p>{{ t('dns.dkim.incompleteNotice.body', { parts }) }}</p>
      <p>
        {{
          role === 'admin'
            ? t('dns.dkim.incompleteNotice.adviceAdmin')
            : t('dns.dkim.incompleteNotice.adviceDomainAdmin')
        }}
      </p>
    </div>
  </div>
</template>
