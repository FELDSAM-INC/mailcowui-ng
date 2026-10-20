<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'
import { useIdentityQuery } from '@/app/session/queries'
import { resolveText } from '@/i18n'
import { useSelfServiceCapabilities } from '@/shared/composables/useSelfServiceCapabilities'
import { buttonVariants } from '@/shared/ui/button'
import { ACCOUNT_SECTIONS, mailboxAccess } from '../../sections'
defineProps<{ address: string; activeTemporaryAliases?: number }>()
const router = useRouter()
const { t } = useI18n()
const identity = useIdentityQuery()
const capabilities = useSelfServiceCapabilities()
const links = computed(() =>
  ACCOUNT_SECTIONS.filter(
    (section) =>
      section.mailboxRoute &&
      router.hasRoute(section.mailboxRoute) &&
      // Pushover keeps its editable section in the classic mailbox page's tab order (D6).
      section.id !== 'pushNotifications' &&
      mailboxAccess(section.id, identity.data.value).mode !== 'hidden' &&
      (section.id !== 'mailSettings' || capabilities.data.value?.groupware?.enabled === true),
  ),
)
</script>
<template>
  <RouterLink
    v-for="section in links"
    :key="section.id"
    :to="{ name: section.mailboxRoute!, params: { address } }"
    :class="buttonVariants({ variant: 'outline' })"
    >{{ resolveText(section.title, t)
    }}<span v-if="section.id === 'temporaryAliases' && activeTemporaryAliases !== undefined">
      ({{ activeTemporaryAliases }})</span
    ></RouterLink
  >
</template>
