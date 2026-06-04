import { createClient } from '@sanity/client'
import { createReadStream, readdirSync, statSync, writeFileSync } from 'fs'
import { join, extname } from 'path'

// ─── FILL THESE IN ───────────────────────────────────────────────────────────
const PROJECT_ID = '7to0u5h2'          // sanity.io/manage → your project
const WRITE_TOKEN = 'YOUR_WRITE_TOKEN' // sanity.io/manage → API → Tokens → Add token (Editor)
// ─────────────────────────────────────────────────────────────────────────────

const client = createClient({
  projectId: PROJECT_ID,
  dataset: 'production',
  apiVersion: '2024-01-01',
  token: WRITE_TOKEN,
  useCdn: false,
})

const ASSETS_DIR = './assets'
const IMAGE_EXTS = new Set(['webp', 'jpg', 'jpeg', 'png', 'gif', 'svg'])

const files = readdirSync(ASSETS_DIR).filter(f =>
  statSync(join(ASSETS_DIR, f)).isFile()
)

console.log(`Uploading ${files.length} assets to Sanity...\n`)

const urlMap = {}
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

writeFileSync('./scripts/asset-url-map.json', JSON.stringify(urlMap, null, 2))

console.log('─'.repeat(60))
console.log(`Done. ${Object.keys(urlMap).length} uploaded, ${failed.length} failed.`)
console.log('URL map saved to scripts/asset-url-map.json')
if (failed.length) {
  console.log('\nFailed files:')
  failed.forEach(f => console.log(`  ${f}`))
}
