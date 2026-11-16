<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ValueList from '@/shared/components/ValueList.vue'
import { Badge } from '@/shared/ui/badge'
import ActiveBadge from '@/shared/components/ActiveBadge.vue'
import type { SyncSource } from './api'
const props = defineProps<{ source: SyncSource }>()
const { t } = useI18n()
const items = computed(() => {
  const s = props.source
  return [
    ...(['name', 'description', 'remoteHost', 'remotePort'] as const).map((key) => ({
      key,
      label: t(`syncSources.fields.${key}`),
      value: String(s[key] || '—'),
    })),
    {
      key: 'encryption',
      label: t('syncSources.fields.encryption'),
      value: t(`enums.syncJobEncryption.${s.encryption}`),
    },
    {
      key: 'auth',
      label: t('syncSources.fields.authMechanism'),
      value: s.authMechanism.toUpperCase(),
    },
    {
      key: 'scope',
      label: t('syncSources.fields.scope'),
      value: t(`syncSources.scopes.${s.scope}`),
    },
    {
      key: 'targets',
      label: t('syncSources.targets'),
      value: [...s.domains, ...s.users].join(', ') || '—',
    },
    ...(s.oauth
      ? [
          {
            key: 'flow',
            label: t('syncSources.fields.flow'),
            value: t(`syncSources.flows.${s.oauth.flow}`),
          },
          ...(
            [
              'tokenEndpoint',
              'authorizationEndpoint',
              'userInfoEndpoint',
              'clientId',
              'scope',
              'redirectUri',
            ] as const
          ).map((key) => ({
            key: `oauth-${key}`,
            label: t(`syncSources.fields.${key === 'scope' ? 'oauthScope' : key}`),
            value: s.oauth?.[key] || '—',
          })),
        ]
      : []),
  ]
})
</script>
<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <ActiveBadge :active="source.active" /><Badge
        :color="source.verifyCertificate ? 'success' : 'warning'"
        >{{ t('syncSources.fields.verifyCertificate') }}:
        {{ source.verifyCertificate ? t('syncSources.enabled') : t('syncSources.disabled') }}</Badge
      >
    </div>
    <ValueList :items="items" />
    <p v-if="source.oauth?.refreshFailed" role="alert" class="text-sm text-danger">
      {{ t('syncSources.refreshFailed') }}
    </p>
    <p v-if="source.oauth?.flow === 'client_credentials'" class="text-sm text-muted">
      {{
        source.oauth.tokenSet
          ? t('syncSources.tokenExpires', { time: source.oauth.tokenExpiresAt ?? '—' })
          : t('syncSources.tokenPending')
      }}
    </p>
  </div>
</template>
