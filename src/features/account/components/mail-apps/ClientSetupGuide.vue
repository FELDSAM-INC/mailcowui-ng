<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MailboxClientConfiguration, MailboxOverview } from '@/api'
import { lt } from '@/i18n'
import ProtocolCard from './ProtocolCard.vue'
const props = defineProps<{
  configuration: MailboxClientConfiguration
  protocolAccess?: MailboxOverview['protocolAccess']
}>()
const { t } = useI18n()
const protocols = computed(() => {
  const config = props.configuration
  const common = [
    { label: lt('user.authentication'), value: t('account.mailApps.auth.normalPassword') },
    { label: lt('user.username'), value: config.address },
  ]
  const mail = (['imap', 'pop3', 'smtp'] as const).map((id) => {
    const server = config[id]
    const title = t(`mailboxes.protocol.${id}`)
    return {
      id,
      title,
      fields: [
        { label: lt('add.hostname'), value: server.host },
        ...(server.tlsPort === null
          ? []
          : [
              {
                label: `${lt('add.port')} · ${t('account.mailApps.encryption.tls')}`,
                value: String(server.tlsPort),
              },
            ]),
        ...(server.starttlsPort === null
          ? []
          : [
              {
                label: `${lt('add.port')} · ${t('account.mailApps.encryption.starttls')}`,
                value: String(server.starttlsPort),
              },
            ]),
        ...common,
      ],
      note:
        props.protocolAccess?.[id] === false
          ? t('account.mailApps.appPasswordOnly', { protocol: title })
          : undefined,
    }
  })
  const dav = (['caldav', 'carddav'] as const).flatMap((id) => {
    const server = config[id]
    if (!server) return []
    const title = t(`account.mailApps.protocol.${id}`)
    return [
      {
        id,
        title,
        fields: [
          { label: lt('add.hostname'), value: server.host },
          {
            label: `${lt('add.port')} · ${t('account.mailApps.encryption.tls')}`,
            value: String(server.port),
          },
          {
            label: lt('admin.link'),
            value: `https://${server.host}${server.port === 443 ? '' : `:${server.port}`}${server.principalPath}`,
          },
          ...common,
        ],
        note:
          props.protocolAccess?.dav === false
            ? t('account.mailApps.appPasswordOnly', { protocol: title })
            : undefined,
      },
    ]
  })
  const title = t('mailboxes.protocol.activeSync')
  return [
    ...mail,
    ...dav,
    ...(config.activeSync
      ? [
          {
            id: 'activeSync',
            title,
            fields: [{ label: lt('admin.link'), value: config.activeSync.url }, ...common],
            note:
              props.protocolAccess?.activeSync === false
                ? t('account.mailApps.appPasswordOnly', { protocol: title })
                : undefined,
          },
        ]
      : []),
  ]
})
</script>
<template>
  <section class="flex flex-col gap-4">
    <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
      {{ t('account.mailApps.guide.title') }}
    </h2>
    <div class="grid min-w-0 gap-4 md:grid-cols-2">
      <ProtocolCard
        v-for="protocol in protocols"
        :key="protocol.id"
        :data-protocol="protocol.id"
        :title="protocol.title"
        :fields="protocol.fields"
        :note="protocol.note"
      />
    </div>
  </section>
</template>
