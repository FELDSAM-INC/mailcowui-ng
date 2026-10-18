// Types of scripts/i18n/lib.mjs, for the unit tests (tests/unit/scripts/i18n-tools.spec.ts).
export type Messages = { [key: string]: string | Messages }
export type Locale = 'en-gb' | 'cs-cz' | 'sk-sk'

export const LOCALES: readonly Locale[]
export const ENUM_NAMESPACES: Record<string, string>
export const REQUIRED_FORMATS: readonly string[]
export const DYNAMIC_NAMESPACES: readonly string[]

export function getPath(object: unknown, dotted: string): unknown
export function flatten(object: Messages | undefined): Map<string, unknown>
export function placeholders(message: unknown): string[]
export function problemNamesFromContract(text: string): string[]
export function enumValuesFromSchema(schemaTs: string): Record<string, string[]>
export function requiredKeys(input: {
  enums: Record<string, readonly string[]>
  problemNames: readonly string[]
}): string[]
export const PARTIAL_ENUMS: Record<string, string>
export interface Coverage {
  partial?: Record<string, string[]>
  complete?: Record<string, string>
}
export function resolvePointer(document: unknown, pointer: string): unknown
export function checkCoverage(input: {
  coverage: Coverage
  enums: Record<string, readonly string[]>
  problemNames: readonly string[]
  contract: unknown
}): { required: string[]; errors: string[]; warnings: string[] }
export function legacyKeysInSource(text: string): string[]
export function legacyTextsFromSource(text: string): Record<string, string>
export function appKeysInSource(text: string, namespaces: readonly string[]): string[]

export interface CheckInput {
  app: Record<Locale, Messages>
  required: string[]
  snapshot: Messages
  legacyKeysUsed?: readonly string[]
  legacyTexts?: Record<string, string>
  appKeysUsed?: readonly string[]
  usedKeys?: Set<string>
}
export function checkMessages(input: CheckInput): { errors: string[]; warnings: string[] }

export interface LegacyDuplicate {
  key: string
  value: string
  legacyKeys: string[]
}
export function duplicateLegacyMeanings(appEn: Messages, snapshot: Messages): LegacyDuplicate[]
