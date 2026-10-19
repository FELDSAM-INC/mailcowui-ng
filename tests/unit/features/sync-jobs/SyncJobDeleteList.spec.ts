// The list of jobs in a removal or deactivation dialog (UI 008 T070): each job's label and owner in
// a scrollable list with a name, legacy's lead-in for removals, the copied-mail note and the
// running note.
import { describe, expect, it } from 'vitest'

import SyncJobDeleteList from '@/features/sync-jobs/components/SyncJobDeleteList.vue'

import { mountWithApp } from '../../support/mount'

const jobs = [
  { id: 2, label: 'alice@mail.previous.example:993', mailbox: 'alice@example.org', running: false },
  { id: 4, label: 'user4@imap4.example:993', mailbox: 'dora@example.org', running: true },
]

describe('SyncJobDeleteList', () => {
  it("lists the jobs for a removal with legacy's lead-in and the notes", () => {
    const wrapper = mountWithApp(SyncJobDeleteList, {
      props: { jobs, kind: 'delete', showOwner: true },
    })
    expect(wrapper.text()).toContain('Please confirm your changes to the following object id')
    const list = wrapper.get('ul')
    expect(list.attributes('aria-label')).toBe('Selected sync jobs')
    expect(list.attributes('tabindex')).toBe('0')
    expect(wrapper.findAll('li')).toHaveLength(2)
    expect(wrapper.text()).toContain('alice@example.org')
    expect(wrapper.text()).toContain('Mail that was already copied stays in the mailbox.')
    expect(wrapper.text()).toContain(
      'The run in progress is not interrupted and finishes on its own.',
    )
  })

  it('says that deactivated jobs do not run, without the owner for mailbox users', () => {
    const wrapper = mountWithApp(SyncJobDeleteList, {
      props: { jobs: [jobs[0]!], kind: 'deactivate', showOwner: false },
    })
    expect(wrapper.text()).toContain('They do not run until they are activated again.')
    expect(wrapper.text()).not.toContain('alice@example.org')
    expect(wrapper.text()).not.toContain('finishes on its own')
  })
})
