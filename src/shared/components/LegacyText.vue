<script setup lang="ts">
// One of mailcow's own strings, by its legacy key (constitution IV 1.3.0, research R15): shown
// verbatim, as text, or through the legacy sanitiser when the value contains HTML. Arguments are
// always text (escaped inside markup). A slot named like a DataTables placeholder (`_MENU_`)
// renders the caller's content in its place, as DataTables does.
import { computed, useSlots } from 'vue'

import { legacyRaw, type LegacyKey } from '@/i18n/legacy'
import {
  escapeHtml,
  formatLegacy,
  hasMarkup,
  legacySegments,
  type LegacyArg,
  type LegacyNamed,
} from '@/i18n/legacy-format'

import SanitizedHtml from './SanitizedHtml.vue'

const props = withDefaults(
  defineProps<{
    k: LegacyKey
    args?: readonly LegacyArg[]
    named?: LegacyNamed
    /** The element that holds the text. */
    as?: string
  }>(),
  { args: () => [], named: () => ({}), as: 'span' },
)
const slots = useSlots()

const raw = computed(() => legacyRaw(props.k))
const markup = computed(() => hasMarkup(raw.value))
const html = computed(() =>
  markup.value ? formatLegacy(raw.value, props.args, props.named, escapeHtml) : '',
)
const segments = computed(() =>
  markup.value ? [] : legacySegments(raw.value, props.args, props.named, Object.keys(slots)),
)
</script>

<template>
  <SanitizedHtml v-if="markup" :html="html" profile="legacy" :tag="as" />
  <component :is="as" v-else>
    <template v-for="(segment, index) in segments" :key="index">
      <template v-if="typeof segment === 'string'">{{ segment }}</template>
      <slot v-else :name="segment.slot" />
    </template>
  </component>
</template>
