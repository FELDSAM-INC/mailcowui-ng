<script setup lang="ts">
// The server's DKIM settings, read-only, for administrators (FR-015): the default selector and key
// length of new keys, and whether private key export and DNS publication are on. While the
// capabilities load (`caps` undefined), the labels show with placeholders of one text line, so the
// list below does not move when the values arrive (SC-013, cumulative layout shift).
import { useI18n } from 'vue-i18n'

import type { DnsCapabilities } from '@/api'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'

defineProps<{ caps: DnsCapabilities | undefined }>()
const { t, locale } = useI18n()
const placeholderClass =
  'block h-5 w-20 max-w-full rounded bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800'
const onOff = (value: boolean | null) =>
  value ? t('dns.dkim.settings.on') : t('dns.dkim.settings.off')
</script>

<template>
  <section
    data-dkim-settings
    aria-labelledby="dkim-settings-title"
    :aria-busy="caps ? undefined : 'true'"
    class="rounded-2xl border border-gray-200 bg-white p-4 text-sm dark:border-gray-800 dark:bg-gray-900"
  >
    <h2 id="dkim-settings-title" class="font-semibold text-gray-900 dark:text-white">
      {{ t('dns.dkim.settings.title') }}
    </h2>
    <dl class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <dt class="text-gray-600 dark:text-gray-400">
          {{ t('dns.dkim.settings.defaultSelector') }}
        </dt>
        <dd class="font-mono break-all text-gray-900 dark:text-white">
          <template v-if="caps">{{ caps.dkim.defaultSelector }}</template>
          <span v-else data-placeholder aria-hidden="true" :class="placeholderClass" />
        </dd>
      </div>
      <div>
        <dt class="text-gray-600 dark:text-gray-400">
          {{ t('dns.dkim.settings.defaultKeySize') }}
        </dt>
        <dd class="text-gray-900 dark:text-white">
          <template v-if="caps">
            {{ formatNumber(caps.dkim.defaultKeySize, locale as AppLocale) }}
          </template>
          <span v-else data-placeholder aria-hidden="true" :class="placeholderClass" />
        </dd>
      </div>
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ t('dns.dkim.settings.export') }}</dt>
        <dd class="text-gray-900 dark:text-white">
          <template v-if="caps">{{ onOff(caps.dkim.privateKeyExportEnabled) }}</template>
          <span v-else data-placeholder aria-hidden="true" :class="placeholderClass" />
        </dd>
      </div>
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ t('dns.publication.title') }}</dt>
        <dd class="text-gray-900 dark:text-white">
          <template v-if="caps">{{ onOff(caps.dkim.dnsPublicationEnabled) }}</template>
          <span v-else data-placeholder aria-hidden="true" :class="placeholderClass" />
        </dd>
      </div>
    </dl>
  </section>
</template>
