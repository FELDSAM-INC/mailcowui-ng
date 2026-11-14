import { createServer, request } from 'node:http'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { BodyTooLargeError, MAX_BODY_BYTES, readBody } from './http-body'

const servers: ReturnType<typeof createServer>[] = []
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})

void describe('mock HTTP body limit', () => {
  async function listen() {
    const handled: number[] = []
    const server = createServer((req, res) => {
      void readBody(req).then(
        (body) => {
          handled.push(body.length)
          res.end(String(body.length))
        },
        (error: unknown) => {
          res.setHeader('Connection', 'close')
          res.once('finish', () => req.destroy())
          res.writeHead(error instanceof BodyTooLargeError ? 413 : 500)
          res.end()
        },
      )
    })
    servers.push(server)
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    return { port: (server.address() as AddressInfo).port, handled }
  }

  void it('accepts a body exactly at the byte limit', async () => {
    const { port, handled } = await listen()
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/test`, {
      method: 'POST',
      body: Buffer.alloc(MAX_BODY_BYTES, 'a'),
    })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), String(MAX_BODY_BYTES))
    assert.deepEqual(handled, [MAX_BODY_BYTES])
  })

  for (const path of ['/api/v2/test', '/__mock/scenarios']) {
    void it(`rejects a declared oversized body at ${path}`, async () => {
      const { port, handled } = await listen()
      const status = await new Promise<number | undefined>((resolve, reject) => {
        const req = request(
          {
            host: '127.0.0.1',
            port,
            path,
            method: 'POST',
            headers: { 'Content-Length': MAX_BODY_BYTES + 1 },
          },
          (res) => {
            res.resume()
            resolve(res.statusCode)
          },
        )
        req.on('error', reject)
        // A declared oversized body is rejected without waiting for its contents.
        req.flushHeaders()
      })
      assert.equal(status, 413)
      assert.deepEqual(handled, [])
    })
  }

  void it('limits chunked bodies and remains available after rejection', async () => {
    const { port, handled } = await listen()
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = request(
        { host: '127.0.0.1', port, path: '/api/v2/test', method: 'POST' },
        (res) => {
          res.resume()
          resolve(res.statusCode)
        },
      )
      req.on('error', reject)
      req.write(Buffer.alloc(MAX_BODY_BYTES, 'a'))
      req.end('b')
    })
    assert.equal(status, 413)
    assert.deepEqual(handled, [])
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/test`, {
      method: 'POST',
      body: 'ok',
    })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), '2')
    assert.deepEqual(handled, [2])
  })
})
