<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { accountSecondFactorStatusValues } from '@/api'
import { domainPickerSource } from '@/features/aliases-common'
import { lt, resolveText } from '@/i18n'
import DomainPicker from '@/shared/components/DomainPicker.vue'
import FilterPanel from '@/shared/components/FilterPanel.vue'
import type { AccountRole } from '../api'
import type { AccountFilters } from '../list-state'
import { permissionLabels, permissionOrder } from '../permissions'
const props = defineProps<{
  role: AccountRole
  filters: Partial<AccountFilters>
  activeCount: number
}>()
const emit = defineEmits<{ apply: [value: Partial<AccountFilters>]; clear: [] }>()
const { t } = useI18n()
const draft = ref<Partial<AccountFilters>>({ ...props.filters })
const source = [domainPickerSource()]
function open() {
  draft.value = { ...props.filters, domain: [...(props.filters.domain ?? [])] }
}
function apply() {
  const { q: _q, ...filters } = draft.value
  emit('apply', filters)
}
</script>
<template>
  <FilterPanel
    id="account-filters"
    :active-count="activeCount"
    @open="open"
    @apply="apply"
    @clear="emit('clear')"
  >
    <div class="grid min-w-0 gap-4 sm:grid-cols-2">
      <label class="flex flex-col gap-1 text-sm"
        >{{ lt('admin.active')
        }}<select v-model="draft.status" class="form-control">
          <option :value="undefined">{{ t('lists.filters.all') }}</option>
          <option value="active">{{ lt('mailbox.active') }}</option>
          <option value="inactive">{{ lt('mailbox.inactive') }}</option>
        </select></label
      >
      <label class="flex flex-col gap-1 text-sm"
        >{{ lt('tfa.tfa')
        }}<select v-model="draft.tfa" class="form-control">
          <option :value="undefined">{{ t('lists.filters.all') }}</option>
          <option v-for="status in accountSecondFactorStatusValues" :key="status" :value="status">
            {{
              status === 'suspended'
                ? t('accounts.secondFactorStatus.suspended')
                : lt(status === 'active' ? 'mailbox.active' : 'mailbox.inactive')
            }}
          </option>
        </select></label
      >
      <label class="flex flex-col gap-1 text-sm"
        >{{ t('accounts.filters.pending')
        }}<select v-model="draft.pending" class="form-control">
          <option :value="undefined">{{ t('lists.filters.all') }}</option>
          <option value="passwordChange">{{ lt('edit.force_pw_update') }}</option>
          <option value="secondFactorSetup">{{ lt('tfa.force_tfa') }}</option>
        </select></label
      >
      <template v-if="role === 'domainAdmin'">
        <DomainPicker
          id="account-filter-domains"
          :model-value="draft.domain ?? []"
          :label="lt('admin.admin_domains')"
          :sources="source"
          multiple
          @update:model-value="draft.domain = Array.isArray($event) ? $event : []"
        />
        <label class="flex flex-col gap-1 text-sm"
          >{{ t('accounts.filters.permission')
          }}<select v-model="draft.permission" class="form-control">
            <option :value="undefined">{{ t('lists.filters.all') }}</option>
            <option v-for="name in permissionOrder" :key="name" :value="name">
              {{ resolveText(permissionLabels[name], t) }}
            </option>
          </select></label
        >
        <label v-if="draft.permission" class="flex flex-col gap-1 text-sm"
          >{{ t('accounts.filters.permissionValue')
          }}<select v-model="draft.permissionValue" class="form-control">
            <option value="on">{{ t('lists.filters.yes') }}</option>
            <option value="off">{{ t('lists.filters.no') }}</option>
          </select></label
        >
      </template>
    </div>
  </FilterPanel>
</template>
