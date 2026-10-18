// Creating a domain (UI 002 research D7, D16, FR-025 to FR-027): one submission at a time; on
// success the domain and its creation report are in the query cache (see api.ts) and the caller
// opens the domain page with router.replace.
import { useQueryClient } from '@tanstack/vue-query'
import { ref } from 'vue'

import type { ApiProblem, DomainCreated, DomainCreateRequest } from '@/api'

import { createDomain, problemOf } from '../api'

export function useCreateDomain() {
  const queryClient = useQueryClient()
  const pending = ref(false)

  async function create(
    request: DomainCreateRequest,
  ): Promise<{ ok: true; domain: DomainCreated } | { ok: false; problem: ApiProblem }> {
    if (pending.value) return { ok: false, problem: problemOf(new Error('busy'))! }
    pending.value = true
    try {
      return { ok: true, domain: await createDomain(queryClient, request) }
    } catch (error) {
      return { ok: false, problem: problemOf(error)! }
    } finally {
      pending.value = false
    }
  }

  return { pending, create }
}
