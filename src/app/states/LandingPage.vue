<script setup lang="ts">
// '/' remains a stable bookmark and sign-in fallback, but no longer renders a Home page.
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { problemOf } from '@/api'
import { lt } from '@/i18n'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { defaultLandingPath } from '../navigation/landing'
import { useIdentityQuery } from '../session/queries'

const router = useRouter()
const identity = useIdentityQuery()
watch(
  identity.data,
  (value) => {
    if (value) void router.replace(defaultLandingPath(value))
  },
  { immediate: true },
)
</script>

<template>
  <ProblemMessage
    v-if="identity.isError.value"
    :problem="problemOf(identity.error.value)"
    retry
    @retry="identity.refetch()"
  />
  <p v-else role="status" aria-busy="true">{{ lt('footer.loading') }}</p>
</template>
