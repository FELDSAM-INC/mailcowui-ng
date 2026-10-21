<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, nextTick, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { problemOf, type SettingsCapabilities } from '@/api'
import { lt } from '@/i18n'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SettingsLoading from '../../components/common/SettingsLoading.vue'
import { buttonVariants } from '@/shared/ui/button'
import { ruleOptions } from '../../api/rspamd-rules'
import RuleForm from '../../components/spam/RuleForm.vue'
import { useRuleRemoval } from '../../composables/useRuleRemoval'
defineProps<{ capabilities: SettingsCapabilities }>()
const route = useRoute(),
  router = useRouter(),
  removed = ref(false)
const id = computed(() => Number(route.params.ruleId)),
  query = useQuery(computed(() => ruleOptions(id.value)))
const notFound = computed(
  () =>
    !Number.isSafeInteger(id.value) ||
    id.value <= 0 ||
    problemOf(query.error.value)?.status === 404,
)
const deletion = useRuleRemoval(async () => {
  removed.value = true
  await nextTick()
  await router.push({ name: 'rspamd-rules' })
})
</script>
<template>
  <NotFoundPage
    v-if="notFound"
    :back-to="{ name: 'rspamd-rules' }"
    :back-label="lt('admin.rspamd_settings_map')"
  />
  <section v-else class="min-w-0 space-y-5">
    <RouterLink
      :to="{ name: 'rspamd-rules' }"
      class="inline-flex min-h-11 items-center text-gray-800 underline dark:text-gray-100"
      >{{ lt('admin.rspamd_settings_map') }}</RouterLink
    >
    <PageHeader :title="`${lt('admin.rspamd_settings_map')} #${id}`"
      ><template v-if="query.data.value" #actions
        ><HistoryLink target-type="rspamdSettingsRule" :target-id="String(id)" /></template
    ></PageHeader>
    <SettingsLoading v-if="query.isPending.value" editor :fields="2" />
    <ProblemMessage
      v-else-if="query.isError.value"
      :problem="problemOf(query.error.value)"
      retry
      @retry="query.refetch()"
    />
    <template v-else-if="query.data.value && !removed">
      <RuleForm
        :key="id"
        :stored="query.data.value"
        :max-bytes="capabilities.limits.rspamdRuleContentMaxBytes"
      />
      <button
        type="button"
        :class="buttonVariants({ variant: 'outline' })"
        :disabled="deletion.pending.value"
        @click="deletion.remove(query.data.value)"
      >
        {{ lt('admin.remove') }}
      </button>
      <ProblemMessage :problem="deletion.problem.value" />
    </template>
  </section>
</template>
