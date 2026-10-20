<script setup lang="ts">
// The frame of My account (UI 005 research R4, FR-006; owner navigation update): the shared
// section navigation stays above the full-width content. A section the account may not use
// shows UI 001's "no access" in place, keeping the address and requesting no section data; a
// section whose rule needs the unreadable capabilities shows the error state with "Try again".
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRoute } from 'vue-router'

import { ActingUnavailableNotice } from '@/features/acting'
import PageHeader from '@/shared/components/PageHeader.vue'
import { problemOf } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import NoAccessState from '@/app/states/NoAccessState.vue'
import { lt, resolveText } from '@/i18n'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'

import { useSelfServiceCapabilities } from '@/shared/composables/useSelfServiceCapabilities'
import { useOfferedSections } from '../../composables/useOfferedSections'
import { findSection, ownVisibility } from '../../sections'
import SectionNav from './SectionNav.vue'

const { t } = useI18n()
const route = useRoute()
const identityQuery = useIdentityQuery()
const capabilities = useSelfServiceCapabilities()

const identity = computed(() => identityQuery.data.value)
const sectionId = computed(() => route.meta.accountSection ?? null)
const section = computed(() => (sectionId.value ? findSection(sectionId.value) : null))

const offered = useOfferedSections()
const actingRestricted = computed(
  () =>
    !!identity.value?.impersonation &&
    !!sectionId.value &&
    ['password', 'twoFactor', 'recoveryEmail'].includes(sectionId.value),
)

const state = computed(() => {
  if (!section.value) return 'visible'
  if (!identity.value || capabilities.isPending.value) return 'pending'
  return ownVisibility(section.value.id, identity.value, capabilities.data.value)
})
</script>

<template>
  <div class="flex w-full min-w-0 flex-col gap-6">
    <SectionNav :sections="offered" :label="lt('header.user_settings')" />
    <div data-account-content class="w-full min-w-0">
      <section v-if="actingRestricted" class="flex flex-col gap-4">
        <PageHeader
          :title="section ? resolveText(section.title, t) : ''"
        /><ActingUnavailableNotice />
      </section>
      <NoAccessState v-else-if="state === 'hidden'" :reason="section?.noAccessReason" />
      <section v-else-if="state === 'unknown'" class="flex flex-col gap-3">
        <h1
          tabindex="-1"
          class="text-2xl font-semibold text-gray-900 focus:outline-none dark:text-white"
        >
          {{ section ? resolveText(section.title, t) : '' }}
        </h1>
        <p class="font-medium text-gray-900 dark:text-white">{{ t('states.detail.error') }}</p>
        <ProblemMessage
          :problem="problemOf(capabilities.error.value)"
          retry
          @retry="capabilities.refetch()"
        />
      </section>
      <div
        v-else-if="state === 'pending'"
        data-page-loading
        role="status"
        aria-busy="true"
        class="text-gray-600 dark:text-gray-400"
      >
        {{ lt('footer.loading') }}
      </div>
      <RouterView v-else />
    </div>
  </div>
</template>
