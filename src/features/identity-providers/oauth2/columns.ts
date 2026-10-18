// The column titles of the classic OAuth2 list (`js/site/admin.js` draw_oauth2_clients): "ID"
// (hard-coded there, a new string here), `admin.oauth2_client_id` and `admin.oauth2_redirect_uri`.
// They also name the sort options.
import { legacy, type TextRef } from '@/i18n'

import type { Oauth2ClientSort } from './list-state'

export const SORT_LABELS: Record<Oauth2ClientSort, TextRef> = {
  id: 'oauth2.columns.id',
  clientId: legacy('admin.oauth2_client_id'),
  redirectUri: legacy('admin.oauth2_redirect_uri'),
}
