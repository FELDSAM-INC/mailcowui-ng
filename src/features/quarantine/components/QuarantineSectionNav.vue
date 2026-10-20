<script setup lang="ts">
// The Quarantine section's own navigation (UI 006 research R6, legacy form map screen 11): the
// registered routes of the Quarantine entry that carry `meta.sectionNav`, in their order, for the
// roles their `meta.roles` allow. A page that is not built yet is not registered, so it never
// appears and no link can break. With fewer than two entries there is nothing to navigate.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { useIdentityQuery } from '@/app/session/queries'
import SectionNavigation from '@/shared/components/SectionNavigation.vue'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const identity = useIdentityQuery()

const entries = computed(() => {
  const role = identity.data.value?.role
  if (!role) return []
  return router
    .getRoutes()
    .filter((record) => record.meta.navEntry === 'quarantine' && record.meta.sectionNav)
    .filter((record) => !record.meta.roles || record.meta.roles.includes(role))
    .sort((a, b) => a.meta.sectionNav!.order - b.meta.sectionNav!.order)
    .map((record) => ({
      id: record.name as string,
      to: router.resolve({ name: record.name }).fullPath,
      labelKey: record.meta.sectionNav!.labelKey,
      current: route.name === record.name,
    }))
})
</script>

<template>
  <SectionNavigation :label="t('quarantineUi.nav.label')" :items="entries" class="mb-4" />
</template>
