<script setup lang="ts">
// The user menu (FR-042, FR-058): username and role, the language and theme choices as radio
// items, My account (UI 005), Passkeys and Sign out. Sign-out is never confirmed (FR-036). The languages are the
// installation's language menu; "Logged in as %s" is the classic interface's text.
import { useI18n } from 'vue-i18n'

import { themeValues, type Identity, type Theme } from '@/api'
import { lt, text } from '@/i18n'
import { isAppLocale, toBcp47 } from '@/i18n/locales'
import { ChevronDownIcon, PasskeyIcon, SignOutIcon, UserCircleIcon } from '@/shared/icons'
import LegacyText from '@/shared/components/LegacyText.vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

import { usePreferencesStore } from '../preferences/store'
import { usePreferenceChoice } from '../preferences/sync'

defineProps<{ identity: Identity; signingOut?: boolean }>()
defineEmits<{ signOut: [] }>()
const { t } = useI18n()
const prefs = usePreferencesStore()
const { chooseLocale, chooseTheme } = usePreferenceChoice()

function onLocale(value: unknown) {
  if (isAppLocale(value)) void chooseLocale(value)
}

function onTheme(value: unknown) {
  if ((themeValues as readonly unknown[]).includes(value)) void chooseTheme(value as Theme)
}
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
    <DropdownMenuContent align="end" class="max-h-[80dvh] max-w-[calc(100vw-2rem)] overflow-y-auto">
      <DropdownMenuLabel class="px-3 py-2">
        <LegacyText
          k="success.logged_in_as"
          :args="[identity.username]"
          class="block font-medium break-all text-gray-900 dark:text-white"
        />
        <span class="block text-sm text-gray-600 dark:text-gray-400">{{
          text(`roles.${identity.role}`)
        }}</span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <template v-if="prefs.showLanguageChoice">
        <DropdownMenuLabel class="px-3 pt-2 pb-1 text-xs text-gray-600 dark:text-gray-400">
          {{ t('preferences.language') }}
        </DropdownMenuLabel>
        <!-- The choice applies on the item's select event: the radio group's value follows later. -->
        <DropdownMenuRadioGroup :model-value="prefs.locale">
          <DropdownMenuRadioItem
            v-for="language in prefs.availableLanguages"
            :key="language.code"
            :value="language.code"
            :lang="toBcp47(language.code)"
            class="min-h-11"
            @select="onLocale(language.code)"
          >
            {{ language.name }}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
      </template>
      <DropdownMenuLabel class="px-3 pt-2 pb-1 text-xs text-gray-600 dark:text-gray-400">
        {{ t('preferences.theme') }}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup :model-value="prefs.theme">
        <DropdownMenuRadioItem
          v-for="theme in themeValues"
          :key="theme"
          :value="theme"
          class="min-h-11"
          @select="onTheme(theme)"
        >
          {{ t(`themes.${theme}`) }}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <!-- UI 005 (FR-001): My account, legacy's "User Settings". -->
      <DropdownMenuItem to="/account" class="min-h-11">
        <UserCircleIcon />
        {{ lt('header.user_settings') }}
      </DropdownMenuItem>
      <DropdownMenuItem to="/passkeys" class="min-h-11">
        <PasskeyIcon />
        {{ t('nav.passkeys') }}
      </DropdownMenuItem>
      <DropdownMenuItem class="min-h-11" :disabled="signingOut" @select="$emit('signOut')">
        <SignOutIcon />
        {{ signingOut ? lt('footer.loading') : t('common.signOut') }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
