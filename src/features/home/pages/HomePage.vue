<script setup lang="ts">
// The home screen (FR-047): a greeting with the username and the translated role. US3 adds the
// scope and the section shortcuts, US4 the passkey suggestion.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useIdentityQuery } from '@/app/session/queries'
import PageHeader from '@/shared/components/PageHeader.vue'

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
  </section>
</template>
