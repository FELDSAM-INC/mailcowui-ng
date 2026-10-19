// How the mail queue presents its values, as legacy's `js/site/queue.js` does (plan "Legacy form
// map", FR-051): each recipient as "address (reason)".
import type { MailQueueRecipient } from '@/api'

export function recipientText(recipient: MailQueueRecipient): string {
  return recipient.deferralReason
    ? `${recipient.address} (${recipient.deferralReason})`
    : recipient.address
}
