<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { problemOf } from '@/api'
import { lt } from '@/i18n'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import ListState from '@/shared/components/ListState.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { buttonVariants } from '@/shared/ui/button'
import { useRules } from '../../api/rspamd-rules'
import { useRuleListState } from '../../rule-list-state'
import { useRuleRemoval } from '../../composables/useRuleRemoval'
import RuleCard from '../../components/spam/RuleCard.vue'
import RuleFilters from '../../components/spam/RuleFilters.vue'
import RuleTable from '../../components/spam/RuleTable.vue'
const { t } = useI18n(),
  list = useRuleListState(),
  query = useRules(list.params, useQueryClient())
const wide = useMediaQuery('(min-width: 768px)'),
  deletion = useRuleRemoval()
const total = computed(() => query.data.value?.meta.total ?? 0)
watch(total, (count) => {
  if (count && (list.state.value.page - 1) * list.state.value.size >= count)
    void list.setPage(Math.ceil(count / list.state.value.size))
})
</script>
<template>
  <section class="min-w-0 space-y-5">
    <PageHeader :title="lt('admin.rspamd_settings_map')"
      ><template #actions
        ><RouterLink :to="{ name: 'rspamd-rule-create' }" :class="buttonVariants({})">{{
          lt('admin.rsetting_add_rule')
        }}</RouterLink
        ><HistoryLink target-type="rspamdSettingsRule" /></template
    ></PageHeader>
    <RouterLink
      :to="{ name: 'rspamd-effective-map' }"
      class="inline-flex min-h-11 items-center text-gray-800 underline dark:text-gray-100"
      >{{ lt('admin.active_rspamd_settings_map') }}</RouterLink
    >
    <RuleFilters :list="list" />
    <button
      type="button"
      :class="buttonVariants({ variant: 'outline' })"
      :disabled="query.isFetching.value"
      @click="query.refetch()"
    >
      {{ lt('admin.refresh') }}
    </button>
    <ProblemMessage :problem="deletion.problem.value" />
    <p
      v-if="deletion.removed.value !== null"
      role="status"
      class="text-green-800 dark:text-green-200"
    >
      {{ lt('success.settings_map_removed', String(deletion.removed.value)) }}.
      {{ t('systemSettings.rules.refreshNote') }}
    </p>
    <ListState
      :loading="query.isPending.value"
      :empty="!query.data.value?.data.length"
      :problem="problemOf(query.error.value)"
      :empty-text="lt('admin.rsetting_none')"
      @retry="query.refetch()"
    >
      <RuleTable
        v-if="wide"
        :items="query.data.value?.data ?? []"
        :sort="list.state.value.sort"
        :order="list.state.value.order"
        :busy="deletion.pending.value"
        @sort="list.setSort($event)"
        @remove="deletion.remove"
      />
      <div v-else class="grid min-w-0 gap-3" data-rule-list>
        <RuleCard
          v-for="item in query.data.value?.data"
          :key="item.id"
          :item="item"
          :busy="deletion.pending.value"
          @remove="deletion.remove(item)"
        />
      </div>
    </ListState>
    <PaginationBar
      :total="total"
      :page="list.state.value.page"
      :size="list.state.value.size"
      @update:page="list.setPage($event)"
      @update:size="list.setSize($event as 25 | 50 | 100)"
    />
  </section>
</template>
