import { createClient } from '@sanity/client'
import { createReadStream, readdirSync, statSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { join, extname } from 'path'

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const PROJECT_ID = '7to0u5h2'                       // sanity.io/manage → your project
const WRITE_TOKEN = process.env.SANITY_WRITE_TOKEN  // Editor token — pass via env, never commit
// ─────────────────────────────────────────────────────────────────────────────

if (!WRITE_TOKEN) {
  console.error('Missing SANITY_WRITE_TOKEN.\n  SANITY_WRITE_TOKEN=<token> node scripts/upload-assets.mjs [file ...]')
  process.exit(1)
}

const client = createClient({
  projectId: PROJECT_ID,
  dataset: 'production',
  apiVersion: '2024-01-01',
  token: WRITE_TOKEN,
  useCdn: false,
})

const ASSETS_DIR = './assets'
const MAP_PATH = './scripts/asset-url-map.json'
const IMAGE_EXTS = new Set(['webp', 'jpg', 'jpeg', 'png', 'gif', 'svg'])

// Optional CLI args limit the upload to specific filenames; otherwise upload all.
const only = process.argv.slice(2)
const files = (only.length ? only : readdirSync(ASSETS_DIR)).filter(f =>
  existsSync(join(ASSETS_DIR, f)) && statSync(join(ASSETS_DIR, f)).isFile()
)

console.log(`Uploading ${files.length} asset(s) to Sanity...\n`)

// Merge into the existing map so unrelated entries are preserved.
const urlMap = existsSync(MAP_PATH) ? JSON.parse(readFileSync(MAP_PATH, 'utf8')) : {}
const failed = []

for (const file of files) {
  const filePath = join(ASSETS_DIR, file)
  const ext = extname(file).slice(1).toLowerCase()
  const isImage = IMAGE_EXTS.has(ext)

  try {
    const asset = await client.assets.upload(
      isImage ? 'image' : 'file',
      createReadStream(filePath),
      { filename: file }
    )
    urlMap[file] = asset.url
    console.log(`✓  ${file}`)
    console.log(`   ${asset.url}\n`)
  } catch (err) {
    console.error(`✗  ${file}: ${err.message}\n`)
    failed.push(file)
  }
}

writeFileSync(MAP_PATH, JSON.stringify(urlMap, null, 2))

console.log('─'.repeat(60))
console.log(`Done. ${files.length - failed.length} uploaded, ${failed.length} failed.`)
console.log('URL map saved to ' + MAP_PATH)
if (failed.length) {
  console.log('\nFailed files:')
  failed.forEach(f => console.log(`  ${f}`))
}
