import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { ESLint } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'

// Exercise the repository configuration, with type-aware rules disabled for the tiny fixtures.
const eslint = new ESLint({
  overrideConfig: [
    tseslint.configs.disableTypeChecked,
    { rules: { '@typescript-eslint/consistent-type-imports': 'off' } },
  ],
})
const safetyRules = new Set([
  'no-restricted-properties',
  'no-restricted-syntax',
  'vue/no-restricted-syntax',
  'vue/no-v-html',
])

async function violations(source: string, filePath = 'src/main.ts') {
  const [result] = await eslint.lintText(source, { filePath })
  expect(result?.messages.filter((message) => message.fatal)).toEqual([])
  return result?.messages.filter((message) => safetyRules.has(message.ruleId ?? '')) ?? []
}

describe('HTML rendering restrictions', () => {
  it.each([
    'frame.srcdoc = html',
    "frame['srcdoc'] = html",
    'const { srcdoc } = frame',
    "frame.setAttribute('srcdoc', html)",
    "frame['setAttribute']('SRCDOC', html)",
    'const props = { srcdoc: html }',
    'document.write(html)',
    "document['writeln'](html)",
    'window.document.write(html)',
    "window['document']['write'](html)",
    'frame.contentDocument.write(html)',
    'element.ownerDocument.writeln(html)',
  ])('rejects %s', async (source) => {
    expect(await violations(source)).not.toHaveLength(0)
  })

  it.each([
    '<iframe srcdoc="unsafe" />',
    '<iframe :srcdoc="html" />',
    '<iframe v-bind:srcdoc="html" />',
    '<div v-html="html" />',
  ])('rejects template injection: %s', async (template) => {
    expect(
      await violations(`<template>${template}</template>`, 'src/app/App.vue'),
    ).not.toHaveLength(0)
  })

  it('permits DOM text construction for the sandboxed email preview', async () => {
    expect(
      await violations(
        "const paragraph = document.createElement('p'); paragraph.textContent = html; frame.contentDocument.body.append(paragraph)",
      ),
    ).toEqual([])
  })

  it.each([
    'public/theme-init.js',
    'scripts/check-bundle-budget.mjs',
    'tests/unit/example.spec.ts',
  ])('also rejects document writes outside application components: %s', async (filePath) => {
    expect(await violations('document.write(html)', filePath)).not.toHaveLength(0)
  })

  it('keeps v-html confined to the sanitizing component', async () => {
    const files = readdirSync('src', { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.vue'))
      .filter((file) => /\bv-html\s*=/.test(readFileSync(resolve('src', file), 'utf8')))
    expect(files).toEqual(['shared/components/SanitizedHtml.vue'])
    expect(
      await violations(
        readFileSync('src/shared/components/SanitizedHtml.vue', 'utf8'),
        'src/shared/components/SanitizedHtml.vue',
      ),
    ).toEqual([])
  })
})
