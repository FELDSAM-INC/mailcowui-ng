<script setup lang="ts">
// The Routing section's index (research R2, FR-001): the screens the user may open, by their
// classic tab names. With one screen (every domain administrator) it goes straight to it; while no
// screen is available it is UI 001's placeholder for the `routing` entry.
import { watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { lt } from '@/i18n'
import PlaceholderPage from '@/app/states/PlaceholderPage.vue'
import PageHeader from '@/shared/components/PageHeader.vue'

import { useRoutingIdentity } from '../composables/useRoutingIdentity'

const router = useRouter()
const { identity, screens } = useRoutingIdentity()

watch(
  () => [identity.value, screens.value] as const,
  ([current, list]) => {
    if (current && list.length === 1) void router.replace({ name: list[0]!.routeName })
  },
  { immediate: true },
)
</script>

<template>
  <PlaceholderPage v-if="identity && screens.length === 0" entry-id="routing" />
  <section v-else-if="screens.length > 1" class="mx-auto flex w-full max-w-3xl flex-col gap-4">
    <PageHeader :title="lt('admin.routing')" />
    <ul class="flex flex-col gap-2" data-routing-index>
      <li v-for="screen in screens" :key="screen.id">
        <RouterLink
          :to="{ name: screen.routeName }"
          class="flex min-h-11 items-center rounded-xl border border-gray-200 bg-white px-4 py-3 font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:hover:bg-white/5"
        >
          {{ lt(screen.labelKey) }}
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
