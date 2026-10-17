// Fails when an onboarding step points at an anchor no component renders, so a UI refactor
// can't silently break a tour. Anchors live in lib/onboarding/registry.ts; targets are
// data-tour="…" attributes in components/ and app/. Also checks Help keys: every
// <HelpLink topic=…>, `related` and `tour` in lib/help/topics.ts must resolve.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const registry = readFileSync(join(root, 'lib/onboarding/registry.ts'), 'utf8')
const wanted = new Set(
  [...registry.matchAll(/\b(?:anchor|skipIfVisible):\s*'([^']+)'/g)].map((m) => m[1]),
)

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.tsx?$/.test(name)) out.push(path)
  }
  return out
}

const present = new Set()
const helpLinks = []
for (const file of [...walk(join(root, 'components')), ...walk(join(root, 'app'))]) {
  const src = readFileSync(file, 'utf8')
  // data-tour="x" and data-tour={cond ? 'x' : undefined}
  for (const m of src.matchAll(/data-tour=(?:"([^"]+)"|\{[^}]*?'([^']+)')/g)) present.add(m[1] ?? m[2])
  for (const m of src.matchAll(/<HelpLink\b[^>]*?\btopic=["']([^"']+)["']/g)) {
    helpLinks.push({ key: m[1], from: file.slice(root.length) })
  }
}

const problems = []
const missing = [...wanted].filter((anchor) => !present.has(anchor)).sort()
if (missing.length > 0) {
  problems.push(`Tour anchors with no data-tour="…" in the source:\n  ${missing.join('\n  ')}`)
}

// Help keys. A topic is an object with `key:` directly followed by `section:`.
const topicsSrc = readFileSync(join(root, 'lib/help/topics.ts'), 'utf8')
const topicKeys = new Set([...topicsSrc.matchAll(/key: '([^']+)',\s*section:/g)].map((m) => m[1]))
const tourKeys = new Set([...registry.matchAll(/key: '(tour\.[^']+)'/g)].map((m) => m[1]))
const badHelp = [
  ...helpLinks.filter((l) => !topicKeys.has(l.key)).map((l) => `<HelpLink topic="${l.key}"> in ${l.from}`),
  ...[...topicsSrc.matchAll(/related: \[([^\]]*)\]/g)]
    .flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)].map((k) => k[1]))
    .filter((k) => !topicKeys.has(k))
    .map((k) => `related: '${k}'`),
  ...[...topicsSrc.matchAll(/tour: '([^']+)'/g)]
    .map((m) => m[1])
    .filter((k) => !tourKeys.has(k))
    .map((k) => `tour: '${k}'`),
]
if (badHelp.length > 0) problems.push(`Help keys with no matching topic or tour:\n  ${badHelp.join('\n  ')}`)

if (problems.length > 0) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(
  `All ${wanted.size} tour anchors found. ${topicKeys.size} help topics, ${helpLinks.length} HelpLinks resolve.`,
)
