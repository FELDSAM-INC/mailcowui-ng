<script setup lang="ts">
// DNS diagnostics of the domain and alias domain lists: opens the
// DNS diagnostics of a name, as an item of an entry actions menu or as a button.
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import { GlobeIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'
import { DropdownMenuItem } from '@/shared/ui/dropdown-menu'

import { diagnosticsLocation } from '../names'

const props = withDefaults(defineProps<{ name: string; variant?: 'menuItem' | 'button' }>(), {
  variant: 'button',
})
const { t } = useI18n()
const router = useRouter()

function open() {
  void router.push(diagnosticsLocation(props.name))
}
</script>

<template>
  <DropdownMenuItem v-if="variant === 'menuItem'" class="min-h-11" data-check-dns @select="open">
    <GlobeIcon />
    <span>{{ t('dns.checkDns') }}</span>
  </DropdownMenuItem>
  <RouterLink
    v-else
    :to="diagnosticsLocation(name)"
    data-check-dns
    :class="buttonVariants({ variant: 'outline' })"
  >
    <GlobeIcon />
    {{ t('dns.checkDns') }}
  </RouterLink>
</template>
