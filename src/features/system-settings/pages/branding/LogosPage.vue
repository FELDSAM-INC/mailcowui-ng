<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SettingsCapabilities } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import LogoCard from '../../components/branding/LogoCard.vue'
defineProps<{ capabilities: SettingsCapabilities }>()
const { t } = useI18n(),
  format = useFormat()
const dirty = reactive({ light: false, dark: false })
useLeaveGuard(
  computed(() => dirty.light || dirty.dark),
  'leaveGuard.body',
)
</script>
<template>
  <div class="min-w-0 space-y-4">
    <PageHeader :title="lt('admin.change_logo')"
      ><template #actions><HistoryLink target-type="logo" /></template
    ></PageHeader>
    <LegacyText k="admin.logo_info" as="p" />
    <p>
      {{
        t('systemSettings.logos.allowed', {
          types: capabilities.logos.acceptedMediaTypes.join(', '),
        })
      }}
      {{
        t('systemSettings.logos.fileLimit', { limit: format.bytes(capabilities.logos.maxBytes) })
      }}
      {{
        t('systemSettings.logos.pixelLimit', {
          width: format.number(capabilities.logos.maxWidth),
          height: format.number(capabilities.logos.maxHeight),
        })
      }}
    </p>
    <LogoCard
      v-for="variant in ['light', 'dark'] as const"
      :key="variant"
      :variant="variant"
      :capabilities="capabilities"
      @dirty="dirty[variant] = $event"
    />
  </div>
</template>
