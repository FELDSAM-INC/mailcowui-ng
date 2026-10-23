<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { legacy, lt } from '@/i18n'
import SectionNavigation from '@/shared/components/SectionNavigation.vue'
import { useRoutingIdentity } from '../../composables/useRoutingIdentity'
import type { RoutingScreenId } from '../../screens'

const props = defineProps<{ current: RoutingScreenId }>()
const router = useRouter()
const { screens } = useRoutingIdentity()
const items = computed(() =>
  screens.value.map((screen) => ({
    id: screen.id,
    labelKey: legacy(screen.labelKey),
    to: router.resolve({ name: screen.routeName }).fullPath,
    current: screen.id === props.current,
  })),
)
</script>

<template>
  <SectionNavigation :label="lt('admin.routing')" :items="items" data-routing-nav />
</template>
