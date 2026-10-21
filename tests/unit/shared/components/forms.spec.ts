// Form error handling (FR-075–FR-078, research R20): useProblemForm, FormField, ErrorSummary and
// ProblemMessage.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import { ApiProblem, type FieldViolation } from '@/api'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import LiveAnnouncer from '@/shared/components/LiveAnnouncer.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useProblemForm } from '@/shared/composables/useProblemForm'

import { mountWithApp } from '../../support/mount'

const violation = (code: string, params: Record<string, unknown> = {}): FieldViolation =>
  ({ code, params, message: 'English' }) as FieldViolation

function validationProblem(errors: Record<string, FieldViolation[]>) {
  return ApiProblem.fromParts({
    kind: 'problem',
    type: '/api/v2/problems/validation-failed',
    status: 422,
    requestId: 'f'.repeat(32),
    fieldErrors: new Map(Object.entries(errors)),
  })
}

/** A small form with a name field and a list of networks. */
function mountForm() {
  let form!: ReturnType<typeof useProblemForm>
  const Host = defineComponent({
    setup() {
      form = useProblemForm({
        fieldId: (path) => {
          if (path === 'name') return 'key-name'
          const network = /^allowedNetworks\.(\d+)$/.exec(path)
          if (network) return `key-network-${network[1]}`
          return null
        },
      })
      return () =>
        h('form', [
          h(ErrorSummary, { id: form.summaryId, items: form.summary.value }),
          h(ProblemMessage, { problem: form.formProblem.value }),
          h(
            FormField,
            { id: 'key-name', label: 'Name', errors: form.errorsFor('name') },
            {
              default: (field: Record<string, unknown>) => h('input', { ...field, type: 'text' }),
            },
          ),
          ...[0, 1, 2].map((index) =>
            h(
              FormField,
              {
                id: `key-network-${index}`,
                label: `Network ${index + 1}`,
                errors: form.errorsFor(`allowedNetworks.${index}`),
              },
              { default: (field: Record<string, unknown>) => h('input', field) },
            ),
          ),
          h(LiveAnnouncer),
        ])
    },
  })
  const wrapper = mountWithApp(Host, { attachTo: document.body })
  return { wrapper, form: () => form }
}

describe('useProblemForm', () => {
  it('can render and announce a delayed refusal without stealing intentional focus', async () => {
    const { wrapper, form } = mountForm()
    const outside = document.createElement('button')
    document.body.append(outside)
    outside.focus()
    try {
      await form().setProblem(validationProblem({ name: [violation('required')] }), {
        focus: false,
      })
      expect(wrapper.get('#key-name-error').text()).toContain('This field is required.')
      expect(document.activeElement).toBe(outside)
      await new Promise((resolve) => setTimeout(resolve, 60))
      expect(wrapper.get('[data-live="assertive"]').text()).toContain('This field is required.')
    } finally {
      wrapper.unmount()
      outside.remove()
    }
  })

  it('maps field errors by their dot path, including list entries', async () => {
    const { wrapper, form } = mountForm()
    await form().setProblem(
      validationProblem({
        name: [violation('tooLong', { max: 255 })],
        'allowedNetworks.2': [violation('invalidFormat', { format: 'ipNetwork' })],
      }),
    )
    await flushPromises()
    expect(form().errorsFor('name')).toEqual(['Enter at most 255 characters.'])
    expect(form().errorsFor('allowedNetworks.2')[0]).toContain('IPv4 or IPv6')
    expect(form().errorsFor('allowedNetworks.0')).toEqual([])
    expect(wrapper.get('#key-network-2-error').text()).toContain('IPv4 or IPv6')
    wrapper.unmount()
  })

  it('marks fields with aria-invalid and aria-describedby', async () => {
    const { wrapper, form } = mountForm()
    await form().setProblem(validationProblem({ name: [violation('required')] }))
    await flushPromises()
    const input = wrapper.get('#key-name')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toContain('key-name-error')
    expect(wrapper.get('#key-name-error').text()).toBe('Error: This field is required.')
    expect(wrapper.get('#key-network-0').attributes('aria-invalid')).toBeUndefined()
    wrapper.unmount()
  })

  it('shows a summary with in-page links when there is more than one error, and focuses it', async () => {
    const { wrapper, form } = mountForm()
    await form().setProblem(
      validationProblem({
        name: [violation('required')],
        'allowedNetworks.1': [violation('invalidFormat', { format: 'ipNetwork' })],
      }),
    )
    await flushPromises()
    const summary = wrapper.get(`#${form().summaryId}`)
    const links = summary.findAll('a')
    expect(links.map((link) => link.attributes('href'))).toEqual(['#key-name', '#key-network-1'])
    expect(document.activeElement).toBe(summary.element)
    await links[1]!.trigger('click')
    expect(document.activeElement).toBe(wrapper.get('#key-network-1').element)
    wrapper.unmount()
  })

  it('focuses the field when there is a single error, without a summary', async () => {
    const { wrapper, form } = mountForm()
    await form().setProblem(validationProblem({ name: [violation('required')] }))
    await flushPromises()
    expect(wrapper.find(`#${form().summaryId}`).exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('#key-name').element)
    wrapper.unmount()
  })

  it('accepts client-side errors (data-model §6) and clears them', async () => {
    const { wrapper, form } = mountForm()
    await form().setClientErrors({ name: ['validation.required'] })
    await flushPromises()
    expect(form().errorsFor('name')).toEqual(['This field is required.'])
    form().clear()
    await nextTick()
    expect(form().errorsFor('name')).toEqual([])
    expect(wrapper.get('#key-name').attributes('aria-invalid')).toBeUndefined()
    wrapper.unmount()
  })

  it('shows a non-field problem as a form message and announces it', async () => {
    const { wrapper, form } = mountForm()
    await form().setProblem(
      ApiProblem.fromParts({
        kind: 'problem',
        type: '/api/v2/problems/forbidden',
        status: 403,
        requestId: 'a'.repeat(32),
      }),
    )
    await flushPromises()
    // The classic interface's message of the same meaning (`danger.access_denied`).
    expect(wrapper.get('[role="alert"]').text()).toContain('Access denied or invalid form data')
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(wrapper.get('[data-live="assertive"]').text()).toContain(
      'Access denied or invalid form data',
    )
    wrapper.unmount()
  })

  it('announces the number of errors through the summary', async () => {
    const { wrapper, form } = mountForm()
    await form().setProblem(
      validationProblem({
        name: [violation('required')],
        'allowedNetworks.0': [violation('required')],
      }),
    )
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(wrapper.get('[data-live="assertive"]').text()).toContain('Please correct the following')
    wrapper.unmount()
  })
})

describe('ProblemMessage', () => {
  it('shows the generic message with the request ID for unknown problems (FR-077)', () => {
    const problem = ApiProblem.fromParts({
      kind: 'problem',
      type: '/api/v2/problems/some-later-type',
      status: 418,
      requestId: '0123456789abcdef0123456789abcdef',
      title: 'English title',
    })
    const wrapper = mountWithApp(ProblemMessage, { props: { problem, retry: true } })
    expect(wrapper.text()).toContain('An unknown error occurred')
    expect(wrapper.text()).toContain('Request ID: 0123456789abcdef0123456789abcdef')
    expect(wrapper.text()).not.toContain('English title')
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  })

  it('offers a retry and shows no request ID for a known problem', async () => {
    const problem = ApiProblem.fromParts({ kind: 'network' })
    const wrapper = mountWithApp(ProblemMessage, { props: { problem, retry: true } })
    expect(wrapper.text()).toContain('The server could not be reached')
    expect(wrapper.text()).not.toContain('Request ID')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('renders nothing without a problem', () => {
    const wrapper = mountWithApp(ProblemMessage, { props: { problem: null } })
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
})
