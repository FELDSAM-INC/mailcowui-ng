<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import type { SettingsCapabilities } from '@/api'
import { legacy, lt } from '@/i18n'
import SectionNavigation from '@/shared/components/SectionNavigation.vue'
defineProps<{ capabilities: SettingsCapabilities }>()
const route = useRoute()
const items = computed(() => [
  {
    id: 'logos',
    labelKey: legacy('admin.change_logo'),
    to: '/system/customize/logos',
    current: route.name === 'system-settings-logos',
  },
  {
    id: 'ui-texts',
    labelKey: legacy('admin.ui_texts'),
    to: '/system/customize/ui-texts',
    current: route.name === 'system-settings-ui-texts',
  },
])
</script>
<template>
  <div class="flex min-w-0 flex-col gap-4">
    <SectionNavigation :label="lt('admin.customize')" :items="items" />
    <RouterView v-slot="{ Component }"
      ><component :is="Component" :capabilities="capabilities"
    /></RouterView>
  </div>
</template>
