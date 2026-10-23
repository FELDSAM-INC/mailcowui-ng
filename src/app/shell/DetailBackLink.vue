<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ChevronLeftIcon } from '@/shared/icons'
import { detailBackTo } from '../navigation/detail-back'
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const to = computed(() => detailBackTo(route, router))
</script>
<template>
  <RouterLink
    v-if="to"
    :to="to"
    data-detail-back
    class="mb-3 inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-medium text-link focus-visible:outline-2 focus-visible:outline-brand-500"
  >
    <ChevronLeftIcon class="size-4" />{{ t('common.back') }}
  </RouterLink>
</template>
