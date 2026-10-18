<script setup lang="ts">
// The History action of an object (conventions "History and audit", UI 001 R20, UI 002 research
// D26): UI 001's audit log, filtered by target type and target ID. Nothing is shown until the audit
// log route exists (conventions "Where features meet": no broken link), or when the caller says the
// identity may not open it (`allowed`, from the catalogue's `auditLog` access). UI 012: an object
// without an ID (the identity provider configuration) links to its target type alone.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import { ListIcon } from '../icons'
import { buttonVariants } from '../ui/button'

const props = withDefaults(
  defineProps<{ targetId?: string; targetType?: string; label?: string; allowed?: boolean }>(),
  { targetId: undefined, targetType: undefined, label: undefined, allowed: true },
)
const { t } = useI18n()
const router = useRouter()
const available = computed(() => props.allowed && router.hasRoute('audit-log'))
const to = computed(() => ({
  name: 'audit-log',
  query: {
    ...(props.targetType ? { targetType: props.targetType } : {}),
    ...(props.targetId !== undefined ? { targetId: props.targetId } : {}),
  },
}))
</script>

<template>
  <RouterLink v-if="available" :to="to" :class="buttonVariants({ variant: 'outline' })">
    <ListIcon />
    {{ label ?? t('history.link') }}
  </RouterLink>
</template>
