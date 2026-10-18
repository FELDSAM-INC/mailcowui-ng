<script setup lang="ts">
// The user menu (FR-042): username, role, Passkeys and Sign out. Language and theme choice arrive
// with US6 (T121). Sign-out is never confirmed (FR-036).
import { useI18n } from 'vue-i18n'

import type { Identity } from '@/api'
import { ChevronDownIcon, PasskeyIcon, SignOutIcon, UserCircleIcon } from '@/shared/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

defineProps<{ identity: Identity; signingOut?: boolean }>()
defineEmits<{ signOut: [] }>()
const { t } = useI18n()
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger
      :aria-label="t('a11y.userMenu', { username: identity.username })"
      class="flex min-h-11 max-w-[14rem] min-w-11 items-center gap-2 rounded-lg px-2 text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-white/5"
    >
      <UserCircleIcon class="size-6 shrink-0" />
      <span class="hidden truncate font-medium sm:inline">{{ identity.username }}</span>
      <ChevronDownIcon class="size-4 shrink-0" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="max-w-[calc(100vw-2rem)]">
      <DropdownMenuLabel class="px-3 py-2">
        <span class="block text-xs text-gray-600 dark:text-gray-400">{{
          t('shell.userMenu.signedInAs')
        }}</span>
        <span class="block font-medium break-all text-gray-900 dark:text-white">{{
          identity.username
        }}</span>
        <span class="block text-sm text-gray-600 dark:text-gray-400">{{
          t(`roles.${identity.role}`)
        }}</span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem to="/passkeys" class="min-h-11">
        <PasskeyIcon />
        {{ t('nav.passkeys') }}
      </DropdownMenuItem>
      <DropdownMenuItem class="min-h-11" :disabled="signingOut" @select="$emit('signOut')">
        <SignOutIcon />
        {{ signingOut ? t('shell.signingOut') : t('common.signOut') }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
