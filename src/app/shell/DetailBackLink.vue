<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ChevronLeftIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'
import { detailBackTo } from '../navigation/detail-back'
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const to = computed(() => detailBackTo(route, router))
function back() {
  if (window.history.length > 1 || router.options.history.state.back) router.back()
  else if (to.value) void router.replace(to.value)
}
</script>
<template>
  <button
    v-if="to"
    type="button"
    data-detail-back
    :class="buttonVariants({ variant: 'outline', class: 'mb-3 self-start' })"
    @click="back"
  >
    <ChevronLeftIcon class="size-4" />{{ t('common.back') }}
  </button>
</template>
