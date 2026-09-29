// Fails when an onboarding step points at an anchor no component renders, so a UI refactor
// can't silently break a tour. Anchors live in lib/onboarding/registry.ts; targets are
// data-tour="…" attributes in components/ and app/.
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
for (const file of [...walk(join(root, 'components')), ...walk(join(root, 'app'))]) {
  const src = readFileSync(file, 'utf8')
  // data-tour="x" and data-tour={cond ? 'x' : undefined}
  for (const m of src.matchAll(/data-tour=(?:"([^"]+)"|\{[^}]*?'([^']+)')/g)) present.add(m[1] ?? m[2])
}

const missing = [...wanted].filter((anchor) => !present.has(anchor)).sort()
if (missing.length > 0) {
  console.error(`Tour anchors with no data-tour="…" in the source:\n  ${missing.join('\n  ')}`)
  process.exit(1)
}
console.log(`All ${wanted.size} tour anchors found.`)
