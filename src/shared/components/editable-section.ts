// Types of EditableSection.vue, in a TypeScript module so that other modules can import them.

/** A field that changed elsewhere, with its new saved value (the outdated notice, FR-037). */
export interface SectionChange {
  field: string
  label: string
  saved: string
}

/** An inline status message of a section; it stays until the next action (FR-067). */
export interface SectionStatus {
  kind: 'success' | 'info' | 'error'
  message: string
}

/**
 * UI 009: a field of a section that is saved through its own operation with its own version tag,
 * after the section's patch (the relayhost assignment of the domain and mailbox sections). The
 * section asks it whether it changed, saves it, lists what changed meanwhile, and discards it.
 */
export interface SectionCompanion {
  /** The section opened: read the stored value. */
  open(): void
  dirty(): boolean
  save(): Promise<'saved' | 'unchanged' | 'outdated' | 'failed'>
  /** What changed meanwhile after an outdated save. */
  outdated(): SectionChange[]
  /** "Discard my changes": take the stored value again. */
  discard(): void
  /** The refusal of the last save, shown as the section's status (the field may be hidden). */
  failure(): string | null
}

/**
 * UI 006: several companions of one section (the mailbox section's relayhost and quarantine
 * notifications), opened, saved, listed and discarded together. Each changed one is saved in turn,
 * also after another one's refusal; the outcome is the worst of theirs: `outdated` before `failed`
 * before `saved` before `unchanged`.
 */
export function combineCompanions(
  ...companions: (SectionCompanion | null | undefined)[]
): SectionCompanion {
  const all = companions.filter((item): item is SectionCompanion => !!item)
  const RANK = { unchanged: 0, saved: 1, failed: 2, outdated: 3 } as const
  return {
    open: () => all.forEach((item) => item.open()),
    dirty: () => all.some((item) => item.dirty()),
    async save() {
      let outcome: keyof typeof RANK = 'unchanged'
      for (const item of all) {
        if (!item.dirty()) continue
        const result = await item.save()
        if (RANK[result] > RANK[outcome]) outcome = result
      }
      return outcome
    },
    outdated: () => all.flatMap((item) => item.outdated()),
    discard: () => all.forEach((item) => item.discard()),
    failure: () =>
      all
        .map((item) => item.failure())
        .filter((text): text is string => !!text)
        .join(' ') || null,
  }
}
