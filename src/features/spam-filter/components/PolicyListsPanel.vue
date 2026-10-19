<script setup lang="ts">
// The Allowlist and the Denylist of an owner (UI 006 FR-045, research R19; legacy form map screens
// 5 and 6): in legacy order, side by side on wide screens and stacked from `md` up, and below `md`
// one at a time with the switch (`list` in the address) that names each with its number of
// entries. Whether the caller may add and remove entries follows the permission matrix; otherwise
// both lists are read-only with legacy's "Prohibited by ACL" note.
import { computed, reactive } from 'vue'

import type { SpamPolicyList } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import { canChangePolicy, missingFlag } from '@/features/quarantine'

import { POLICY_LISTS, useListSwitch } from '../lists-state'
import type { PolicyOwner } from '../owner'
import PolicyList from './PolicyList.vue'
import PolicyListSwitch from './PolicyListSwitch.vue'

const props = withDefaults(defineProps<{ owner: PolicyOwner; headingLevel?: 2 | 3 }>(), {
  headingLevel: 2,
})

const identity = useIdentityQuery()
const canChange = computed(() => canChangePolicy(identity.data.value, props.owner.kind))
const deniedBy = computed(() =>
  canChange.value ? null : missingFlag(identity.data.value, 'changePolicy'),
)
const switcher = useListSwitch()
const counts = reactive<Partial<Record<SpamPolicyList, number>>>({})
</script>

<template>
  <div data-policy-lists class="flex flex-col gap-4">
    <PolicyListSwitch
      :model-value="switcher.list.value"
      :counts="counts"
      @update:model-value="switcher.setList"
    />
    <div class="grid gap-8 xl:grid-cols-2">
      <PolicyList
        v-for="list in POLICY_LISTS"
        :key="list"
        :class="switcher.list.value === list ? '' : 'max-md:hidden'"
        :owner="owner"
        :list="list"
        :can-change="canChange"
        :denied-by="deniedBy"
        :heading-level="headingLevel"
        @total="(count) => (counts[list] = count)"
      />
    </div>
  </div>
</template>
