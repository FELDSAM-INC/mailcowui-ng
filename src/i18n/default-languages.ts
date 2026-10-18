// mailcow's default language menu, `$AVAILABLE_LANGUAGES` of `data/web/inc/vars.inc.php` at the
// upstream baseline 2026-09a, with the menu's own labels (FR-003, research R15). The app offers
// these only when the public configuration, which carries the installation's menu, cannot be
// loaded. It is a lazy chunk: the start sequence imports it only then.
import type { Language } from '@/api'

export const DEFAULT_LANGUAGES: readonly Language[] = [
  { code: 'bg-bg', name: 'Български (Bulgarian)' },
  { code: 'cs-cz', name: 'Čeština (Czech)' },
  { code: 'da-dk', name: 'Dansk (Danish)' },
  { code: 'de-de', name: 'Deutsch (German)' },
  { code: 'en-gb', name: 'English' },
  { code: 'es-es', name: 'Español (Spanish)' },
  { code: 'fi-fi', name: 'Suomi (Finish)' },
  { code: 'fr-fr', name: 'Français (French)' },
  { code: 'gr-gr', name: 'Ελληνικά (Greek)' },
  { code: 'hu-hu', name: 'Magyar (Hungarian)' },
  { code: 'it-it', name: 'Italiano (Italian)' },
  { code: 'ja-jp', name: '日本語 (Japanese)' },
  { code: 'ko-kr', name: '한국어 (Korean)' },
  { code: 'lv-lv', name: 'latviešu (Latvian)' },
  { code: 'lt-lt', name: 'Lietuvių (Lithuanian)' },
  { code: 'nb-no', name: 'Norsk (Norwegian)' },
  { code: 'nl-nl', name: 'Nederlands (Dutch)' },
  { code: 'pl-pl', name: 'Język Polski (Polish)' },
  { code: 'pt-br', name: 'Português brasileiro (Brazilian Portuguese)' },
  { code: 'pt-pt', name: 'Português (Portuguese)' },
  { code: 'ro-ro', name: 'Română (Romanian)' },
  { code: 'ru-ru', name: 'Pусский (Russian)' },
  { code: 'si-si', name: 'Slovenščina (Slovenian)' },
  { code: 'sk-sk', name: 'Slovenčina (Slovak)' },
  { code: 'sv-se', name: 'Svenska (Swedish)' },
  { code: 'tr-tr', name: 'Türkçe (Turkish)' },
  { code: 'uk-ua', name: 'Українська (Ukrainian)' },
  { code: 'uz-uz', name: 'Oʻzbekcha (Uzbek)' },
  { code: 'vi-vn', name: 'Tiếng Việt (Vietnamese)' },
  { code: 'zh-cn', name: '简体中文 (Simplified Chinese)' },
  { code: 'zh-tw', name: '繁體中文 (Traditional Chinese)' },
]
