<script setup lang="ts">
// "Not the correct login?" (FR-006): links to the role screens other than this one, except those
// whose login link the operator has hidden; a role screen also links back to the role-neutral
// screen. A requested page (`returnTo`) is carried along. The texts are the classic login pages'
// quick links (`login.login_linkstext`, `login.login_*text`).
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, type RouteLocationRaw } from 'vue-router'

import type { LoginPageOptions, Role } from '@/api'
import { useBranding } from '@/app/branding/public-config'
import { legacy, resolveText, type LegacyRef } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'

const props = defineProps<{ role: Role | null }>()
const { t } = useI18n()
const route = useRoute()
const { branding } = useBranding()
const labelId = useId()

const ROLES: { role: Role; route: string; hidden: keyof LoginPageOptions; label: LegacyRef }[] = [
  {
    role: 'admin',
    route: 'sign-in-admin',
    hidden: 'hideAdminLogin',
    label: legacy('login.login_admintext'),
  },
  {
    role: 'domainAdmin',
    route: 'sign-in-domain-admin',
    hidden: 'hideDomainAdminLogin',
    label: legacy('login.login_domainadmintext'),
  },
  {
    role: 'mailboxUser',
    route: 'sign-in-mailbox-user',
    hidden: 'hideMailboxUserLogin',
    label: legacy('login.login_usertext'),
  },
]

const links = computed(() => {
  const returnTo = route.query.returnTo
  const query = typeof returnTo === 'string' ? { returnTo } : {}
  const to = (name: string): RouteLocationRaw => ({ name, query })
  const result: { key: string; to: RouteLocationRaw; label: string }[] = []
  if (props.role) result.push({ key: 'any', to: to('sign-in'), label: t('auth.signIn.anyRole') })
  for (const item of ROLES) {
    if (item.role === props.role || branding.value.loginPage[item.hidden]) continue
    result.push({
      key: item.role,
      to: to(item.route),
      label: resolveText(item.label, t),
    })
  }
  return result
})
</script>

<template>
  <nav v-if="links.length > 0" data-role-links :aria-labelledby="labelId">
    <p :id="labelId" class="text-sm text-gray-700 dark:text-gray-300">
      <LegacyText k="login.login_linkstext" />
    </p>
    <ul class="flex flex-col">
      <li v-for="link in links" :key="link.key">
        <RouterLink :to="link.to" class="text-link">{{ link.label }}</RouterLink>
      </li>
    </ul>
  </nav>
</template>
