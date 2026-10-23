<script setup lang="ts">
import { Badge } from '@/shared/ui/badge'

// One active ban as legacy lists it (`templates/admin/tab-config-f2b.twig`, plan decisions 2, 15
// and 19): "network (remaining ban time) - [unban] [allowlist] [denylist]", or "unban pending"
// while it is queued for lifting. The network is shown as text (no bgp.tools link).
import { useI18n } from 'vue-i18n'

import type { Fail2BanActiveBan } from '@/api'
import { lt } from '@/i18n'
import { buttonVariants } from '@/shared/ui/button'

import type { BanAction } from '../api'
import { remainingParts } from '../remaining'

defineProps<{ ban: Fail2BanActiveBan; busy: boolean }>()
const emit = defineEmits<{ action: [action: BanAction] }>()
const { t } = useI18n()
</script>

<template>
  <li :data-ban="ban.network" class="flex flex-col gap-2 py-2 sm:flex-row sm:items-center">
    <Badge color="info"
      ><span :id="`ban-${ban.network}`" class="font-mono wrap-anywhere">{{ ban.network }}</span
      ><span
        >({{ t('operations.fail2ban.remaining', remainingParts(ban.remainingSeconds)) }})</span
      ></Badge
    >
    <span aria-hidden="true" class="hidden text-gray-500 sm:inline">-</span>
    <i v-if="ban.queuedForLifting" data-pending class="text-sm text-gray-700 dark:text-gray-300">{{
      lt('admin.unban_pending')
    }}</i>
    <div v-else class="flex flex-wrap gap-2">
      <button
        v-for="action in ['lift', 'allowlist', 'denylist'] as const"
        :key="action"
        type="button"
        :class="
          buttonVariants({ variant: action === 'denylist' ? 'outline' : 'outline', size: 'sm' })
        "
        :aria-describedby="`ban-${ban.network}`"
        :disabled="busy"
        @click="emit('action', action)"
      >
        {{
          action === 'lift'
            ? lt('admin.queue_unban')
            : action === 'allowlist'
              ? t('operations.fail2ban.allowlist')
              : t('operations.fail2ban.denylist')
        }}
      </button>
    </div>
  </li>
</template>
