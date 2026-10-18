<script setup lang="ts">
// Force single sign-on (FR-007): identity-provider sign-in arrives with feature 012, so the notice
// links to the classic interface, whose sign-in page has the single sign-on button.
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { classicSignIn } from '@/app/navigation/classic-links'

const { t } = useI18n()
const titleId = useId()
</script>

<template>
  <section
    data-sso-notice
    :aria-labelledby="titleId"
    class="rounded-xl border border-blue-light-200 bg-blue-light-50 p-4 text-blue-light-950 dark:border-blue-light-800 dark:bg-blue-light-950 dark:text-blue-light-50"
  >
    <h2 :id="titleId" class="font-semibold">{{ t('auth.signIn.sso.title') }}</h2>
    <p class="mt-1">{{ t('auth.signIn.sso.body') }}</p>
    <a :href="classicSignIn(null)" class="text-link text-current! underline">
      {{ t('auth.signIn.sso.link') }}
    </a>
  </section>
</template>
