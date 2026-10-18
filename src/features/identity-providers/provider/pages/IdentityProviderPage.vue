<script setup lang="ts">
// The identity provider screen (UI 012 US1, US4), mirroring the classic tab
// `templates/admin/tab-config-identity-provider.twig`. Filled by US1.
import { lt } from '@/i18n'
import PageHeader from '@/shared/components/PageHeader.vue'

import SectionNav from '../../components/SectionNav.vue'
</script>

<template>
  <section class="mx-auto flex w-full max-w-5xl flex-col gap-4">
    <SectionNav />
    <PageHeader :title="lt('admin.iam')" />
  </section>
</template>
