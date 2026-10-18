// Types of scripts/i18n/lib.mjs, for the unit tests (tests/unit/scripts/i18n-tools.spec.ts).
export type Messages = { [key: string]: string | Messages }
export type Locale = 'en-gb' | 'cs-cz' | 'sk-sk'

export const LOCALES: readonly Locale[]
export const ENUM_NAMESPACES: Record<string, string>
export const DYNAMIC_NAMESPACES: readonly string[]

export function stripDecorations(value: string): string
export function escapeForVueI18n(value: string): string
export function convertLegacyValue(value: string): string
export function refusalReason(value: string): 'html' | 'fido2' | 'touch-id' | null
export function getPath(object: unknown, dotted: string): unknown
export function setPath(object: Messages, dotted: string, value: string): void
export function flatten(object: Messages | undefined): Map<string, unknown>
export function merge(a: Messages | undefined, b: Messages | undefined): Messages
export function buildLegacyLayer(
  legacyMap: Record<string, string>,
  legacySource: unknown,
): { layer: Messages; missing: string[] }
export function placeholders(message: unknown): string[]
export function problemNamesFromContract(text: string): string[]
export function enumValuesFromSchema(schemaTs: string): Record<string, string[]>
export function requiredKeys(input: {
  enums: Record<string, readonly string[]>
  problemNames: readonly string[]
}): string[]

export interface CheckInput {
  app: Record<Locale, Messages>
  legacy: Record<Locale, Messages>
  legacyMap: Record<string, string>
  required: string[]
  usedKeys?: Set<string>
}
export function checkMessages(input: CheckInput): { errors: string[]; warnings: string[] }
