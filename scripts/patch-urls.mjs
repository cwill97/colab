import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const urlMap = JSON.parse(readFileSync('./scripts/asset-url-map.json', 'utf8'))

// Files to patch — HTML, CSS, JS
const TARGET_EXTS = new Set(['.html', '.css', '.js'])
const ROOT = '.'
const SKIP_DIRS = new Set(['node_modules', '.git', 'scripts'])

function collectFiles(dir) {
  const results = []
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      results.push(...collectFiles(full))
    } else if (TARGET_EXTS.has(extname(entry))) {
      results.push(full)
    }
  }
  return results
}

const files = collectFiles(ROOT)
let totalReplacements = 0

for (const file of files) {
  let content = readFileSync(file, 'utf8')
  let changed = false

  for (const [filename, cdnUrl] of Object.entries(urlMap)) {
    // Match both  assets/filename  and  /assets/filename  and  ../assets/filename
    const pattern = new RegExp(
      `\\/?(\\.\\.\\/)*assets\\/${filename.replace('.', '\\.')}`,
      'g'
    )
    const before = content
    content = content.replace(pattern, cdnUrl)
    if (content !== before) {
      const count = (before.match(pattern) || []).length
      console.log(`  ${filename} → replaced ${count}x in ${file}`)
      totalReplacements += count
      changed = true
    }
  }

  if (changed) writeFileSync(file, content)
}

console.log(`\nDone. ${totalReplacements} references updated across ${files.length} files.`)
