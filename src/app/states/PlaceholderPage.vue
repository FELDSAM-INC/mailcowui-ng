<script setup lang="ts">
// A section that a later feature delivers (FR-044, research R19): it names the section, says that
// it comes in a later version, links to the matching pages of the classic interface for the
// user's role, and notes that the classic interface needs its own sign-in. It requests no data:
// the identity is read from the cache only.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import PageHeader from '@/shared/components/PageHeader.vue'
import { ExternalLinkIcon } from '@/shared/icons'

import { findEntry } from '../navigation/catalogue'
import { CLASSIC_PAGE_LABELS } from '../navigation/classic-links'
import { useIdentityQuery } from '../session/queries'

const props = defineProps<{ entryId: string }>()
const { t } = useI18n()
const entry = computed(() => findEntry(props.entryId))
const identity = useIdentityQuery(false)
const classicPages = computed(() => {
  const role = identity.data.value?.role
  const paths = (role && entry.value?.classic[role]) || []
  return paths.map((path) => ({
    path,
    label: t(CLASSIC_PAGE_LABELS[path] ?? 'placeholder.pages.other'),
  }))
})
</script>

<template>
  <section class="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <PageHeader :title="entry ? t(entry.labelKey) : ''" />
    <p class="-mt-4 text-gray-700 dark:text-gray-300">{{ t('states.placeholder.body') }}</p>
    <section v-if="classicPages.length > 0" class="surface" aria-labelledby="classic-heading">
      <h2 id="classic-heading" class="font-semibold text-gray-900 dark:text-white">
        {{ t('placeholder.classicHeading') }}
      </h2>
      <ul class="mt-2 flex flex-col">
        <li v-for="page in classicPages" :key="page.path">
          <a :href="page.path" class="text-link gap-2">
            <ExternalLinkIcon class="size-4 shrink-0" />
            <span>{{ page.label }}</span>
          </a>
        </li>
      </ul>
      <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">{{ t('placeholder.note') }}</p>
    </section>
  </section>
</template>
