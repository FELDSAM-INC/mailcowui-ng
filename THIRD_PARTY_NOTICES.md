# Third-party notices

mailcowui-ng is licensed under the GPL-3.0. It contains code copied from the projects below,
under their own permissive licences, which are compatible with the GPL-3.0. Runtime and build
dependencies installed through npm keep their own licence files in `node_modules/` and are
checked by `npm run licenses:check`.

## TailAdmin Vue Free (MIT)

- **Repository**: https://github.com/TailAdmin/vue-tailwind-admin-dashboard
- **Version**: 2.5.0
- **Commit**: `94ebe1bce19fa51eb4225cc981ee1265b6bdf567`
- **Licence**: MIT (full text below)

TailAdmin is a template, not a dependency (constitution 1.2.0). Only the files listed here are
copied. No TailAdmin Pro code or asset is used. Every copied file starts with the comment
`Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md.`

### Copied files

| File in this repository | Source path in TailAdmin |
|---|---|
| `src/shared/ui/alert/Alert.vue` | `src/components/ui/alert/Alert.vue` |
| `src/shared/ui/alert/AlertAction.vue` | `src/components/ui/alert/AlertAction.vue` |
| `src/shared/ui/alert/AlertDescription.vue` | `src/components/ui/alert/AlertDescription.vue` |
| `src/shared/ui/alert/AlertTitle.vue` | `src/components/ui/alert/AlertTitle.vue` |
| `src/shared/ui/alert/index.ts` | `src/components/ui/alert/index.ts` |
| `src/shared/ui/alert/variants.ts` | `src/components/ui/alert/variants.ts` |
| `src/shared/ui/badge/Badge.vue` | `src/components/ui/badge/Badge.vue` |
| `src/shared/ui/badge/index.ts` | `src/components/ui/badge/index.ts` |
| `src/shared/ui/button/Button.vue` | `src/components/ui/button/Button.vue` |
| `src/shared/ui/button/index.ts` | `src/components/ui/button/index.ts` |
| `src/shared/ui/button/variants.ts` | `src/components/ui/button/variants.ts` |
| `src/shared/ui/card/Card.vue` | `src/components/ui/card/Card.vue` |
| `src/shared/ui/card/CardAction.vue` | `src/components/ui/card/CardAction.vue` |
| `src/shared/ui/card/CardContent.vue` | `src/components/ui/card/CardContent.vue` |
| `src/shared/ui/card/CardDescription.vue` | `src/components/ui/card/CardDescription.vue` |
| `src/shared/ui/card/CardFooter.vue` | `src/components/ui/card/CardFooter.vue` |
| `src/shared/ui/card/CardHeader.vue` | `src/components/ui/card/CardHeader.vue` |
| `src/shared/ui/card/CardTitle.vue` | `src/components/ui/card/CardTitle.vue` |
| `src/shared/ui/card/index.ts` | `src/components/ui/card/index.ts` |
| `src/shared/ui/checkbox/Checkbox.vue` | `src/components/ui/checkbox/Checkbox.vue` |
| `src/shared/ui/checkbox/index.ts` | `src/components/ui/checkbox/index.ts` |
| `src/shared/ui/collapsible/Collapsible.vue` | `src/components/ui/collapsible/Collapsible.vue` |
| `src/shared/ui/collapsible/CollapsibleContent.vue` | `src/components/ui/collapsible/CollapsibleContent.vue` |
| `src/shared/ui/collapsible/CollapsibleTrigger.vue` | `src/components/ui/collapsible/CollapsibleTrigger.vue` |
| `src/shared/ui/collapsible/index.ts` | `src/components/ui/collapsible/index.ts` |
| `src/shared/ui/combobox/Combobox.vue` | `src/components/ui/combobox/Combobox.vue` |
| `src/shared/ui/combobox/ComboboxAnchor.vue` | `src/components/ui/combobox/ComboboxAnchor.vue` |
| `src/shared/ui/combobox/ComboboxChip.vue` | `src/components/ui/combobox/ComboboxChip.vue` |
| `src/shared/ui/combobox/ComboboxChips.vue` | `src/components/ui/combobox/ComboboxChips.vue` |
| `src/shared/ui/combobox/ComboboxChipsInput.vue` | `src/components/ui/combobox/ComboboxChipsInput.vue` |
| `src/shared/ui/combobox/ComboboxClear.vue` | `src/components/ui/combobox/ComboboxClear.vue` |
| `src/shared/ui/combobox/ComboboxContent.vue` | `src/components/ui/combobox/ComboboxContent.vue` |
| `src/shared/ui/combobox/ComboboxEmpty.vue` | `src/components/ui/combobox/ComboboxEmpty.vue` |
| `src/shared/ui/combobox/ComboboxGroup.vue` | `src/components/ui/combobox/ComboboxGroup.vue` |
| `src/shared/ui/combobox/ComboboxInput.vue` | `src/components/ui/combobox/ComboboxInput.vue` |
| `src/shared/ui/combobox/ComboboxItem.vue` | `src/components/ui/combobox/ComboboxItem.vue` |
| `src/shared/ui/combobox/ComboboxItemIndicator.vue` | `src/components/ui/combobox/ComboboxItemIndicator.vue` |
| `src/shared/ui/combobox/ComboboxLabel.vue` | `src/components/ui/combobox/ComboboxLabel.vue` |
| `src/shared/ui/combobox/ComboboxPortal.vue` | `src/components/ui/combobox/ComboboxPortal.vue` |
| `src/shared/ui/combobox/ComboboxSeparator.vue` | `src/components/ui/combobox/ComboboxSeparator.vue` |
| `src/shared/ui/combobox/ComboboxTrigger.vue` | `src/components/ui/combobox/ComboboxTrigger.vue` |
| `src/shared/ui/combobox/ComboboxValue.vue` | `src/components/ui/combobox/ComboboxValue.vue` |
| `src/shared/ui/combobox/index.ts` | `src/components/ui/combobox/index.ts` |
| `src/shared/ui/dialog/Dialog.vue` | `src/components/ui/dialog/Dialog.vue` |
| `src/shared/ui/dialog/DialogClose.vue` | `src/components/ui/dialog/DialogClose.vue` |
| `src/shared/ui/dialog/DialogContent.vue` | `src/components/ui/dialog/DialogContent.vue` |
| `src/shared/ui/dialog/DialogDescription.vue` | `src/components/ui/dialog/DialogDescription.vue` |
| `src/shared/ui/dialog/DialogFooter.vue` | `src/components/ui/dialog/DialogFooter.vue` |
| `src/shared/ui/dialog/DialogHeader.vue` | `src/components/ui/dialog/DialogHeader.vue` |
| `src/shared/ui/dialog/DialogOverlay.vue` | `src/components/ui/dialog/DialogOverlay.vue` |
| `src/shared/ui/dialog/DialogPortal.vue` | `src/components/ui/dialog/DialogPortal.vue` |
| `src/shared/ui/dialog/DialogTitle.vue` | `src/components/ui/dialog/DialogTitle.vue` |
| `src/shared/ui/dialog/DialogTrigger.vue` | `src/components/ui/dialog/DialogTrigger.vue` |
| `src/shared/ui/dialog/index.ts` | `src/components/ui/dialog/index.ts` |
| `src/shared/ui/dropdown-menu/DropdownMenu.vue` | `src/components/ui/dropdown-menu/DropdownMenu.vue` |
| `src/shared/ui/dropdown-menu/DropdownMenuCheckboxItem.vue` | `src/components/ui/dropdown-menu/DropdownMenuCheckboxItem.vue` |
| `src/shared/ui/dropdown-menu/DropdownMenuContent.vue` | `src/components/ui/dropdown-menu/DropdownMenuContent.vue` |
| `src/shared/ui/dropdown-menu/DropdownMenuGroup.vue` | `src/components/ui/dropdown-menu/DropdownMenuGroup.vue` |
| `src/shared/ui/dropdown-menu/DropdownMenuItem.vue` | `src/components/ui/dropdown-menu/DropdownMenuItem.vue` |
| `src/shared/ui/dropdown-menu/DropdownMenuLabel.vue` | `src/components/ui/dropdown-menu/DropdownMenuLabel.vue` |
| `src/shared/ui/dropdown-menu/DropdownMenuPortal.vue` | `src/components/ui/dropdown-menu/DropdownMenuPortal.vue` |
| `src/shared/ui/dropdown-menu/DropdownMenuRadioGroup.vue` | `src/components/ui/dropdown-menu/DropdownMenuRadioGroup.vue` |
| `src/shared/ui/dropdown-menu/DropdownMenuRadioItem.vue` | `src/components/ui/dropdown-menu/DropdownMenuRadioItem.vue` |
| `src/shared/ui/dropdown-menu/DropdownMenuSeparator.vue` | `src/components/ui/dropdown-menu/DropdownMenuSeparator.vue` |
| `src/shared/ui/dropdown-menu/DropdownMenuShortcut.vue` | `src/components/ui/dropdown-menu/DropdownMenuShortcut.vue` |
| `src/shared/ui/dropdown-menu/DropdownMenuSub.vue` | `src/components/ui/dropdown-menu/DropdownMenuSub.vue` |
| `src/shared/ui/dropdown-menu/DropdownMenuSubContent.vue` | `src/components/ui/dropdown-menu/DropdownMenuSubContent.vue` |
| `src/shared/ui/dropdown-menu/DropdownMenuSubTrigger.vue` | `src/components/ui/dropdown-menu/DropdownMenuSubTrigger.vue` |
| `src/shared/ui/dropdown-menu/DropdownMenuTrigger.vue` | `src/components/ui/dropdown-menu/DropdownMenuTrigger.vue` |
| `src/shared/ui/dropdown-menu/index.ts` | `src/components/ui/dropdown-menu/index.ts` |
| `src/shared/ui/field/Field.vue` | `src/components/ui/field/Field.vue` |
| `src/shared/ui/field/FieldContent.vue` | `src/components/ui/field/FieldContent.vue` |
| `src/shared/ui/field/FieldDescription.vue` | `src/components/ui/field/FieldDescription.vue` |
| `src/shared/ui/field/FieldError.vue` | `src/components/ui/field/FieldError.vue` |
| `src/shared/ui/field/FieldGroup.vue` | `src/components/ui/field/FieldGroup.vue` |
| `src/shared/ui/field/FieldLabel.vue` | `src/components/ui/field/FieldLabel.vue` |
| `src/shared/ui/field/FieldTitle.vue` | `src/components/ui/field/FieldTitle.vue` |
| `src/shared/ui/field/index.ts` | `src/components/ui/field/index.ts` |
| `src/shared/ui/input/Input.vue` | `src/components/ui/input/Input.vue` |
| `src/shared/ui/input/index.ts` | `src/components/ui/input/index.ts` |
| `src/shared/ui/input-group/InputGroup.vue` | `src/components/ui/input-group/InputGroup.vue` |
| `src/shared/ui/input-group/InputGroupAddon.vue` | `src/components/ui/input-group/InputGroupAddon.vue` |
| `src/shared/ui/input-group/InputGroupButton.vue` | `src/components/ui/input-group/InputGroupButton.vue` |
| `src/shared/ui/input-group/InputGroupInput.vue` | `src/components/ui/input-group/InputGroupInput.vue` |
| `src/shared/ui/input-group/InputGroupText.vue` | `src/components/ui/input-group/InputGroupText.vue` |
| `src/shared/ui/input-group/InputGroupTextarea.vue` | `src/components/ui/input-group/InputGroupTextarea.vue` |
| `src/shared/ui/input-group/index.ts` | `src/components/ui/input-group/index.ts` |
| `src/shared/ui/label/Label.vue` | `src/components/ui/label/Label.vue` |
| `src/shared/ui/label/index.ts` | `src/components/ui/label/index.ts` |
| `src/shared/ui/pagination/Pagination.vue` | `src/components/ui/pagination/Pagination.vue` |
| `src/shared/ui/pagination/PaginationContent.vue` | `src/components/ui/pagination/PaginationContent.vue` |
| `src/shared/ui/pagination/PaginationEllipsis.vue` | `src/components/ui/pagination/PaginationEllipsis.vue` |
| `src/shared/ui/pagination/PaginationItem.vue` | `src/components/ui/pagination/PaginationItem.vue` |
| `src/shared/ui/pagination/PaginationLink.vue` | `src/components/ui/pagination/PaginationLink.vue` |
| `src/shared/ui/pagination/PaginationNext.vue` | `src/components/ui/pagination/PaginationNext.vue` |
| `src/shared/ui/pagination/PaginationPrevious.vue` | `src/components/ui/pagination/PaginationPrevious.vue` |
| `src/shared/ui/pagination/index.ts` | `src/components/ui/pagination/index.ts` |
| `src/shared/ui/radio-group/RadioGroup.vue` | `src/components/ui/radio-group/RadioGroup.vue` |
| `src/shared/ui/radio-group/RadioGroupItem.vue` | `src/components/ui/radio-group/RadioGroupItem.vue` |
| `src/shared/ui/radio-group/index.ts` | `src/components/ui/radio-group/index.ts` |
| `src/shared/ui/switch/Switch.vue` | `src/components/ui/switch/Switch.vue` |
| `src/shared/ui/switch/index.ts` | `src/components/ui/switch/index.ts` |
| `src/shared/ui/table/Table.vue` | `src/components/ui/table/Table.vue` |
| `src/shared/ui/table/TableBody.vue` | `src/components/ui/table/TableBody.vue` |
| `src/shared/ui/table/TableCell.vue` | `src/components/ui/table/TableCell.vue` |
| `src/shared/ui/table/TableHeader.vue` | `src/components/ui/table/TableHeader.vue` |
| `src/shared/ui/table/TableRow.vue` | `src/components/ui/table/TableRow.vue` |
| `src/shared/ui/table/index.ts` | `src/components/ui/table/index.ts` |
| `src/shared/ui/textarea/Textarea.vue` | `src/components/ui/textarea/Textarea.vue` |
| `src/shared/ui/textarea/index.ts` | `src/components/ui/textarea/index.ts` |
| `src/shared/ui/utils/cn.ts` | `src/utils/cn.ts` |
| `src/shared/ui/utils/focusOnOpen.ts` | `src/utils/focusOnOpen.ts` |
| `src/shared/icons/MenuIcon.vue` | TailAdmin `src/icons/layout/MenuIcon.vue` |
| `src/shared/icons/CloseIcon.vue` | TailAdmin `src/icons/layout/XIcon.vue` |
| `src/shared/icons/ChevronDownIcon.vue` | TailAdmin `src/icons/layout/ChevronDownIcon.vue` |
| `src/shared/icons/ChevronLeftIcon.vue` | TailAdmin `src/icons/layout/ChevronLeftIcon.vue` |
| `src/shared/icons/ChevronRightIcon.vue` | TailAdmin `src/icons/layout/ChevronRightIcon.vue` |
| `src/shared/icons/HorizontalDotsIcon.vue` | TailAdmin `src/icons/layout/HorizontalDotsIcon.vue` |
| `src/shared/icons/KeyIcon.vue` | TailAdmin `src/icons/layout/KeyIcon.vue` |
| `src/shared/icons/ListIcon.vue` | TailAdmin `src/icons/layout/ListIcon.vue` |
| `src/shared/icons/UserIcon.vue` | TailAdmin `src/icons/layout/UserIcon.vue` |
| `src/shared/icons/SignOutIcon.vue` | TailAdmin `src/icons/layout/LogOutIcon.vue` |
| `src/shared/icons/SunIcon.vue` | TailAdmin `src/icons/layout/SunIcon.vue` |
| `src/shared/icons/MoonIcon.vue` | TailAdmin `src/icons/layout/MoonIcon.vue` |
| `src/shared/icons/CopyIcon.vue` | TailAdmin `src/icons/layout/CopyIcon.vue` |
| `src/shared/icons/CheckIcon.vue` | TailAdmin `src/icons/layout/CheckIcon.vue` |
| `src/shared/icons/InfoIcon.vue` | TailAdmin `src/icons/layout/InfoIcon.vue` |
| `src/shared/icons/WarningIcon.vue` | TailAdmin `src/icons/layout/AlertIcon.vue` |
| `src/shared/icons/DangerIcon.vue` | TailAdmin `src/icons/layout/OctagonAlertIcon.vue` |
| `src/shared/icons/EyeIcon.vue` | TailAdmin `src/icons/layout/EyeIcon.vue` |
| `src/shared/icons/EyeOffIcon.vue` | TailAdmin `src/icons/layout/EyeCloseIcon.vue` |
| `src/shared/icons/GlobeIcon.vue` | TailAdmin `src/icons/layout/GlobeIcon.vue` |
| `src/shared/icons/MailIcon.vue` | TailAdmin `src/icons/layout/MailIcon.vue` |
| `src/shared/icons/UserCircleIcon.vue` | TailAdmin `src/icons/layout/UserCircleIcon.vue` |
| `src/shared/icons/ArchiveIcon.vue` | TailAdmin `src/icons/layout/ArchiveIcon.vue` |
| `src/shared/icons/FilterIcon.vue` | TailAdmin `src/icons/layout/FilterIcon.vue` |
| `src/shared/icons/UsersIcon.vue` | TailAdmin `src/icons/layout/UsersIcon.vue` |
| `src/shared/icons/SyncIcon.vue` | TailAdmin `src/icons/layout/RegenerateIcon.vue` |
| `src/shared/icons/ArrowLeftRightIcon.vue` | TailAdmin `src/icons/layout/ArrowLeftRightIcon.vue` |
| `src/shared/icons/DatabaseIcon.vue` | TailAdmin `src/icons/layout/DatabaseIcon.vue` |
| `src/shared/icons/BarChartIcon.vue` | TailAdmin `src/icons/layout/BarChartIcon.vue` |
| `src/shared/icons/LockIcon.vue` | TailAdmin `src/icons/layout/LockIcon.vue` |
| `src/shared/icons/GearIcon.vue` | TailAdmin `src/icons/layout/GearIcon.vue` |

The layout shell (`src/app/layouts/` and `src/app/shell/`) and the theme in
`src/styles/main.css` are adapted from TailAdmin files; they are listed in the next section.

### Adapted files (layout reference and theme)

| File in this repository | Adapted from |
|---|---|
| `src/styles/main.css` | `src/assets/main.css` (`@theme` tokens, `@custom-variant` rules, menu component classes) |

### Deviations from the template

1. The Google Fonts `@import` of Outfit is removed. The app uses the system UI font stack
   (research R5).
2. Theme handling is replaced by `src/app/preferences/theme.ts` and `public/theme-init.js`.
   TailAdmin stores the theme in `localStorage` and only knows light and dark; this app needs
   `system` and profile sync (research R16).
3. RTL support is dropped (`useRTL` is not copied); the app has no RTL language.
4. `tailwind-merge` 3 replaces 2.x, because version 3 supports Tailwind v4.
5. Static `style="…"` attributes are removed (strict CSP, research R18).
6. Touch targets are raised to at least 44 × 44 px where the template uses `size-8`, `size-9`,
   `h-9` or `h-10` controls (constitution II, research R21): every `Button` size and the
   pagination ellipsis.

Further adaptations made while copying:

- Imports point to this repository's layout (`@/shared/ui/…`, `@/shared/ui/utils/…` and
  `@/shared/icons`). TailAdmin's `XIcon` is used as `CloseIcon`.
- `input/Input.vue` uses Vue's `defineModel` instead of TailAdmin's `useVModel` helper, which is
  not copied.
- `combobox/ComboboxContent.vue` renders a plain scrollable list instead of Reka's
  `ComboboxViewport`, which injects a `<style>` element that the strict CSP blocks (research
  R18).
- Hard-coded English labels ("Close", "Go to previous page", "More pages", …) come from the app's
  translations (constitution IV), and the redundant `role="navigation"` on the pagination `<nav>`
  is removed.
- Icon components get `aria-hidden="true"` and `focusable="false"` (research R5).
- The `destructive` button variant uses `red-700` (hover `red-800`) instead of `red-500`, so that
  its white text meets the WCAG AA contrast ratio (constitution III).

### MIT licence

```
MIT License

Copyright (c) 2026 TailAdmin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Lucide (ISC)

- **Repository**: https://github.com/lucide-icons/lucide
- **Package and version**: `lucide-static` 1.59.0 (SVG files copied, no package dependency)
- **Licence**: ISC (full text below)

Icons that TailAdmin does not offer are copied as inline SVG from Lucide. Each file starts with a
comment naming the Lucide icon.

| File in this repository | Source |
|---|---|
| `src/shared/icons/HomeIcon.vue` | Lucide `icons/house.svg` |
| `src/shared/icons/PasskeyIcon.vue` | Lucide `icons/fingerprint.svg` |
| `src/shared/icons/LanguageIcon.vue` | Lucide `icons/languages.svg` |
| `src/shared/icons/MonitorIcon.vue` | Lucide `icons/monitor.svg` |
| `src/shared/icons/ExternalLinkIcon.vue` | Lucide `icons/external-link.svg` |
| `src/shared/icons/LayoutTemplateIcon.vue` | Lucide `icons/layout-template.svg` |
| `src/shared/icons/AtSignIcon.vue` | Lucide `icons/at-sign.svg` |
| `src/shared/icons/ChevronDoubleLeftIcon.vue` | Lucide `icons/chevrons-left.svg` (UI 002) |
| `src/shared/icons/ChevronDoubleRightIcon.vue` | Lucide `icons/chevrons-right.svg` (UI 002) |
| `src/shared/icons/LayersIcon.vue` | Lucide `icons/layers.svg` (UI 002, domain templates) |
| `src/shared/icons/TagIcon.vue` | Lucide `icons/tag.svg` (UI 002) |
| `src/shared/icons/PlusIcon.vue` | Lucide `icons/plus.svg` (UI 002) |
| `src/shared/icons/TrashIcon.vue` | Lucide `icons/trash-2.svg` (UI 002) |

### ISC licence

```
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```
