// Applies the theme last chosen on this device before the first paint (research R16).
// External same-origin file, so the strict CSP (`script-src 'self'`) allows it.
;(function () {
  var theme = null
  try {
    theme = window.localStorage.getItem('mailcowui-ng.theme')
  } catch {
    theme = null
  }
  var dark = theme === 'dark'
  if (theme !== 'light' && theme !== 'dark') {
    try {
      dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    } catch {
      dark = false
    }
  }
  if (dark) {
    document.documentElement.classList.add('dark')
  }
})()
