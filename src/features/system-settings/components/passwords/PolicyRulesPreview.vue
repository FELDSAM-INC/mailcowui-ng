<script setup lang="ts">
import { computed } from 'vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import { policyRules, type PolicyValues } from '@/shared/password/policy-rules'

const props = defineProps<{ policy: PolicyValues }>()
const rules = computed(() => policyRules(props.policy))
</script>

<template>
  <ul data-policy-rules class="list-disc space-y-1 ps-5 text-gray-700 dark:text-gray-300">
    <li v-for="rule in rules" :key="rule.key"><LegacyText :k="rule.key" :args="rule.args" /></li>
  </ul>
</template>
