import { minify } from 'html-minifier-next';
import { minify as minifyJS } from 'terser';
import { transform } from 'lightningcss';
import { createHash } from 'crypto';
import { cpSync, rmSync, readFileSync, writeFileSync, globSync } from 'fs';
import { extname, basename, dirname, join } from 'path';
import { execSync } from 'child_process';

const DIST = 'dist';
const start = performance.now();

// Generate static project pages before bundling
execSync('python3 scripts/build_projects.py', { stdio: 'inherit' });

// Dirs and files at root that should NOT go into dist
const EXCLUDE = new Set([
  'dist', 'node_modules', '.git', 'scripts', 'config',
  'bundle.js', 'package.json', 'package-lock.json',
  'Procfile', 'README.md', 'TODO.md', 'vercel.json',
  'depth-gallery.js', // root-level stray copy
]);

rmSync(DIST, { recursive: true, force: true });
cpSync('.', DIST, {
  recursive: true,
  filter: (src) => {
    // Always allow the root itself
    if (src === '.') return true;
    const rel = src.replace(/^\.\//, '');
    const topLevel = rel.split('/')[0];
    return !EXCLUDE.has(topLevel) && !rel.startsWith('.');
  },
});

// Minify, hash, and remap JS + CSS
const mapping = {};
for (const file of globSync(`${DIST}/**/*.{js,css}`)) {
  let content = readFileSync(file);

  if (extname(file) === '.css') {
    ({ code: content } = transform({ filename: file, code: content, minify: true }));
  } else {
    ({ code: content } = await minifyJS(content.toString(), { format: { safari10: true } }));
  }

  const hash = createHash('md5').update(content).digest('hex').slice(0, 8);
  const ext = extname(file);
  const hashed = join(dirname(file), basename(file, ext) + '.' + hash + ext);

  writeFileSync(hashed, content);
  rmSync(file);
  mapping[basename(file)] = basename(hashed);
}

// Sort longest keys first — prevents shorter names matching as substrings
const sortedMapping = Object.entries(mapping).sort((a, b) => b[0].length - a[0].length);

// Rewrite references inside JS files
for (const file of globSync(`${DIST}/**/*.js`)) {
  let js = readFileSync(file, 'utf8');
  let changed = false;
  for (const [original, hashed] of sortedMapping) {
    if (js.includes(original)) {
      // Negative lookbehind: don't match when the filename is preceded by a dot
      // or word character, which would mean it's embedded in an identifier
      // (e.g. `.style.cssText` must not match when searching for `style.css`).
      const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(?<![.\\w])${escaped}`, 'g');
      const next = js.replace(re, hashed);
      if (next !== js) { js = next; changed = true; }
    }
  }
  if (changed) writeFileSync(file, js);
}

// Rewrite references + minify HTML
for (const file of globSync(`${DIST}/**/*.html`)) {
  let html = readFileSync(file, 'utf8');

  // Swap hashed filenames
  for (const [original, hashed] of sortedMapping) {
    const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![.\\w])${escaped}`, 'g');
    html = html.replace(re, hashed);
  }

  // Strip ?v=N version params — redundant now that filenames are hashed
  html = html.replace(/(\.[a-z0-9]+)(\?v=\d+)/gi, '$1');

  html = await minify(html, {
    collapseWhitespace: true,
    conservativeCollapse: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: true,
  });

  writeFileSync(file, html);
}

console.log(`Build complete in ${((performance.now() - start) / 1000).toFixed(2)}s`);
