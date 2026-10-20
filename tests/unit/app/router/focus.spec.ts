// Focus after navigation (FR-080): the page heading, or a field the page marks with
// `data-autofocus` (the single code field of US1-AS4), or `<main>`.
import { describe, expect, it, vi } from 'vitest'

import { focusPageHeading, focusPageHeadingWhenReady } from '@/app/router/focus'

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

describe('focus after an identity transition', () => {
  it('focuses a heading that appears after the new account query finishes', async () => {
    document.body.innerHTML = '<main id="main" tabindex="-1"><p role="status">Loading</p></main>'
    const stop = focusPageHeadingWhenReady()
    expect(document.activeElement?.id).toBe('main')
    document.querySelector('main')!.innerHTML = '<h1>New account</h1>'
    await vi.waitFor(() => expect(document.activeElement).toBe(document.querySelector('h1')))
    stop()
  })
  it('does not take focus back after the user moves to another control', async () => {
    document.body.innerHTML =
      '<button id="menu">Menu</button><main tabindex="-1"><p>Loading</p></main>'
    const stop = focusPageHeadingWhenReady()
    document.querySelector<HTMLButtonElement>('#menu')!.focus()
    document.querySelector('main')!.innerHTML = '<h1>New account</h1>'
    await Promise.resolve()
    expect(document.activeElement?.id).toBe('menu')
    stop()
  })
  it('stops waiting when the identity transition is superseded by navigation', async () => {
    document.body.innerHTML = '<main id="main" tabindex="-1"><p>Loading</p></main>'
    const stop = focusPageHeadingWhenReady()
    stop()
    document.querySelector('main')!.innerHTML = '<h1>Another page</h1>'
    await Promise.resolve()
    expect(document.activeElement?.id).toBe('main')
  })
})
