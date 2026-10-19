<script setup lang="ts">
// Replacing a key with a new one (FR-090, research R10, administrators): the generation fields of
// `GenerateKeyDialog` for this name, starting with the server's default selector, with a hint to
// choose a selector other than the current one so that the old and the new record can be published
// side by side while DNS updates. The confirmation and the version check are the caller's.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ApiProblem, DkimKey, DnsCapabilities } from '@/api'

import GenerateKeyDialog from './GenerateKeyDialog.vue'

const props = withDefaults(
  defineProps<{
    entry: DkimKey
    caps: DnsCapabilities
    pending?: boolean
    problem?: ApiProblem | null
  }>(),
  { pending: false, problem: null },
)
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ submit: [values: { selector: string; keySize: number }] }>()
const { t } = useI18n()

const names = computed(() => [{ name: props.entry.name, label: props.entry.displayName }])
const hint = computed(() =>
  props.entry.key?.selector
    ? t('dns.dkim.replace.hint', { selector: props.entry.key.selector })
    : null,
)
</script>

<template>
  <GenerateKeyDialog
    v-model:open="open"
    :names="names"
    :caps="caps"
    :pending="pending"
    :problem="problem"
    :title="t('dns.dkim.replace.title')"
    :submit-label="t('dns.dkim.replace.submit')"
    :hint="hint"
    @submit="emit('submit', $event)"
  />
</template>
