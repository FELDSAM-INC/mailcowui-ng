// The password policy, read whenever a password form opens (FR-030). When it cannot be read, the
// form shows no rules, as legacy shows none, and the generator applies its defaults.
import { useQuery } from '@tanstack/vue-query'

import { passwordPolicyOptions } from '../api'

export function usePasswordPolicy() {
  return useQuery(passwordPolicyOptions())
}
