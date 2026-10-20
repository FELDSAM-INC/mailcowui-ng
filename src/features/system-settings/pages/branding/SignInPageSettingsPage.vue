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
import { loginPageOptions } from '../../api/branding'
import SignInPageSection from '../../components/branding/SignInPageSection.vue'
defineProps<{ capabilities: SettingsCapabilities }>()
const { t } = useI18n(),
  query = useQuery(loginPageOptions())
const ids = ['sign-in-links', 'single-sign-on'] as const
const states = reactive<
  Partial<Record<(typeof ids)[number], { editing: boolean; dirty: boolean }>>
>({})
const open = computed(() => ids.find((id) => states[id]?.editing))
const titles = computed(() => ({
  'sign-in-links': lt('admin.login_page'),
  'single-sign-on': lt('admin.force_sso'),
}))
useLeaveGuard(
  computed(() => Object.values(states).some((state) => state?.dirty)),
  'leaveGuard.body',
)
</script>
<template>
  <div class="min-w-0 space-y-4">
    <PageHeader :title="lt('admin.login_page')"
      ><template #actions><HistoryLink target-type="loginPage" /></template
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
      <SignInPageSection
        v-for="id in ids"
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
