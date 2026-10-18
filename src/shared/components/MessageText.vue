<script setup lang="ts">
// The text of a key built at runtime (an enumeration value such as `enums.aliasDestinationType.
// learnSpam`): mailcow's own text when `LEGACY_TEXTS` names one, rendered through LegacyText so
// that its markup is kept (constitution IV 1.3.0), otherwise the new string.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { LEGACY_TEXTS } from '@/i18n/legacy-messages'

import LegacyText from './LegacyText.vue'

const props = defineProps<{ k: string }>()
const { t } = useI18n()
const classic = computed(() => LEGACY_TEXTS[props.k])
</script>

<template>
  <LegacyText v-if="classic" :k="classic" />
  <span v-else>{{ t(k) }}</span>
</template>
