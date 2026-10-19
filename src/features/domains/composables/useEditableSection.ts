// The wiring every editable section of the domain page shares (UI 002 research D11, FR-029 to
// FR-038): the form opened from the domain when the page opens the section, its dirty state, the
// client rules, the save with its outcomes, "Save again" and "Discard" after an outdated save, and
// the inline status that stays until the next action.
import { computed, ref, watch, type Ref } from 'vue'
import { lt } from '@/i18n'
import type { Domain, DomainCapabilities, DomainPatch } from '@/api'
import type { SectionCompanion, SectionStatus } from '@/shared/components/editable-section'
import { announce } from '@/shared/composables/useAnnouncer'

import type { ClientErrors } from '../form-rules'
import { buildPatch } from '../patch'
import type { EditableAttribute } from '../permissions'
import { useFieldDisplay } from '../section-format'
import { useClientErrors } from '@/shared/composables/useClientErrors'
import { useDomainSectionSave } from './useDomainSectionSave'

export interface SectionProps {
  domain: Domain
  editableFields: ReadonlySet<EditableAttribute>
  editing?: boolean
  editDisabledReason?: string | null
  capabilities?: DomainCapabilities
}

export interface SectionEmits {
  (event: 'edit'): void
  (event: 'close'): void
  (event: 'dirty', value: boolean): void
  (event: 'saved', domain: Domain): void
  (event: 'status', status: SectionStatus | null): void
}

export interface SectionSpec<F> {
  id: string
  fields: readonly EditableAttribute[]
  toForm: (domain: Domain) => F
  /** The form as domain values, for the patch of changed members. */
  toValues: (form: F) => Partial<Record<EditableAttribute, unknown>>
  validate?: (form: F, base: Domain) => ClientErrors
  /** A confirmation before sending, for example deactivating. */
  confirm?: (form: F, base: Domain) => Promise<boolean>
  /** Extra text after "saved", for example the groupware restart notice. */
  savedNote?: (before: Domain, saved: Domain) => string | undefined
  /** UI 009: a field saved through its own operation after the patch (the relayhost). */
  companion?: SectionCompanion
}

export function useEditableSection<F>(
  props: SectionProps,
  emit: SectionEmits,
  spec: SectionSpec<F>,
) {
  const display = useFieldDisplay()
  const translate = useClientErrors()
  const section = useDomainSectionSave({
    domain: () => props.domain,
    fields: spec.fields,
    fieldId: (path) => `section-${spec.id}-${path.split('.')[0]}`,
  })
  const form = ref(spec.toForm(props.domain)) as Ref<F>
  const status = ref<SectionStatus | null>(null)
  /** The version the form was opened with; the patch holds the user's changes against it. */
  let opened: Domain = props.domain

  const editable = computed(() => spec.fields.some((field) => props.editableFields.has(field)))
  const canEdit = (field: EditableAttribute) =>
    props.editableFields.has(field) && !section.refused.value.has(field)
  const canSave = computed(() => spec.fields.some((field) => canEdit(field)))

  function setStatus(next: SectionStatus | null) {
    status.value = next
    emit('status', next)
    if (next) announce(next.message)
  }

  watch(
    () => props.editing,
    (on) => {
      if (!on) return
      section.open()
      opened = section.base.value ?? props.domain
      form.value = spec.toForm(opened)
      spec.companion?.open()
      setStatus(null)
    },
    { immediate: true },
  )

  const dirty = computed(
    () =>
      !!props.editing &&
      !!section.base.value &&
      (JSON.stringify(form.value) !== JSON.stringify(spec.toForm(opened)) ||
        !!spec.companion?.dirty()),
  )
  watch(dirty, (value) => emit('dirty', value), { immediate: true })

  /** The user's changes only, so that "Save again" never sends back a value changed elsewhere. */
  function makePatch(): DomainPatch {
    const fields = spec.fields.filter((field) => canEdit(field))
    return buildPatch(
      opened as unknown as Record<string, unknown>,
      { ...opened, ...spec.toValues(form.value) },
      fields,
    ) as DomainPatch
  }

  /** UI 009: the companion saves after the patch; its own refusal keeps the section open. */
  async function withCompanion(outcome: string): Promise<string> {
    if (!spec.companion || (outcome !== 'saved' && outcome !== 'unchanged')) return outcome
    const companion = await spec.companion.save()
    if (companion === 'outdated' || companion === 'failed') {
      if (outcome === 'saved' && section.base.value) {
        opened = section.base.value
        emit('saved', section.base.value)
      }
      const failure = spec.companion.failure()
      if (failure) setStatus({ kind: 'error', message: failure })
      return 'companion'
    }
    return companion === 'saved' && outcome === 'unchanged' ? 'companionSaved' : outcome
  }

  function finish(outcome: string, before: Domain) {
    if (outcome === 'companionSaved') {
      setStatus({ kind: 'success', message: lt('success.domain_modified', before.name) })
      emit('dirty', false)
      emit('close')
    } else if (outcome === 'saved' && section.base.value) {
      const saved = section.base.value
      opened = saved
      form.value = spec.toForm(saved)
      const note = spec.savedNote?.(before, saved)
      setStatus({
        kind: 'success',
        message: [lt('success.domain_modified', saved.name), note].filter(Boolean).join(' '),
      })
      emit('dirty', false)
      emit('saved', saved)
      emit('close')
    } else if (outcome === 'unchanged') {
      emit('dirty', false)
      emit('close')
    }
  }

  async function save() {
    const base = section.base.value
    if (!base) return
    const errors = spec.validate?.(form.value, base) ?? {}
    if (Object.keys(errors).length > 0) {
      await section.form.setClientMessages(translate(errors))
      return
    }
    if (spec.confirm && !(await spec.confirm(form.value, base))) return
    finish(await withCompanion(await section.save(makePatch)), base)
  }

  async function saveAgain() {
    const base = section.base.value
    if (!base) return
    const outcome = section.outdatedFields.value
      ? await section.saveAgain(makePatch)
      : await section.save(makePatch)
    finish(await withCompanion(outcome), base)
  }

  function discard() {
    spec.companion?.discard()
    const latest = section.discard()
    if (latest) {
      opened = latest
      form.value = spec.toForm(latest)
    }
  }

  return {
    section,
    form,
    status,
    editable,
    canEdit,
    canSave,
    dirty,
    outdated: computed(() => {
      const changes = display.changes(section.outdatedFields.value) ?? []
      const all = [...changes, ...(spec.companion?.outdated() ?? [])]
      return all.length > 0 ? all : null
    }),
    errorsFor: (path: string) => section.form.errorsFor(path),
    save,
    saveAgain,
    discard,
    cancel: () => emit('close'),
  }
}
