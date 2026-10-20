<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useIdentityQuery } from '@/app/session/queries'
import { lt } from '@/i18n'
import { useProblemMessages } from '@/i18n/problems'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import { UserCircleIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'
import { DropdownMenuItem } from '@/shared/ui/dropdown-menu'
import { actingRequestPending, beginActing } from '../actions'
import { canSignInAs, type ActingTarget } from '../eligibility'

const props = withDefaults(defineProps<{ target: ActingTarget; menu?: boolean }>(), { menu: false })
const route = useRoute(),
  identity = useIdentityQuery(),
  request = useSecretRequest(beginActing)
const { problemMessage } = useProblemMessages()
const allowed = computed(() => canSignInAs(identity.data.value, props.target))
const name = computed(() =>
  props.target.kind === 'mailboxUser' ? props.target.address : props.target.username,
)
function start() {
  if (allowed.value) void request.run(props.target, route.fullPath)
}
</script>
<template>
  <template v-if="allowed">
    <DropdownMenuItem
      v-if="menu"
      class="min-h-11"
      :disabled="actingRequestPending"
      @select.prevent="start"
    >
      <UserCircleIcon />
      <span class="min-w-0"
        ><span
          >{{ lt('login.login') }}<span class="sr-only">{{ ` ${name}` }}</span></span
        >
        <span
          v-if="request.problem.value"
          role="alert"
          class="block text-sm text-error-700 dark:text-error-400"
          >{{ problemMessage(request.problem.value) }}</span
        >
      </span>
    </DropdownMenuItem>
    <template v-else>
      <button
        type="button"
        :class="buttonVariants({ variant: 'outline' })"
        :disabled="actingRequestPending"
        @click="start"
      >
        <UserCircleIcon />{{ lt('login.login') }}<span class="sr-only">{{ ` ${name}` }}</span>
      </button>
      <ProblemMessage :problem="request.problem.value" />
    </template>
  </template>
</template>
