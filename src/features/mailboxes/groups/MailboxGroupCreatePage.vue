<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { problemOf, queryKeys } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import { lt } from '@/i18n'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { buttonVariants } from '@/shared/ui/button'
import { createGroup, groupDetailKey, groupKey } from './api'
import { groupForm, groupValues, groupFieldId } from './form'
import GroupFormFields from './GroupFormFields.vue'
const { t } = useI18n()
const router = useRouter(),
  client = useQueryClient(),
  identity = useIdentityQuery()
const admin = computed(() => identity.data.value?.role === 'admin')
const form = ref(groupForm()),
  pending = ref(false)
const pristine = JSON.stringify(form.value)
const leave = useLeaveGuard(
  () => pending.value || JSON.stringify(form.value) !== pristine,
  'leaveGuard.body',
)
const errors = useProblemForm({ fieldId: groupFieldId })
async function save() {
  if (pending.value) return
  pending.value = true
  errors.clear()
  try {
    const group = await createGroup({
      ...groupValues(form.value, admin.value),
      name: form.value.name.trim(),
      domain: form.value.domain,
    })
    await client.invalidateQueries({ queryKey: groupKey, refetchType: 'none' })
    client.setQueryData(groupDetailKey(group.id), group)
    await client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
    leave.disarm()
    await router.replace({ name: 'mailbox-group-detail', params: { groupId: group.id } })
  } catch (error) {
    await errors.setProblem(problemOf(error))
  } finally {
    pending.value = false
  }
}
</script>
<template>
  <section class="flex w-full min-w-0 flex-col gap-4">
    <PageHeader :title="t('mailboxGroups.create')" />
    <ErrorSummary :id="errors.summaryId" :items="errors.summary.value" /><ProblemMessage
      :problem="errors.formProblem.value"
    />
    <form
      class="space-y-5 rounded-2xl border border-line bg-surface p-4 md:p-6"
      @submit.prevent="save"
    >
      <fieldset :disabled="pending" class="min-w-0 space-y-5">
        <GroupFormFields v-model="form" creating :admin="admin" :errors-for="errors.errorsFor" />
      </fieldset>
      <div class="flex items-center justify-between gap-3 border-t border-line pt-4">
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          :disabled="pending"
          @click="router.push({ name: 'mailbox-groups' })"
        >
          {{ lt('footer.cancel') }}</button
        ><button type="submit" :class="buttonVariants({})" :disabled="pending" :aria-busy="pending">
          {{ t('mailboxGroups.create') }}
        </button>
      </div>
    </form>
  </section>
</template>
