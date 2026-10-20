// Read a real reset message from the isolated stack's Mailpit. This keeps the browser runner
// independent of Docker and exercises delivery as well as the reset API. Never print the link.
import { expect, type APIRequestContext } from '@playwright/test'

interface MailpitMessage {
  ID: string
  To: { Address: string }[]
}

export async function resetLink(
  request: APIRequestContext,
  recipient: string,
  baseURL: string,
): Promise<string> {
  const mailpit = `http://127.0.0.1:${process.env.SMOKE_MAILPIT_PORT ?? '18425'}`
  let message: MailpitMessage | undefined
  await expect
    .poll(
      async () => {
        const response = await request.get(`${mailpit}/api/v1/messages`)
        expect(response.status(), 'Read the local mail sink').toBe(200)
        const { messages } = (await response.json()) as { messages: MailpitMessage[] }
        message = messages.find((item) => item.To.some((to) => to.Address === recipient))
        return message !== undefined
      },
      { timeout: 15_000, message: 'The recovery address receives a reset message' },
    )
    .toBe(true)
  const response = await request.get(`${mailpit}/api/v1/message/${message!.ID}`)
  expect(response.status()).toBe(200)
  const body = (await response.json()) as { Text: string }
  const link = body.Text.match(/https:\/\/[^\s<>]+\/ng\/reset-password[^\s<>]*/)?.[0]
  expect(Boolean(link), 'The message includes the app reset link').toBe(true)
  const url = new URL(link!)
  // mailcow's link builder omits the isolated dev stack's published port. Preserve its complete
  // path and token while opening it on that stack's origin.
  return new URL(`${url.pathname}${url.search}${url.hash}`, baseURL).href
}
