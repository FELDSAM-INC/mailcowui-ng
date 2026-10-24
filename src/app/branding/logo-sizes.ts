// Shared by shell/sign-in rendering and the administrator's previews and size guidance.
export const logoSizes = {
  header: { height: 40, maxWidth: 192, heightClass: 'h-10', widthClass: 'max-w-[12rem]' },
  signIn: { height: 128, maxWidth: 448, heightClass: 'h-12 lg:h-32', widthClass: 'max-w-full' },
} as const
export type LogoSize = keyof typeof logoSizes
