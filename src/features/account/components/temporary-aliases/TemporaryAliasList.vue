<script setup lang="ts">
import { useDataColumns } from '@/shared/composables/useDataList'
import DataTableHeader from '@/shared/components/DataTableHeader.vue'

import DataCardFields from '@/shared/components/DataCardFields.vue'
import DataCard from '@/shared/components/DataCard.vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SelfServiceCapabilities, TemporaryAlias } from '@/api'
import { lt } from '@/i18n'
import DateTime from '@/shared/components/DateTime.vue'
import RowAction from '@/shared/components/RowAction.vue'
import RowActions from '@/shared/components/RowActions.vue'
import RowControls from '@/shared/components/RowControls.vue'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { announce } from '@/shared/composables/useAnnouncer'
import { copyText } from '@/shared/platform/clipboard'
import { validityLabel, validityPresets, type AliasValidity } from '../../validity'
import AliasExpiry from './AliasExpiry.vue'
const props = defineProps<{
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
const { t } = useI18n()
const listRoot = ref<HTMLElement | null>(null)
const copied = ref<{ address: string; outcome: 'copied' | 'refused' } | null>(null)
const validityChoices = computed(() => (props.limits ? validityPresets(props.limits) : []))
async function copyAddress(address: string) {
  const outcome = await copyText(address)
  copied.value = { address, outcome }
  if (outcome === 'copied') {
    announce(lt('admin.copy_to_clipboard'))
    return
  }
  const target = [
    ...(listRoot.value?.querySelectorAll<HTMLElement>('[data-alias-address]') ?? []),
  ].find((element) => element.dataset.aliasAddress === address)
  if (target) {
    target.setAttribute('tabindex', '-1')
    target.focus()
    const range = document.createRange()
    range.selectNodeContents(target)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
  announce(t('common.copy.refused'), { assertive: true })
}

const tableView = useDataColumns(() => [
  { id: 'address', label: lt('user.alias'), sort: 'address' },
  { id: 'description', label: lt('user.description') },
  { id: 'expiresAt', label: lt('user.alias_valid_until'), sort: 'expiresAt' },
  { id: 'createdAt', label: lt('user.created_on'), sort: 'createdAt' },
])
</script>
<template>
  <div v-if="wide" ref="listRoot" class="table-frame">
    <table
      class="data-table w-full table-fixed text-start text-sm text-gray-800 dark:text-gray-200"
      data-temporary-alias-list
    >
      <thead>
        <tr class="border-b border-gray-200 dark:border-gray-800">
          <th v-if="selection" class="w-14 p-2">
            <span class="sr-only">{{ lt('mailbox.toggle_all') }}</span>
          </th>
          <DataTableHeader column="address" />
          <DataTableHeader column="description" />
          <DataTableHeader column="expiresAt" />
          <DataTableHeader column="createdAt" />
          <th class="table-controls-cell p-2 text-end">{{ lt('user.action') }}</th>
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
          <td v-show="tableView.visible('address')" :data-column="'address'" class="p-2">
            <span :data-alias-address="item.address" class="wrap-anywhere">{{ item.address }}</span>
            <span
              v-if="copied?.address === item.address"
              :role="copied.outcome === 'copied' ? 'status' : 'alert'"
              class="block text-sm"
              :class="
                copied.outcome === 'copied'
                  ? 'text-green-700 dark:text-green-400'
                  : 'text-red-700 dark:text-red-300'
              "
            >
              {{
                copied.outcome === 'copied'
                  ? lt('admin.copy_to_clipboard')
                  : t('common.copy.refused')
              }}
            </span>
          </td>
          <td
            v-show="tableView.visible('description')"
            :data-column="'description'"
            class="p-2 wrap-anywhere"
          >
            {{ item.description || '–' }}
          </td>
          <td v-show="tableView.visible('expiresAt')" :data-column="'expiresAt'" class="p-2">
            <AliasExpiry :expires-at="item.expiresAt" />
          </td>
          <td v-show="tableView.visible('createdAt')" :data-column="'createdAt'" class="p-2">
            <DateTime :value="item.createdAt" />
          </td>
          <td class="table-controls-cell p-2">
            <RowControls>
              <RowActions
                v-slot="{ menu }"
                :count="1 + (canChange ? validityChoices.length + 1 : 0)"
                :label="`${lt('user.action')}: ${item.address}`"
              >
                <RowAction
                  :menu="menu"
                  :label="t('secrets.copy')"
                  :aria-label="`${t('secrets.copy')}: ${item.address}`"
                  @select="copyAddress(item.address)"
                />
                <RowAction
                  v-for="choice in canChange ? validityChoices : []"
                  :key="choice.value"
                  :menu="menu"
                  :label="validityLabel(choice.value, true)"
                  :disabled="busy"
                  @select="emit('validity', item, choice.value)"
                />
                <RowAction
                  v-if="canChange"
                  :menu="menu"
                  :disabled="busy"
                  destructive
                  :label="lt('user.remove')"
                  :aria-label="`${lt('user.remove')}: ${item.address}`"
                  @select="emit('remove', item)"
                />
              </RowActions>
            </RowControls>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <ul v-else ref="listRoot" class="flex flex-col gap-3" data-temporary-alias-list>
    <DataCard
      v-for="item in items"
      :key="item.address"
      :data-entry="item.address"
      :title="item.address"
    >
      <template #title>
        <span :data-alias-address="item.address">{{ item.address }}</span>
      </template>
      <template v-if="selection" #select>
        <label v-if="selection" class="flex min-h-11 items-center gap-3 wrap-anywhere">
          <input
            type="checkbox"
            class="size-5 shrink-0"
            :checked="selected.includes(item.address)"
            :disabled="busy"
            @change="emit('toggle', item.address)"
          />
          <span class="sr-only">{{ item.address }}</span>
        </label>
      </template>
      <template #actions>
        <RowActions
          v-slot="{ menu }"
          :count="1 + (canChange ? validityChoices.length + 1 : 0)"
          :label="`${lt('user.action')}: ${item.address}`"
        >
          <RowAction
            :menu="menu"
            :label="t('secrets.copy')"
            :aria-label="`${t('secrets.copy')}: ${item.address}`"
            @select="copyAddress(item.address)"
          />
          <RowAction
            v-for="choice in canChange ? validityChoices : []"
            :key="choice.value"
            :menu="menu"
            :label="validityLabel(choice.value, true)"
            :disabled="busy"
            @select="emit('validity', item, choice.value)"
          />
          <RowAction
            v-if="canChange"
            :menu="menu"
            :disabled="busy"
            destructive
            :label="lt('user.remove')"
            :aria-label="`${lt('user.remove')}: ${item.address}`"
            @select="emit('remove', item)"
          />
        </RowActions>
      </template>
      <span
        v-if="copied?.address === item.address"
        :role="copied.outcome === 'copied' ? 'status' : 'alert'"
        class="block text-sm"
        :class="
          copied.outcome === 'copied'
            ? 'text-green-700 dark:text-green-400'
            : 'text-red-700 dark:text-red-300'
        "
      >
        {{ copied.outcome === 'copied' ? lt('admin.copy_to_clipboard') : t('common.copy.refused') }}
      </span>
      <DataCardFields>
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
      </DataCardFields>
    </DataCard>
  </ul>
</template>
