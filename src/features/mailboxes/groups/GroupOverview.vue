<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import DataCardFields from '@/shared/components/DataCardFields.vue'
import { Badge } from '@/shared/ui/badge'
import type { MailboxGroup } from './api'
defineProps<{ group: MailboxGroup }>()
const { t } = useI18n()
</script>
<template>
  <DataCardFields>
    <div
      v-for="field in [
        'domain',
        'address',
        'description',
        'priority',
        'identityReference',
      ] as const"
      :key="field"
    >
      <dt>{{ t(`mailboxGroups.fields.${field}`) }}</dt>
      <dd class="whitespace-pre-wrap wrap-anywhere">{{ group[field] ?? '—' }}</dd>
    </div>
    <div v-for="field in ['senderAllowed', 'sogoVisible', 'internal'] as const" :key="field">
      <dt>{{ t(`mailboxGroups.fields.${field}`) }}</dt>
      <dd>
        <Badge :color="group[field] ? 'success' : 'gray'">{{
          t(group[field] ? 'domains.values.yes' : 'domains.values.no')
        }}</Badge>
      </dd>
    </div>
    <div data-wide>
      <dt>{{ t('mailboxGroups.fields.members') }} ({{ group.members.length }})</dt>
      <dd class="flex flex-wrap gap-2">
        <span v-if="!group.members.length">{{ t('domains.values.none') }}</span
        ><Badge
          v-for="member in group.members"
          :key="member.mailbox"
          :color="member.source === 'idp' ? 'info' : 'gray'"
          class="max-w-full wrap-anywhere"
          >{{ member.mailbox
          }}<span v-if="member.source === 'idp'">
            · {{ t('mailboxGroups.identityManaged') }}</span
          ></Badge
        >
      </dd>
    </div>
    <div data-wide>
      <dt>{{ t('mailboxGroups.fields.sendAs') }}</dt>
      <dd class="whitespace-pre-line wrap-anywhere">
        {{ group.sendAs.join('\n') || t('domains.values.none') }}
      </dd>
    </div>
  </DataCardFields>
  <section
    v-for="kind in ['imapGrants', 'sogoGrants'] as const"
    :key="kind"
    class="mt-5 space-y-3 border-t border-line pt-4"
  >
    <h3 class="font-semibold">{{ t(`mailboxGroups.fields.${kind}`) }}</h3>
    <p v-if="!group[kind].length" class="text-sm text-muted">{{ t('domains.values.none') }}</p>
    <p v-else class="text-sm text-muted">{{ t('mailboxGroups.sharingHelp') }}</p>
    <ul class="space-y-3">
      <li v-for="grant in group[kind]" :key="grant.id" class="border-b border-line pb-3 text-sm">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-medium wrap-anywhere">{{ grant.owner }}</span
          ><Badge
            :color="
              grant.state === 'applied' ? 'success' : grant.state === 'failed' ? 'error' : 'info'
            "
            >{{ t(`mailboxGroups.states.${grant.state}`) }}</Badge
          >
        </div>
        <p v-if="'type' in grant">
          {{
            grant.type === 'Calendar' ? t('mailboxGroups.calendar') : t('mailboxGroups.contacts')
          }}
          / {{ grant.folder }}
        </p>
        <p>
          {{ t(`mailboxGroups.rights.${'rights' in grant ? grant.rights : grant.access}`) }} ·
          {{ t(grant.subscribe ? 'mailboxGroups.subscribed' : 'mailboxGroups.notSubscribed') }}
        </p>
        <p v-if="grant.error" class="mt-1 wrap-anywhere text-muted">
          {{
            grant.error === 'folder_missing'
              ? t('mailboxGroups.folderPending')
              : t('mailboxGroups.sharePending')
          }}
        </p>
      </li>
    </ul>
  </section>
</template>
