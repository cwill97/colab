#!/usr/bin/env python3
"""co:lab — static project page generator.

Generates one HTML file per project at /project/<slug>/index.html,
a listing page at /project/index.html, plus /sitemap.xml.

Project metadata mirrors the PROJECTS array in js/project-boot.js.
If you add or rename a project, update both.

Usage:
    python3 scripts/build_projects.py
"""
from __future__ import annotations

import datetime as _dt
import html as _html
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE_ORIGIN = "https://colab47.com"

PROJECTS = [
    {
        "slug": "viking-gear",
        "index": "001",
        "title": "Viking Gear",
        "services": "Brand Development · Web Design · E-Commerce · 3D · Animation",
        "hasVideo": True,
        "videoSrc": (
            "https://player.vimeo.com/video/1171733635"
            "?background=1&autoplay=1&loop=1&muted=1&byline=0&title=0&portrait=0"
        ),
        "metaDescription": (
            "Brand development, web design, e-commerce, 3D and animation for "
            "Viking Gear — primal training tools reimagined as modern rituals "
            "of discipline and mastery."
        ),
        "description": (
            "Viking Gear forges strength through primal movement. Rooted in the warrior "
            "spirit, it reimagines ancient training tools such as maces, clubs, and hammers "
            "as modern extensions of discipline, flow, and mastery. Every piece honours "
            "resilience, balance, and raw power, turning training into ritual.\n\n"
            "We built the brand from the ground up. We shaped the strategy, art direction, "
            "and complete visual identity, creating a bold, purposeful world where ancient "
            "form meets contemporary performance."
        ),
        "heroImage": "/assets/Project_Img_01.webp",
    },
    {
        "slug": "rebel-kids-club",
        "index": "002",
        "title": "Rebel Kids Club",
        "services": "Brand Development · Photography · E-Commerce · Web Design",
        "hasVideo": False,
        "metaDescription": (
            "Gender-neutral toddler fashion brand. Full identity system, photography "
            "direction and e-commerce design for Rebel Kids Club — bold, inclusive and "
            "unmistakably its own."
        ),
        "description": (
            "Rebel Kids Club breaks the pink and blue code. It redefines toddler fashion "
            "with gender neutral clothing that celebrates individuality, intention, and "
            "timeless style from day one. Bold yet grounded, modern yet wearable, every "
            "piece gives parents a fresh way to dress their little rebels.\n\n"
            "We built the brand from the ground up. We created the full identity system, "
            "from name and positioning to visual language and guidelines, crafting a "
            "distinctive voice that feels confident, inclusive, and unmistakably its own."
        ),
        "heroImage": "/assets/Project_Img_02.webp",
    },
    {
        "slug": "mannequin-films",
        "index": "003",
        "title": "Mannequin Films",
        "services": "Brand Development · Web Design · Motion",
        "hasVideo": False,
        "metaDescription": (
            "Cinematic rebrand for Mannequin Films — brand identity, web design and motion "
            "that distil their visual storytelling into a timeless, alive language."
        ),
        "description": (
            "Mannequin Films captures the raw poetry of visual storytelling. Through "
            "photography and video, they transform fleeting moments into enduring narratives "
            "that resonate with authenticity and precision. Every frame is crafted with "
            "intention, blending creativity, emotion, and technical excellence to bring "
            "stories to life.\n\n"
            "We led a full rebrand, forging a new identity that honours their cinematic "
            "roots while sharpening their contemporary edge. From the refined brandmark to "
            "the complete visual system, we distilled their essence into a cohesive language "
            "that feels both timeless and alive."
        ),
        "heroImage": "/assets/Project_Img_03.webp",
    },
]


# ───────────────────────────────────────────── helpers ──

def esc(s: str) -> str:
    return _html.escape(str(s), quote=True)


def description_to_html(text: str) -> str:
    paragraphs = [p for p in text.split("\n\n") if p]
    parts = []
    for p in paragraphs:
        parts.append("<span>" + esc(p).replace("\n", "<br />") + "</span>")
    return "<br /><br />".join(parts)


def write_file(rel: str, contents: str) -> None:
    full = ROOT / rel
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_text(contents, encoding="utf-8")
    print(f"  ✓ {rel}")


# ─────────────────────────────────────────── shells ──

def site_head(title: str, description: str, canonical: str, og_image: str) -> str:
    og_url = SITE_ORIGIN + og_image
    return f"""  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="{esc(description)}" />
  <title>{esc(title)}</title>

  <link rel="canonical" href="{esc(canonical)}" />

  <meta property="og:type" content="article" />
  <meta property="og:title" content="{esc(title)}" />
  <meta property="og:description" content="{esc(description)}" />
  <meta property="og:url" content="{esc(canonical)}" />
  <meta property="og:image" content="{esc(og_url)}" />
  <meta property="og:site_name" content="co:lab" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{esc(title)}" />
  <meta name="twitter:description" content="{esc(description)}" />
  <meta name="twitter:image" content="{esc(og_url)}" />

  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Mono&display=swap" rel="stylesheet" />
  <link rel="preconnect" href="https://fonts.cdnfonts.com" crossorigin />
  <link href="https://fonts.cdnfonts.com/css/helvetica-neue-5?styles=15273,15271,15270,17624" rel="stylesheet" />

  <link rel="stylesheet" href="/css/main.css" />
  <link rel="stylesheet" href="/css/project.css" />

  <script src="/js/scale.js"></script>"""


PERSISTENT_CHROME = """  <div class="bg-hover-layer" aria-hidden="true"></div>

  <div class="grid-overlay" aria-hidden="true">
    <div class="grid-overlay-col"></div><div class="grid-overlay-col"></div><div class="grid-overlay-col"></div><div class="grid-overlay-col"></div><div class="grid-overlay-col"></div>
    <div class="grid-overlay-col"></div><div class="grid-overlay-col"></div><div class="grid-overlay-col"></div><div class="grid-overlay-col"></div><div class="grid-overlay-col"></div>
  </div>

  <header role="banner">
    <nav class="site-nav" aria-label="Primary navigation">
      <div class="nav-inner">
        <a class="nav-logo" href="/" aria-label="co:lab — go to homepage">
          <img src="/assets/logo.svg" alt="co:lab" width="102" height="25" />
        </a>
        <button class="nav-toggle" type="button" aria-controls="site-menu" aria-expanded="false" aria-label="Open navigation menu" data-nav-toggle>
          <span class="nav-toggle-icon" aria-hidden="true"></span>
        </button>
      </div>
    </nav>
  </header>

  <div class="audio-visualizer" role="button" tabindex="0" aria-label="Audio visualizer — click to mute" aria-pressed="false" data-muted="false" data-visualizer aria-hidden="true" style="display:none;">
    <canvas data-viz-canvas></canvas>
  </div>

  <div class="audio-toggle" role="button" tabindex="0" aria-label="Toggle audio — off" data-audio-toggle>
    <span class="audio-toggle-label" data-audio-label>Sound Off</span>
    <svg class="audio-toggle-wave" viewBox="0 0 36 36" aria-hidden="true">
      <line class="audio-toggle-bar" data-bar="0" x1="7"  y1="10" x2="7"  y2="26" />
      <line class="audio-toggle-bar" data-bar="1" x1="13" y1="10" x2="13" y2="26" />
      <line class="audio-toggle-bar" data-bar="2" x1="19" y1="10" x2="19" y2="26" />
      <line class="audio-toggle-bar" data-bar="3" x1="25" y1="10" x2="25" y2="26" />
      <line class="audio-toggle-bar" data-bar="4" x1="31" y1="10" x2="31" y2="26" />
      <line class="audio-toggle-slash" x1="5" y1="31" x2="31" y2="5" />
    </svg>
  </div>

  <div id="site-menu" class="site-menu" role="dialog" aria-modal="true" aria-label="Navigation menu" aria-hidden="true" data-nav-menu>
    <div class="bg-hover-layer" aria-hidden="true"></div>
    <nav class="menu-nav" aria-label="Primary menu">
      <ul class="menu-nav-list">
        <li class="menu-nav-item" data-nav="home">
          <span class="menu-active-square" aria-hidden="true"></span><a href="/" class="menu-nav-link" data-menu-home data-nav="home">Home</a><span class="menu-coords" aria-hidden="true">26.2056° S, 28.0337° E</span>
        </li>
        <li class="menu-nav-item" data-nav="about">
          <span class="menu-active-square" aria-hidden="true"></span><a href="/about" class="menu-nav-link" data-menu-about data-nav="about">Studio</a>
        </li>
        <li class="menu-nav-item" data-nav="research">
          <span class="menu-active-square" aria-hidden="true"></span><a href="/research" class="menu-nav-link" data-nav="research">Research/</a>
        </li>
        <li class="menu-nav-item" data-nav="experiment">
          <span class="menu-active-square" aria-hidden="true"></span><a href="/experiment" class="menu-nav-link" data-nav="experiment">Experiment</a>
        </li>
        <li class="menu-nav-item is-inactive">
          <span class="menu-active-square" aria-hidden="true"></span><span class="menu-nav-link is-inactive" aria-disabled="true">Marketplace<sup class="menu-soon-tag">(SOON)</sup></span>
        </li>
      </ul>
    </nav>
    <div class="menu-footer">
      <div class="menu-footer-col">
        <span class="menu-footer-label">Contact</span>
        <ul><li><a href="mailto:info@colab47.com">Info@colab47.com</a></li><li>+27 83 987 7654</li><li>South Africa</li><li><a href="/assets/colab47_RateCard.pdf" target="_blank" rel="noopener noreferrer">Rate Card</a></li></ul>
      </div>
      <div class="menu-footer-col">
        <span class="menu-footer-label">Socials</span>
        <ul><li><a href="https://www.awwwards.com/colab47/" target="_blank" rel="noopener noreferrer">Awwwards</a></li><li><a href="https://www.instagram.com/colab.47/" target="_blank" rel="noopener noreferrer">Instagram</a></li><li><a href="https://www.linkedin.com/company/co-lab47" target="_blank" rel="noopener noreferrer">LinkedIn</a></li><li>Youtube</li></ul>
      </div>
    </div>
  </div>

  <div class="tesseract-wrap" aria-hidden="true" data-tesseract></div>"""


PROJECT_SCRIPTS = """  <script src="/js/shader-reveal.js"></script>
  <script src="/js/barba.umd.js"></script>
  <script src="/js/main.js" defer></script>
  <script src="/js/visualizer.js" defer></script>
  <script src="/js/tesseract.js" defer></script>
  <script src="/js/bg-reveal.js" defer></script>
  <script src="/js/menu-ripple.js" defer></script>
  <script src="/js/video-preview.js" defer></script>
  <script src="/js/depth-gallery.js" defer></script>
  <script src="/js/project-boot.js" defer></script>
  <script src="/js/line-hover.js" defer></script>
  <script src="/js/hover-sfx.js" defer></script>
  <script src="/js/barba-init.js" defer></script>"""


# ─────────────────────────────────────── per-project ──

def related_rail_html(active_slug: str) -> str:
    rows = []
    for p in PROJECTS:
        active_cls = " is-active" if p["slug"] == active_slug else ""
        rows.append(
            f'          <li class="related-project-item{active_cls}" data-project-slug="{esc(p["slug"])}">\n'
            f'            <a class="related-project-link" href="/project/{esc(p["slug"])}/">\n'
            f'              <span class="related-project-num">{esc(p["index"])}</span>\n'
            f'              <h3 class="related-project-title">{esc(p["title"])}</h3>\n'
            f'              <p class="related-project-detail">{esc(p["services"])}</p>\n'
            f'              <span class="related-project-cta">[ View Project ]</span>\n'
            f'            </a>\n'
            f'          </li>'
        )
    items = "\n".join(rows)
    return (
        '      <nav class="related-projects" aria-label="More projects" data-related-projects>\n'
        '        <ul class="related-project-list">\n'
        f'{items}\n'
        '        </ul>\n'
        '      </nav>'
    )


def project_jsonld(p: dict, canonical: str) -> str:
    data = {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        "name": p["title"],
        "description": p["metaDescription"],
        "url": canonical,
        "image": SITE_ORIGIN + p["heroImage"],
        "creator": {"@type": "Organization", "name": "co:lab", "url": SITE_ORIGIN + "/"},
        "keywords": p["services"],
    }
    return f'<script type="application/ld+json">{json.dumps(data, ensure_ascii=False)}</script>'


def project_html(p: dict, idx: int, total: int) -> str:
    canonical = f"{SITE_ORIGIN}/project/{p['slug']}/"
    counter = f"0{idx + 1} / 0{total}"

    if p["hasVideo"]:
        video_block = (
            '      <div class="project-video-preview" data-video-preview aria-label="Play project video">\n'
            f'        <iframe class="project-video-thumb" data-video-thumb src="{esc(p["videoSrc"])}" frameborder="0" allow="autoplay; fullscreen" aria-hidden="true"></iframe>\n'
            '        <div class="project-video-cue" aria-hidden="true">\n'
            '          <span class="project-video-cue-label">[ PLAY ]</span>\n'
            '        </div>\n'
            '      </div>\n\n'
            '      <div class="project-video-lightbox" data-video-lightbox aria-modal="true" aria-label="Video player" aria-hidden="true">\n'
            '        <div class="project-video-lightbox-inner" data-lightbox-inner>\n'
            '          <div class="project-video-lightbox-frame" data-lightbox-frame></div>\n'
            '        </div>\n'
            '        <button class="project-video-close" data-video-close type="button" aria-label="Close video">\n'
            '          <span aria-hidden="true">[ CLOSE ]</span>\n'
            '        </button>\n'
            '      </div>\n\n'
        )
    else:
        video_block = ""

    head = site_head(
        title=f'{p["title"]} — co:lab',
        description=p["metaDescription"],
        canonical=canonical,
        og_image=p["heroImage"],
    )
    rail = related_rail_html(p["slug"])
    jsonld = project_jsonld(p, canonical)
    desc_html = description_to_html(p["description"])

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
{head}

  {jsonld}
</head>
<body class="project-page">

  <!-- ============ PERSISTENT ELEMENTS ============ -->

{PERSISTENT_CHROME}

  <!-- ============ BARBA — swappable content ============ -->
  <div data-barba="wrapper">
    <div data-barba="container" data-barba-namespace="project" data-project-slug="{esc(p['slug'])}">

{video_block}      <h2 class="project-mobile-title" data-mobile-title>{esc(p['title'])}</h2>

      <p class="about-text" data-full-text="{esc(p['description'])}">{desc_html}</p>

      <span class="project-mobile-hint" aria-hidden="true">scroll / hold to explore</span>

{rail}

      <main id="main-content" class="project-main" data-project-main>
        <div class="project-canvas-wrap" data-project-canvas-wrap>
          <canvas class="project-depth-canvas" data-depth-canvas aria-label="Project depth gallery — scroll to explore"></canvas>
          <div class="project-meta" data-project-meta>
            <span class="project-meta-num" data-meta-num>{esc(p['index'])}</span>
            <h1 class="project-meta-title" data-meta-title>{esc(p['title'])}</h1>
            <p class="project-meta-services" data-meta-services>{esc(p['services'])}</p>
            <div class="project-meta-progress">
              <div class="project-meta-track" aria-hidden="true">
                <div class="project-meta-fill" data-meta-fill></div>
              </div>
              <span class="project-meta-count" data-meta-count>{esc(counter)}</span>
            </div>
          </div>
          <div class="project-scroll-hint" data-scroll-hint aria-hidden="true">
            <span>scroll to explore</span>
            <div class="scroll-hint-line"></div>
          </div>
        </div>
      </main>

    </div>
  </div>

{PROJECT_SCRIPTS}

</body>
</html>
"""


# ─────────────────────────────────────── projects index ──

def projects_index_html() -> str:
    canonical = SITE_ORIGIN + "/project/"
    cards = []
    for p in PROJECTS:
        cards.append(
            f'          <li class="project-item" data-preview-image="{esc(p["heroImage"])}">\n'
            f'            <a class="project-card-link" href="/project/{esc(p["slug"])}/">\n'
            f'              <h2 class="project-title">{esc(p["title"])}</h2>\n'
            f'              <p class="project-detail">{esc(p["metaDescription"])}</p>\n'
            f'              <span class="project-cta">[ View Project ]</span>\n'
            f'            </a>\n'
            f'          </li>'
        )
    cards_html = "\n".join(cards)

    head = site_head(
        title="Projects — co:lab",
        description=(
            "Selected work from co:lab — brand development, web design, e-commerce, "
            "photography, motion, and 3D for clients including Viking Gear, Rebel Kids "
            "Club and Mannequin Films."
        ),
        canonical=canonical,
        og_image=PROJECTS[0]["heroImage"],
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
{head}
</head>
<body class="projects-index-page">

{PERSISTENT_CHROME}

  <div data-barba="wrapper">
    <div data-barba="container" data-barba-namespace="projects-index">

      <main id="main-content" class="projects-index-main">
        <header class="projects-index-header">
          <h1>Projects</h1>
          <p>Selected work — brand identity, digital and motion.</p>
        </header>

        <ul class="project-list projects-index-list">
{cards_html}
        </ul>
      </main>

    </div>
  </div>

  <script src="/js/shader-reveal.js"></script>
  <script src="/js/barba.umd.js"></script>
  <script src="/js/main.js" defer></script>
  <script src="/js/visualizer.js" defer></script>
  <script src="/js/tesseract.js" defer></script>
  <script src="/js/bg-reveal.js" defer></script>
  <script src="/js/menu-ripple.js" defer></script>
  <script src="/js/line-hover.js" defer></script>
  <script src="/js/hover-sfx.js" defer></script>
  <script src="/js/barba-init.js" defer></script>

</body>
</html>
"""


# ─────────────────────────────────────── sitemap / robots ──

def sitemap_xml() -> str:
    today = _dt.date.today().isoformat()
    urls = [
        {"loc": SITE_ORIGIN + "/", "priority": "1.0"},
        {"loc": SITE_ORIGIN + "/about", "priority": "0.7"},
        {"loc": SITE_ORIGIN + "/project/", "priority": "0.9"},
    ]
    for p in PROJECTS:
        urls.append({
            "loc": f"{SITE_ORIGIN}/project/{p['slug']}/",
            "priority": "0.8",
        })
    body = "\n".join(
        f"  <url>\n    <loc>{u['loc']}</loc>\n    <lastmod>{today}</lastmod>\n    <priority>{u['priority']}</priority>\n  </url>"
        for u in urls
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{body}\n"
        "</urlset>\n"
    )


def robots_txt() -> str:
    return f"User-agent: *\nAllow: /\n\nSitemap: {SITE_ORIGIN}/sitemap.xml\n"


# ─────────────────────────────────────── main ──

def main() -> int:
    print("Building project pages…")

    for i, p in enumerate(PROJECTS):
        rel = os.path.join("project", p["slug"], "index.html")
        write_file(rel, project_html(p, i, len(PROJECTS)))

    write_file(os.path.join("project", "index.html"), projects_index_html())
    write_file("sitemap.xml", sitemap_xml())

    robots_path = ROOT / "robots.txt"
    if not robots_path.exists():
        write_file("robots.txt", robots_txt())
    else:
        print("  · robots.txt already exists, leaving alone")

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
