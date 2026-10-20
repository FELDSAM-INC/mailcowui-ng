<script setup lang="ts">
// Account sections keep their permission-filtered registry and classic order, rendered with
// the same responsive navigation as the shell's other sections.
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import SectionNavigation from '@/shared/components/SectionNavigation.vue'

import type { AccountSection } from '../../sections'

const props = defineProps<{ sections: readonly AccountSection[]; label: string }>()
const route = useRoute()
const router = useRouter()
const items = computed(() => [
  ...props.sections.map((section) => ({
    id: section.id,
    labelKey: section.title,
    to: router.resolve({ name: section.route! }).fullPath,
    current: route.meta.accountSection === section.id,
  })),
])
</script>

<template>
  <SectionNavigation :label="label" :items="items" data-section-nav />
</template>
