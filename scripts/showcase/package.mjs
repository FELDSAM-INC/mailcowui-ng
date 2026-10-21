// Regenerate the public page and its offline copy: node scripts/showcase/package.mjs
import { readFile, writeFile } from 'node:fs/promises'

const directory = new URL('../../public/showcase/', import.meta.url)
const read = (path) => readFile(new URL(path, directory), 'utf8')
const manifest = JSON.parse(await read('screenshots/capture-manifest.json'))
const screens = [
  {
    id: 'domains',
    category: 'EMAIL CONFIGURATION',
    title: 'Domains, minus the clutter.',
    description:
      'Tags and secondary information sit inside expandable rows. Domain templates are one tab away.',
    alt: 'Domain management with an expanded row showing additional details and tags.',
  },
  {
    id: 'sync-jobs',
    category: 'SYNC JOBS',
    title: 'Familiar controls. Everywhere.',
    description:
      'Expansion and action controls stay at the end of the row, so the next step is always easy to find.',
    alt: 'Sync jobs with a row action menu open, including edit, logs, and delete.',
  },
  {
    id: 'queue',
    category: 'MAIL DELIVERY',
    title: 'The queue gets its own space.',
    description:
      'Go straight to Queue Manager from the System section to review queued messages and delivery states.',
    alt: 'Queue Manager showing sample queued mail and delivery status.',
  },
  {
    id: 'system',
    category: 'SYSTEM OVERVIEW',
    title: 'See how things are running.',
    description:
      'System details and container states share one screen. Logs and the audit log follow the same tab styling.',
    alt: 'System monitoring with CPU and memory charts and container status cards.',
  },
]
const mobile = [
  {
    id: 'mobile-mailboxes',
    title: 'Mailboxes at a glance',
    description: 'Key information, comfortably arranged.',
    alt: 'Mobile mailbox cards with addresses, quota usage, and actions.',
  },
  {
    id: 'mobile-domains',
    title: 'Configuration that fits',
    description: 'The tools you need, within reach.',
    alt: 'Domain management cards adapted to a mobile screen.',
  },
  {
    id: 'mobile-menu',
    title: 'Everything in its place',
    description: 'Clear sections. A collapsible sidebar.',
    alt: 'The mobile sidebar open, showing grouped navigation sections.',
  },
]
const mailbox = {
  id: 'mailboxes',
  title: 'Mailbox management',
  description:
    'A compact desktop table keeps mailbox names, addresses, quota use, and row controls together. Secondary details are available on demand.',
  alt: 'Mailbox management with the sidebar, quota bars, filters, and controls at the end of each row.',
}
function screenshot(screen, extraClass = '') {
  const isMobile = screen.id.startsWith('mobile-')
  return `<button class="screenshot ${extraClass}" type="button" data-title="${screen.title}" data-description="${screen.description}" aria-label="Enlarge screenshot: ${screen.title}">
    ${['light', 'dark'].map((theme) => `<img src="screenshots/${screen.id}-${theme}.jpg" data-theme-image="${theme}" width="${isMobile ? 390 : 1440}" height="${isMobile ? 844 : 960}" alt="${screen.alt} ${theme === 'light' ? 'Light' : 'Dark'} theme." ${screen.id === 'mailboxes' ? (theme === 'light' ? 'fetchpriority="high"' : '') : 'loading="lazy"'} />`).join('\n')}
    <span class="zoom-badge" aria-hidden="true">↗</span>
  </button>`
}
const download = (label) =>
  `<a class="button primary" href="mailcowui-ng-showcase.html" download="mailcowui-ng-showcase.html" data-download>${label} <span aria-hidden="true">↓</span></a>`
const html = `<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <title>mailcowui-ng — A clearer view of your mail server</title>
  <meta name="description" content="Explore the mailcowui-ng community preview: a refreshed mail administration interface, with light and dark themes and layouts for desktop and mobile." />
  <meta property="og:title" content="mailcowui-ng — A clearer view of your mail server" />
  <meta property="og:description" content="A visual tour of the refreshed interface. Compact desktop tables, comfortable mobile layouts, and a consistent light and dark palette." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://maildev.feldhost.cz/ng/showcase/" />
  <meta property="og:image" content="https://maildev.feldhost.cz/ng/showcase/screenshots/mailboxes-light.jpg" />
  <meta property="og:image:alt" content="The mailcowui-ng mailbox management screen in light mode, with sample data" />
  <link rel="icon" href="icon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="showcase.css" />
  <script src="showcase.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header wrap">
    <a class="wordmark" href="#" aria-label="mailcowui-ng showcase home">
      <svg class="brand-icon" viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="9" /><path d="M8 11h16v11H8zM8 11l8 6 8-6" /></svg>
      <span>mailcow<span class="wordmark-suffix">ui-ng</span></span>
    </a>
    <nav class="header-nav" aria-label="Showcase sections"><a href="#desktop">Desktop</a><a href="#mobile">Mobile</a><a href="#share">Share</a></nav>
    <div class="theme-control" role="group" aria-label="Screenshot and page theme" hidden>
      <button type="button" data-set-theme="light" aria-pressed="true"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></svg><span>Light</span></button>
      <button type="button" data-set-theme="dark" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z" /></svg><span>Dark</span></button>
    </div>
  </header>
  <main id="main">
    <section class="hero wrap" aria-labelledby="hero-title">
      <div class="eyebrow"><span class="status-dot"></span>Community preview</div>
      <h1 id="hero-title">Your mail server.<br /><span>A clearer view.</span></h1>
      <p class="hero-description">Meet mailcowui-ng. A refreshed interface for managing mail, with focused navigation, compact desktop tables, and room to breathe on mobile.</p>
      <div class="hero-actions"><a class="button primary" href="#desktop">Explore the interface <span aria-hidden="true">↓</span></a><a class="button secondary" href="mailcowui-ng-showcase.html" download="mailcowui-ng-showcase.html" data-download>Download this showcase <span aria-hidden="true">↗</span></a></div>
      <p class="hero-note">Actual app screenshots · Sample data · Light &amp; dark themes</p>
    </section>
    <section class="hero-preview wrap" aria-label="Mailbox management preview">
      <div class="preview-heading"><span><span class="section-number">01</span>Mailbox management</span><span class="enlarge-hint">Select a screenshot to explore</span></div>
      ${screenshot(mailbox, 'hero-shot')}
      <div class="preview-caption"><span>More of your day-to-day work, in one view.</span><span class="theme-caption">Light theme</span></div>
    </section>
    <div class="benefits wrap">
      <article><span class="benefit-number">01 / NAVIGATION</span><h2>A place for everything.</h2><p>Related tools live together. Clear sidebar sections and consistent tabs help you move between email configuration, system settings, and your account.</p></article>
      <article><span class="benefit-number">02 / TABLES</span><h2>Useful density.</h2><p>Compact rows make better use of a desktop screen. On mobile, generous cards keep the same information comfortable to read and use.</p></article>
      <article><span class="benefit-number">03 / DETAILS</span><h2>There when you need them.</h2><p>Expand a row for extra detail. Find actions in a consistent place at the end of each row, with a direct button when there is just one action.</p></article>
    </div>
    <section class="tour-section wrap" id="desktop" aria-labelledby="desktop-title">
      <div class="section-intro"><div><p class="eyebrow">THE DESKTOP TOUR</p><h2 id="desktop-title">The daily work,<br />in focus.</h2></div><p>From domain configuration to mail delivery, a shared visual language brings the administration tools together. Switch themes above to see every screen in a different light.</p></div>
      <div class="desktop-grid">${screens.map((screen) => `<article class="tour-card">${screenshot(screen)}<div class="card-copy"><p class="card-category">${screen.category}</p><h3>${screen.title}</h3><p>${screen.description}</p></div></article>`).join('\n')}</div>
    </section>
    <section class="mobile-section" id="mobile" aria-labelledby="mobile-title">
      <div class="wrap"><div class="section-intro"><div><p class="eyebrow">THE MOBILE TOUR</p><h2 id="mobile-title">A smaller screen.<br />The same attention.</h2></div><p>The layout adapts to the space you have. Tables become readable cards, controls stay comfortable to tap, and the sidebar is ready when you need it.</p></div>
      <div class="mobile-grid">${mobile.map((screen) => `<article class="mobile-card">${screenshot(screen, 'mobile-shot')}<h3>${screen.title}</h3><p>${screen.description}</p></article>`).join('\n')}</div></div>
    </section>
    <section class="share-section wrap" id="share" aria-labelledby="share-title">
      <div class="share-panel"><div><p class="eyebrow">MADE TO SHARE</p><h2 id="share-title">Take the tour with you.</h2><p>Share this page with the community, or download the complete showcase. One HTML file, both themes, every screenshot. Open it in a browser, even offline.</p></div><div class="share-actions">${download('Download the HTML')}<span class="download-note">Self-contained · No installation</span><a class="text-link" href="https://maildev.feldhost.cz/ng/showcase/">Public showcase link <span aria-hidden="true">↗</span></a></div></div>
      <p class="preview-disclaimer">This is a community development preview, not an official mailcow release. All screenshots use sample data. Captured on ${manifest.capturedAt.slice(0, 10)} from build <code>${manifest.sourceRevision}</code>; features and appearance may continue to change.</p>
    </section>
  </main>
  <footer class="site-footer wrap"><span>mailcowui-ng <span class="footer-divider">/</span>A fresh interface for mailcow</span><div><span>Built with TailAdmin Free</span><a href="https://github.com/FELDSAM-INC/mailcowui-ng">View source <span aria-hidden="true">↗</span></a></div></footer>
  <dialog id="image-viewer" aria-labelledby="viewer-title" aria-describedby="viewer-description">
    <div class="viewer-toolbar"><div><p class="eyebrow">INTERFACE PREVIEW</p><h2 id="viewer-title"></h2></div><button id="close-viewer" type="button" aria-label="Close screenshot viewer">✕</button></div>
    <div class="viewer-image-wrap"><img id="viewer-image" alt="" /></div>
    <p id="viewer-description"></p><p class="viewer-hint">Select the image to switch between fit and full size. Press Escape to close.</p>
  </dialog>
</body>
</html>
`
await writeFile(new URL('index.html', directory), html)
const css = await read('showcase.css')
const script = await read('showcase.js')
let standalone = html
  .replace(
    '<html lang="en" data-theme="light">',
    '<html lang="en" data-theme="light" data-standalone="true">',
  )
  .replace(/<link rel="stylesheet" href="showcase.css"\s*\/>/, () => `<style>\n${css}</style>`)
  .replace(/^[ \t]*<script src="showcase.js" defer><\/script>\n/m, '')
  .replace('</body>', () => `<script>\n${script}</script>\n</body>`)
const assets = [
  ...new Set(
    [...standalone.matchAll(/(?:src|href)="((?:screenshots\/[^"\s]+\.jpg)|icon\.svg)"/g)].map(
      (match) => match[1],
    ),
  ),
]
for (const path of assets) {
  const contents = await readFile(new URL(path, directory))
  const mime = path.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg'
  standalone = standalone.replaceAll(
    `"${path}"`,
    `"data:${mime};base64,${contents.toString('base64')}"`,
  )
}
if (/src="(?!data:)/.test(standalone) || /href="showcase.css"/.test(standalone)) {
  throw new Error('Offline tour still depends on an external asset')
}
await writeFile(new URL('mailcowui-ng-showcase.html', directory), standalone)
console.log(
  `Packaged ${assets.length} assets into ${(Buffer.byteLength(standalone) / 1024 / 1024).toFixed(1)} MB of standalone HTML`,
)
