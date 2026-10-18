// `npm run mock:scenario -- <name>`: prints a URL that selects a mock scenario in this browser
// (it sets the `mock-scenario` cookie, which localhost shares across ports) and opens the app.
import { scenarios } from './scenarios'

const name = process.argv[2]
const mockPort = process.env.MOCK_PORT ?? '4010'
const appUrl = process.env.APP_URL ?? 'http://localhost:4173/ng/'

if (!name || !scenarios[name]) {
  console.error('usage: npm run mock:scenario -- <name>\n\nScenarios:')
  for (const [key, definition] of Object.entries(scenarios)) {
    console.error(`  ${key.padEnd(28)} ${definition.description}`)
  }
  process.exit(name ? 1 : 2)
}

console.log(
  `http://localhost:${mockPort}/__mock/use?scenario=${encodeURIComponent(name)}&redirect=${encodeURIComponent(appUrl)}`,
)
