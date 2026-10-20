<script setup lang="ts">
// The host card's "Version" (FR-026, FR-027): the installed version tag and, below it, the update
// status as legacy shows it: "The System is on the latest version", "There is an update available"
// with the newest tag opening its release notes, or "Could not check for an Update". A disabled
// check (the FeldHost deployment) shows only the version. When the API includes the installed
// version's notes, the tag opens them, as upstream's footer does. Read once per visit.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'

import { useInstallationVersion, useUpdateStatus } from '../api'
import ReleaseNotesDialog from './ReleaseNotesDialog.vue'

const { t } = useI18n()
const version = useInstallationVersion()
const update = useUpdateStatus()
const open = ref<'latest' | 'installed' | null>(null)

const tag = computed(() => version.data.value?.tag ?? null)
const status = computed(() => (update.isError.value ? 'checkFailed' : update.data.value?.status))
const latest = computed(() => update.data.value?.latestRelease ?? null)
const installedNotes = computed(() => update.data.value?.installedReleaseNotes ?? null)

const LINK =
  'inline-flex min-h-11 items-center font-semibold text-accent-text bg-white dark:bg-gray-900 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-brand-500'
</script>

<template>
  <div data-version class="flex flex-col gap-1 font-semibold">
    <p v-if="version.isError.value && !tag">-</p>
    <p
      v-else-if="!tag"
      class="h-5 w-24 rounded bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800"
      aria-hidden="true"
    />
    <p v-else-if="!installedNotes">{{ tag }}</p>
    <p v-else>
      <button type="button" :class="LINK" @click="open = 'installed'">{{ tag }}</button>
    </p>
    <p v-if="status === 'upToDate'" data-update-status="upToDate">
      {{ lt('debug.no_update_available') }}
    </p>
    <p v-else-if="status === 'updateAvailable' && latest" data-update-status="updateAvailable">
      {{ lt('debug.update_available') }}
      {{ ' ' }}
      <button type="button" :class="LINK" @click="open = 'latest'">{{ latest.tag }}</button>
    </p>
    <p
      v-else-if="status === 'checkFailed'"
      data-update-status="checkFailed"
      class="text-red-700 dark:text-red-300"
    >
      {{ lt('debug.update_failed') }}
    </p>
    <ReleaseNotesDialog
      v-if="open === 'latest' && latest"
      :title="t('operations.updates.newRelease', { tag: latest.tag })"
      :notes="latest.notes ?? ''"
      :tag="latest.tag"
      :url="latest.url"
      @close="open = null"
    />
    <ReleaseNotesDialog
      v-if="open === 'installed' && installedNotes && tag"
      :title="t('operations.updates.version', { tag })"
      :notes="installedNotes"
      :tag="tag"
      @close="open = null"
    />
  </div>
</template>
