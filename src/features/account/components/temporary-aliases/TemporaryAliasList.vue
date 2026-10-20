<script setup lang="ts">
import { computed } from 'vue'
import type { SelfServiceCapabilities, TemporaryAlias } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import { lt } from '@/i18n'
import DateTime from '@/shared/components/DateTime.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { buttonVariants } from '@/shared/ui/button'
import type { AliasValidity } from '../../validity'
import AliasAddress from './AliasAddress.vue'
import AliasExpiry from './AliasExpiry.vue'
import ValidityActions from './ValidityActions.vue'
defineProps<{
  items: readonly TemporaryAlias[]
  selection: boolean
  selected: readonly string[]
  canChange: boolean
  busy: boolean
  limits?: SelfServiceCapabilities['temporaryAliases']
}>()
const emit = defineEmits<{
  toggle: [address: string]
  remove: [item: TemporaryAlias]
  validity: [item: TemporaryAlias, value: AliasValidity]
}>()
const wide = useMediaQuery('(min-width: 768px)')
const identity = useIdentityQuery()
const historyAllowed = computed(() => identity.data.value?.role === 'admin')
</script>
<template>
  <table
    v-if="wide"
    class="w-full table-fixed text-start text-sm text-gray-800 dark:text-gray-200"
    data-temporary-alias-list
  >
    <thead>
      <tr class="border-b border-gray-200 dark:border-gray-800">
        <th v-if="selection" class="w-14 p-2">
          <span class="sr-only">{{ lt('mailbox.toggle_all') }}</span>
        </th>
        <th class="p-2 text-start">{{ lt('user.alias') }}</th>
        <th class="p-2 text-start">{{ lt('user.description') }}</th>
        <th class="p-2 text-start">{{ lt('user.alias_valid_until') }}</th>
        <th class="p-2 text-start">{{ lt('user.created_on') }}</th>
        <th class="w-44 p-2 text-start">{{ lt('user.action') }}</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="item in items"
        :key="item.address"
        :data-entry="item.address"
        class="border-b border-gray-200 dark:border-gray-800"
      >
        <td v-if="selection" class="p-2">
          <label class="flex size-11 items-center justify-center"
            ><span class="sr-only">{{ item.address }}</span
            ><input
              type="checkbox"
              class="size-5"
              :checked="selected.includes(item.address)"
              :disabled="busy"
              @change="emit('toggle', item.address)"
          /></label>
        </td>
        <td class="p-2"><AliasAddress :address="item.address" /></td>
        <td class="p-2 wrap-anywhere">{{ item.description || '–' }}</td>
        <td class="p-2"><AliasExpiry :expires-at="item.expiresAt" /></td>
        <td class="p-2"><DateTime :value="item.createdAt" /></td>
        <td class="p-2">
          <div class="flex flex-col items-start gap-2">
            <ValidityActions
              v-if="canChange && limits"
              :limits="limits"
              :address="item.address"
              :disabled="busy"
              @change="emit('validity', item, $event)"
            />
            <button
              v-if="canChange"
              type="button"
              :class="buttonVariants({ variant: 'outline', size: 'sm' })"
              :disabled="busy"
              :aria-label="`${lt('user.remove')}: ${item.address}`"
              @click="emit('remove', item)"
            >
              {{ lt('user.remove') }}
            </button>
            <HistoryLink
              target-type="temporaryAlias"
              :target-id="item.mailbox"
              :allowed="historyAllowed"
            />
          </div>
        </td>
      </tr>
    </tbody>
  </table>
  <ul v-else class="flex flex-col gap-3" data-temporary-alias-list>
    <li
      v-for="item in items"
      :key="item.address"
      :data-entry="item.address"
      class="surface flex min-w-0 flex-col gap-3 text-sm text-gray-800 dark:text-gray-200"
    >
      <label v-if="selection" class="flex min-h-11 items-center gap-3 wrap-anywhere"
        ><input
          type="checkbox"
          class="size-5 shrink-0"
          :checked="selected.includes(item.address)"
          :disabled="busy"
          @change="emit('toggle', item.address)"
        />{{ item.address }}</label
      >
      <dl class="grid gap-3">
        <div>
          <dt class="font-medium">{{ lt('user.alias') }}</dt>
          <dd><AliasAddress :address="item.address" /></dd>
        </div>
        <div>
          <dt class="font-medium">{{ lt('user.description') }}</dt>
          <dd class="wrap-anywhere">{{ item.description || '–' }}</dd>
        </div>
        <div>
          <dt class="font-medium">{{ lt('user.alias_valid_until') }}</dt>
          <dd><AliasExpiry :expires-at="item.expiresAt" /></dd>
        </div>
        <div>
          <dt class="font-medium">{{ lt('user.created_on') }}</dt>
          <dd><DateTime :value="item.createdAt" /></dd>
        </div>
      </dl>
      <div class="flex flex-wrap gap-2">
        <ValidityActions
          v-if="canChange && limits"
          :limits="limits"
          :address="item.address"
          :disabled="busy"
          @change="emit('validity', item, $event)"
        />
        <button
          v-if="canChange"
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          :disabled="busy"
          :aria-label="`${lt('user.remove')}: ${item.address}`"
          @click="emit('remove', item)"
        >
          {{ lt('user.remove') }}
        </button>
        <HistoryLink
          target-type="temporaryAlias"
          :target-id="item.mailbox"
          :allowed="historyAllowed"
        />
      </div>
    </li>
  </ul>
</template>
