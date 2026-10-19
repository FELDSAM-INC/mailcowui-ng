// The Apple connection profile of the mock (UI 005 T011, research R21): a minimal plist with the
// account and, for the variant with an app password, that password.
export function applePlist(options: {
  address: string
  variant: 'email' | 'emailAndDav'
  appPassword?: string
}): string {
  const password = options.appPassword
    ? `<key>IncomingPassword</key><string>${options.appPassword}</string>`
    : ''
  const dav =
    options.variant === 'emailAndDav'
      ? '<dict><key>PayloadType</key><string>com.apple.caldav.account</string></dict>'
      : ''
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0"><dict><key>PayloadContent</key><array>',
    `<dict><key>EmailAddress</key><string>${options.address}</string>${password}</dict>${dav}`,
    '</array><key>PayloadType</key><string>Configuration</string></dict></plist>',
  ].join('')
}

export const PROFILE_FILE_NAME = 'mailcow UI.mobileconfig'
