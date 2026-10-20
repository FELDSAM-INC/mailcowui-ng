import { queryOptions, type QueryClient } from '@tanstack/vue-query'
import {
  api,
  queryKeys,
  requireData,
  runMutation,
  type LogoSetting,
  type UiTextsPatch,
  type LoginPageSettingsPatch,
  type AppLinkSettingsPatch,
} from '@/api'

export function logoOptions(variant: LogoSetting['variant']) {
  return queryOptions({
    queryKey: queryKeys.systemSettings.logo(variant),
    staleTime: 30_000,
    queryFn: async ({ signal }) =>
      requireData(
        await api.GET('/settings/logos/{variant}', { params: { path: { variant } }, signal }),
      ).data,
  })
}
export function uiTextsOptions() {
  return queryOptions({
    queryKey: queryKeys.systemSettings.uiTexts(),
    staleTime: 30_000,
    queryFn: async ({ signal }) =>
      requireData(await api.GET('/settings/ui-texts', { signal })).data,
  })
}
export function invalidateBranding(client: QueryClient) {
  void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
  return client.invalidateQueries({ queryKey: queryKeys.publicConfig() })
}
export function replaceLogo(
  client: QueryClient,
  before: LogoSetting,
  file: Blob,
  mediaType: NonNullable<LogoSetting['mediaType']>,
) {
  return runMutation(
    client,
    {
      mutationFn: async () =>
        requireData(
          await api.PUT('/settings/logos/{variant}', {
            params: { path: { variant: before.variant }, header: { 'If-Match': before.etag } },
            // OpenAPI represents raw binary bodies as strings; the serializer sends the Blob unchanged.
            body: file as unknown as string,
            bodySerializer: () => file,
            headers: { 'Content-Type': mediaType },
          }),
        ).data,
      onSuccess: async (saved) => {
        client.setQueryData(queryKeys.systemSettings.logo(saved.variant), saved)
        await invalidateBranding(client)
      },
    },
    undefined,
  )
}
export function deleteLogo(client: QueryClient, before: LogoSetting) {
  return runMutation(
    client,
    {
      mutationFn: async () => {
        await api.DELETE('/settings/logos/{variant}', {
          params: { path: { variant: before.variant }, header: { 'If-Match': before.etag } },
        })
      },
      onSuccess: async () => {
        await Promise.all([
          client.invalidateQueries({ queryKey: queryKeys.systemSettings.logo(before.variant) }),
          invalidateBranding(client),
        ])
      },
    },
    undefined,
  )
}
export async function updateUiTexts(body: UiTextsPatch, ifMatch: string) {
  return requireData(
    await api.PATCH('/settings/ui-texts', {
      body,
      headers: { 'Content-Type': 'application/merge-patch+json', 'If-Match': ifMatch },
    }),
  ).data
}

export function loginPageOptions() {
  return queryOptions({
    queryKey: queryKeys.systemSettings.loginPage(),
    staleTime: 30_000,
    queryFn: async ({ signal }) =>
      requireData(await api.GET('/settings/login-page', { signal })).data,
  })
}
export function appLinksOptions() {
  return queryOptions({
    queryKey: queryKeys.systemSettings.appLinks(),
    staleTime: 30_000,
    queryFn: async ({ signal }) =>
      requireData(await api.GET('/settings/app-links', { signal })).data,
  })
}
export async function updateLoginPage(body: LoginPageSettingsPatch, ifMatch: string) {
  return requireData(
    await api.PATCH('/settings/login-page', {
      body,
      headers: { 'Content-Type': 'application/merge-patch+json', 'If-Match': ifMatch },
    }),
  ).data
}
export async function updateAppLinks(body: AppLinkSettingsPatch, ifMatch: string) {
  return requireData(
    await api.PATCH('/settings/app-links', {
      body,
      headers: { 'Content-Type': 'application/merge-patch+json', 'If-Match': ifMatch },
    }),
  ).data
}
