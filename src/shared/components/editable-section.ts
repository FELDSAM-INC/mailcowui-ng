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
