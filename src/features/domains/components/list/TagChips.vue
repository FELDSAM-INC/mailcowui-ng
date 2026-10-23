<script setup lang="ts">
import TagChip from '@/shared/components/TagChip.vue'

// The tags of an entry (FR-006, FR-010, edge case "many tags"): the first tags as buttons that add
// a tag filter, and "+n" for the rest. The domain page shows them all.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { TagIcon } from '@/shared/icons'

const props = withDefaults(defineProps<{ tags: readonly string[]; max?: number }>(), { max: 5 })
const emit = defineEmits<{ filter: [tag: string] }>()
const { t } = useI18n()
const shown = computed(() => props.tags.slice(0, props.max))
const more = computed(() => props.tags.length - shown.value.length)
</script>

<template>
  <div v-if="tags.length > 0" class="flex flex-wrap items-center gap-1.5">
    <TagChip
      v-for="tag in shown"
      :key="tag"
      :aria-label="t('domains.filters.filterByTag', { tag })"
      @click="emit('filter', tag)"
      ><template #icon><TagIcon /></template><span class="break-all">{{ tag }}</span></TagChip
    >
    <span v-if="more > 0" class="text-sm font-medium text-gray-700 dark:text-gray-300">
      <span aria-hidden="true">{{ t('domains.list.moreTags', { count: more }) }}</span>
      <span class="sr-only">{{ t('domains.list.moreTagsLabel', { count: more }) }}</span>
    </span>
  </div>
</template>
