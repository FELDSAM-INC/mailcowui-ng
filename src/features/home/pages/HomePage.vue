<script setup lang="ts">
// The home screen (FR-047): a greeting with the username and the translated role, the scope of
// the account, the passkey suggestion and shortcuts to the sections it may use.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useIdentityQuery } from '@/app/session/queries'
import PageHeader from '@/shared/components/PageHeader.vue'

import PasskeySuggestion from '../components/PasskeySuggestion.vue'
import ScopeSummary from '../components/ScopeSummary.vue'
import SectionShortcuts from '../components/SectionShortcuts.vue'

const { t } = useI18n()
const identityQuery = useIdentityQuery()
const identity = computed(() => identityQuery.data.value)
const title = computed(() =>
  identity.value ? t('home.greeting', { username: identity.value.username }) : t('home.title'),
)
const description = computed(() =>
  identity.value ? t('home.role', { role: t(`roles.${identity.value.role}`) }) : undefined,
)
</script>

<template>
  <section class="mx-auto flex w-full max-w-5xl flex-col gap-6">
    <PageHeader :title="title" :description="description" />
    <template v-if="identity">
      <PasskeySuggestion />
      <ScopeSummary :identity="identity" />
      <SectionShortcuts :identity="identity" />
    </template>
  </section>
</template>
