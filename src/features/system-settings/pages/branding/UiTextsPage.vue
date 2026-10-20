<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { problemOf, type SettingsCapabilities } from '@/api'
import { lt } from '@/i18n'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { uiTextsOptions } from '../../api/branding'
import UiTextSection from '../../components/branding/UiTextSection.vue'
import { uiTextSections, type UiTextSection as SectionId } from '../../lib/ui-text-draft'
defineProps<{ capabilities: SettingsCapabilities }>()
const { t } = useI18n()
const query = useQuery(uiTextsOptions())
const states = reactive<Partial<Record<SectionId, { editing: boolean; dirty: boolean }>>>({})
const open = computed(() => uiTextSections.find((id) => states[id]?.editing))
const titles = computed(() => ({
  names: t('systemSettings.uiTexts.names'),
  'login-help': lt('admin.help_text'),
  announcement: lt('admin.ui_header_announcement'),
  footer: lt('admin.ui_footer'),
}))
useLeaveGuard(
  computed(() => Object.values(states).some((state) => state?.dirty)),
  'leaveGuard.body',
)
</script>
<template>
  <div class="min-w-0 space-y-4">
    <PageHeader :title="lt('admin.ui_texts')"
      ><template #actions><HistoryLink target-type="uiTexts" /></template
    ></PageHeader>
    <p v-if="query.isPending.value" role="status" aria-busy="true">{{ lt('footer.loading') }}</p>
    <ProblemMessage
      v-else-if="!query.data.value"
      :problem="problemOf(query.error.value)"
      retry
      @retry="query.refetch()"
    />
    <template v-else>
      <p v-if="capabilities.demoMode" data-demo-mode role="status">
        {{ lt('danger.demo_mode_enabled') }}
      </p>
      <UiTextSection
        v-for="id in uiTextSections"
        :key="id"
        :section-id="id"
        :resource="query.data.value"
        :capabilities="capabilities"
        :edit-disabled-reason="
          open && open !== id ? t('sections.editDisabled', { section: titles[open] }) : null
        "
        @state="states[id] = $event"
      />
    </template>
  </div>
</template>
