# bidhanar.github.io

Personal site of **Bidhan Arya**: embedded engineer at EndureAir (ArduPilot, physics simulation) and writer of short fiction and Hindi poetry. Live at <https://bidhanar.github.io>.

Plain static HTML/CSS/JS served by GitHub Pages. No build step, no framework, no package.json. To preview locally:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Layout

| Path | What |
|---|---|
| `index.html` | Home: rain-and-rotor hero, two-worlds section, featured work, latest writing |
| `projects.html`, `projects/*.html` | Project index (with category filters) and one page per project |
| `stories.html`, `stories/*.html` | Short fiction |
| `poems.html`, `poems/*.html` | Poems (mostly Hindi, `lang="hi"`) |
| `about.html`, `contact.html` | CV-style about page, links |
| `styles-index.css` | The whole design system ("Rotor Verse"): tokens, components, page styles |
| `site.js` | Shared behaviour: nav and mobile menu, scroll reveals, spotlight/tilt cards, counters, poem line reveals, reading time, project filters |
| `hero.js` | The home page canvas (rain pushed aside by a rotor's downwash) |
| `book-export.js` | "Download PDF" / "Download ePub" on every story and poem |

## Adding content

Copy an existing page in the same folder and change the title, `<meta name="description">` and body. Keep these hooks:

- **Story:** `<article class="card story-container">` → `<h1>` → `<div class="story-actions">` → `<div class="story-body"><p>…</p></div>`. Reading time, drop cap and the PDF/ePub buttons are added automatically.
- **Poem (Hindi):** `<article class="card poem-container">` with `<div id="poemText" class="poem-text" lang="hi">` holding the poem as plain text, one line per line. Line-by-line reveal, TTS and export all read this text.
- **Project:** `<article class="section card">` with `<h1>`, a `<p class="muted">` date line, then `<h3>` sections.

Then add a card to the matching index page (`stories.html`, `poems.html` or `projects.html`; projects need a `data-cat` of `research`, `android` or `code`).

## Notes

- Everything degrades gracefully: without JS all content is visible, and `prefers-reduced-motion` turns the animation off.
- Page-to-page transitions use the cross-document View Transitions API (Chromium); other browsers just navigate normally.
- External assets: Google Fonts (Fraunces, Inter, JetBrains Mono, Noto Serif Devanagari), html2pdf.js and JSZip from cdnjs (story/poem pages), p5.js from cdnjs (clocks demo). All are version-pinned.
