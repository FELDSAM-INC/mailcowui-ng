import assert from 'node:assert/strict'
import { it } from 'node:test'

import { mockRedirect, mockRequestUrl } from './navigation'

const APP = 'http://localhost:4173/ng/'

void it('keeps local preview and development navigation', () => {
  assert.equal(mockRedirect(null, APP), APP)
  assert.equal(mockRedirect('/ng/login', APP), 'http://localhost:4173/ng/login')
  assert.equal(mockRedirect('http://127.0.0.1:5173/ng/', APP), 'http://127.0.0.1:5173/ng/')
  assert.equal(
    mockRedirect('https://preview.example/ng/', 'https://preview.example/ng/'),
    'https://preview.example/ng/',
  )
})

void it('rejects external origins, credential URLs, schemes, and authority tricks', () => {
  for (const target of [
    'https://attacker.example/',
    '//attacker.example/',
    '/\\attacker.example/',
    'javascript:alert(1)',
    'data:text/html,test',
    'http://localhost:4173@attacker.example/',
    'http://attacker@localhost:4173/ng/',
    'http://localhost.attacker.example:4173/',
    'http://localhost:9999/ng/',
    'http://[',
  ])
    assert.equal(mockRedirect(target, APP), null, target)
})

void it('parses origin-form request paths without trusting Host or accepting external authorities', () => {
  assert.equal(mockRequestUrl('/__mock/health')?.pathname, '/__mock/health')
  assert.equal(mockRequestUrl('/api/v2/me?q=1')?.search, '?q=1')
  for (const target of [
    undefined,
    'http://attacker.example/api/v2/me',
    '//attacker.example/',
    '/\\attacker.example/',
  ]) {
    assert.equal(mockRequestUrl(target), null)
  }
})
