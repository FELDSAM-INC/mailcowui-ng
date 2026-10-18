// Focus after navigation (FR-080): the page heading, or a field the page marks with
// `data-autofocus` (the single code field of US1-AS4), or `<main>`.
import { describe, expect, it } from 'vitest'

import { focusPageHeading } from '@/app/router/focus'

describe('focusPageHeading', () => {
  it('focuses the h1 of main and makes it focusable', () => {
    document.body.innerHTML = '<main tabindex="-1"><h1>Title</h1></main>'
    focusPageHeading()
    const heading = document.querySelector('h1')!
    expect(document.activeElement).toBe(heading)
    expect(heading.getAttribute('tabindex')).toBe('-1')
  })

  it('prefers a field marked data-autofocus', () => {
    document.body.innerHTML =
      '<main><h1 tabindex="-1">Step</h1><input id="code" data-autofocus /></main>'
    focusPageHeading()
    expect(document.activeElement?.id).toBe('code')
  })

  it('falls back to main without a heading', () => {
    document.body.innerHTML = '<main id="main" tabindex="-1"><p>x</p></main>'
    focusPageHeading()
    expect(document.activeElement?.id).toBe('main')
  })
})
