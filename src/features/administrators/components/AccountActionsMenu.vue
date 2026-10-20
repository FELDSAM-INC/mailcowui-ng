<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { lt } from '@/i18n'
import { HorizontalDotsIcon } from '@/shared/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import type { ManagedAccount } from '../api'
defineProps<{
  account: ManagedAccount
  detailTo?: string
  own?: boolean
  lastActive?: boolean
  busy?: boolean
}>()
const emit = defineEmits<{
  action: [action: 'activate' | 'deactivate' | 'suspendSecondFactors' | 'delete']
}>()
const { t } = useI18n(),
  root = ref<HTMLElement | null>(null)
async function run(action: 'activate' | 'deactivate' | 'suspendSecondFactors' | 'delete') {
  await nextTick()
  requestAnimationFrame(() => {
    root.value?.querySelector<HTMLElement>('button')?.focus()
    emit('action', action)
  })
}
</script>
<template>
  <span ref="root" class="contents"
    ><DropdownMenu
      ><DropdownMenuTrigger
        :disabled="busy"
        :aria-label="t('lists.actionsFor', { name: account.username })"
        class="inline-flex size-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        ><HorizontalDotsIcon class="size-5"
      /></DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="max-w-[min(22rem,calc(100vw-2rem))]">
        <DropdownMenuItem v-if="detailTo" :to="detailTo" class="min-h-11">{{
          lt('admin.edit')
        }}</DropdownMenuItem>
        <DropdownMenuItem
          class="min-h-11"
          :disabled="account.active && lastActive"
          @select="run(account.active ? 'deactivate' : 'activate')"
          ><span class="flex flex-col"
            ><span>{{ lt(account.active ? 'mailbox.deactivate' : 'mailbox.activate') }}</span
            ><span v-if="account.active && lastActive" class="text-xs">{{
              lt('warning.no_active_admin')
            }}</span></span
          ></DropdownMenuItem
        >
        <DropdownMenuItem
          v-if="account.secondFactorStatus === 'active'"
          class="min-h-11"
          @select="run('suspendSecondFactors')"
          >{{ lt('tfa.disable_tfa') }}</DropdownMenuItem
        >
        <slot />
        <DropdownMenuItem
          class="min-h-11"
          variant="destructive"
          :disabled="own || lastActive"
          @select="run('delete')"
          ><span class="flex flex-col"
            ><span>{{ lt('admin.remove') }}</span
            ><span v-if="own || lastActive" class="text-xs">{{
              lt(own ? 'warning.cannot_delete_self' : 'warning.no_active_admin')
            }}</span></span
          ></DropdownMenuItem
        >
      </DropdownMenuContent>
    </DropdownMenu></span
  >
</template>
