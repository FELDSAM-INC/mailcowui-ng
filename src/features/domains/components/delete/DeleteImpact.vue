<script setup lang="ts">
// What deleting a domain removes and keeps, from the API's deletion preview (FR-042, research
// D20): the names, the alias domains and aliases, the domain administrators and the accounts that
// are deleted with it, the footer, the tags and stored mail, and the DKIM key, which is kept.
import { useI18n } from 'vue-i18n'

import type { Domain, DomainDeletionPreview } from '@/api'

defineProps<{ preview: DomainDeletionPreview; domain: Domain; notice?: string }>()
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col gap-3 text-sm text-gray-700 dark:text-gray-300">
    <p
      v-if="notice"
      role="status"
      class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      {{ notice }}
    </p>
    <p>{{ t('domains.delete.intro') }}</p>
    <p class="font-medium break-all text-gray-900 dark:text-white">
      {{ domain.unicodeName }}
      <span
        v-if="domain.unicodeName !== domain.name"
        class="block font-normal text-gray-600 dark:text-gray-400"
      >
        {{ domain.name }}
      </span>
    </p>
    <ul class="flex list-disc flex-col gap-1.5 ps-5">
      <li
        v-if="preview.removals.aliasDomains.length > 0"
        data-impact="aliasDomains"
        class="break-words"
      >
        {{ t('domains.delete.aliasDomains', { list: preview.removals.aliasDomains.join(', ') }) }}
      </li>
      <li data-impact="aliases">
        {{ t('domains.delete.aliases', { count: preview.removals.aliases.count }) }}
        <details v-if="preview.removals.aliases.addresses.length > 0" class="mt-1">
          <summary
            class="flex min-h-11 cursor-pointer items-center font-medium text-accent-text bg-white dark:bg-gray-900"
          >
            {{ t('domains.delete.showAliases') }}
          </summary>
          <ul class="ms-1 flex max-h-40 flex-col gap-0.5 overflow-y-auto">
            <li
              v-for="address in preview.removals.aliases.addresses"
              :key="address"
              class="break-all text-gray-700 dark:text-gray-300"
            >
              {{ address }}
            </li>
          </ul>
        </details>
      </li>
      <li v-if="domain.domainAdmins" data-impact="admins" class="break-words">
        {{
          domain.domainAdmins.length > 0
            ? t('domains.delete.admins', { list: domain.domainAdmins.join(', ') })
            : t('domains.delete.noAdmins')
        }}
      </li>
      <li data-impact="adminsToDelete" class="break-words">
        {{
          preview.domainAdminsToDelete.length > 0
            ? t('domains.delete.adminsToDelete', { list: preview.domainAdminsToDelete.join(', ') })
            : t('domains.delete.adminsKept')
        }}
      </li>
      <li v-if="preview.removals.footer" data-impact="footer">{{ t('domains.delete.footer') }}</li>
      <li data-impact="data">{{ t('domains.delete.data') }}</li>
      <li v-if="preview.dkimKeyKept" data-impact="dkim">{{ t('domains.delete.dkimKept') }}</li>
    </ul>
  </div>
</template>
