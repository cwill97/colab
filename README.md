# co:lab — Local Development

## ⚠️ Must be served over HTTP — do NOT open index.html directly

Opening `index.html` via `file://` will cause:
- Audio blocked by CORS policy
- Font loading failures
- Three.js canvas issues

## Quick start

**Option 1 — Python (built into macOS/Linux)**
```bash
cd colab-site
python3 -m http.server 3000
```
Then open: http://localhost:3000

**Option 2 — Node**
```bash
cd colab-site
npx serve .
```

**Option 3 — VS Code**
Install the "Live Server" extension → right-click `index.html` → Open with Live Server

---

## Font note
If `HelveticaNowDisplay.woff2` shows OTS parsing errors, the font files may be
protected/DRM'd. Replace with fresh exports from the font source. The layout will
fall back to `Helvetica Neue → Helvetica → Arial` in the meantime.
