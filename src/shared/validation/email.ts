// Permissive client check shared by notification and mass-mail forms. The API remains
// authoritative for mailbox syntax and can reject local domains accepted by this precheck.
export const isEmailAddress = (value: string) =>
  /^[^\s@]+@[^\s@]+$/.test(value) && !/[\u0000-\u001f\u007f]/.test(value)
