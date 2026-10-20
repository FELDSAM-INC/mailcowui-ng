<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import type { Identity } from '@/api'
import { resolveText } from '@/i18n'
import SectionNavigation from '@/shared/components/SectionNavigation.vue'
import { activeSection } from '../navigation/sections'

const props = defineProps<{ identity: Identity | null | undefined }>()
const route = useRoute()
const { t } = useI18n()
const section = computed(() => activeSection(route.path, props.identity))
</script>

<template>
  <SectionNavigation
    v-if="section"
    :key="section.id"
    :label="resolveText(section.labelKey, t)"
    :items="section.tabs"
    class="mb-5"
  />
</template>
