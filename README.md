# G/note.

Paste **Markdown + LaTeX** → get a GPAI-style, print-ready multi-column A4 sheet → **Export PDF**.

Built from forensic measurement of a real GPAI Cheatsheet Builder PDF:
**Liberation Serif 6.5pt, A4, 10mm margins, 3 columns, ~4.8mm gutters, KaTeX math** —
so the match is real: the exported PDF embeds the same LiberationSerif + KaTeX fonts as the original.

## Use it

- **Live:** **https://g-note-beta.vercel.app** — no account, nothing you paste leaves your browser.
- **Offline / anywhere:** unzip `g-note.zip`, keep `index.html` and `vendor/` together, and open `index.html` in Chrome/Edge (or serve the folder with any static server, e.g. `python3 -m http.server`). All libraries and fonts are vendored — no internet needed.

The two versions run the *identical* app code. The folder version (`index.html` + `vendor/`) is fully self-contained; the deployed version loads the same pinned library versions and metric-identical fonts from CDN (see *Deployment* below).

## Notes, autosave, undo — no account, no database

Everything is stored **in your browser** (synchronous `localStorage`, plus IndexedDB for image bytes), so work survives refreshes, tab closes and restarts:

- **Autosave:** every keystroke is mirrored to storage immediately; the notes library and undo history are written a beat later and force-flushed when the tab hides/closes. Nothing is ever "pending" when you refresh.
- **Notes library:** the **Notes** button (top bar) lists your notes — create, open, rename (inline, or via the name box above the editor) and delete. The open note's name also becomes the exported **PDF / .md filename**. Your existing single-note save is adopted automatically as the first note.
- **Undo / redo:** the ↶ / ↷ buttons (or **Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y**) step through up to **3 edits backwards and 3 forwards**, per note, and the stacks survive reloads. A continuous typing burst counts as one edit; inserting an image, importing, loading the sample or clearing each count as one step.
- **Images without the base64 wall:** pasted/dropped/inserted images are stored in the browser and appear in the editor as a short `![name](gnote-img:…)` tag — easy to move or delete like any line. The preview and the exported PDF still show the full image (tags are expanded right before rendering). **Save .md** writes a fully self-contained file with the image data inlined; importing such a file migrates its blobs back into tags.
- **Dark mode:** the moon button themes the interface (persisted per browser). The sheet and the PDF always keep exactly the colours you designed — dark mode never leaks into print.
- Corrupt/foreign storage values are normalised or ignored safely; if storage is full or blocked you get one clear toast and **Save .md** still works.

## What you can paste

| Content | Syntax |
|---|---|
| Title / sections | `#`, `##` (ruled GPAI section), `###` sub-section |
| Inline math | `$F=ma$`, `\(F=ma\)` |
| Display math | `$$E_k=\tfrac12mv^2$$`, `\[…\]`, `\begin{aligned}…\end{aligned}`, `cases`, `pmatrix`… (KaTeX) |
| Tables | GitHub-flavoured Markdown tables (math allowed in cells; captions and `<tfoot>` survive splitting) |
| Images | `![alt](url)`, **Image** button, or paste / drag an image file into the editor (auto-embeds) |
| Diagrams | raw inline `<svg>…</svg>` (sanitised; `<use>` may only reference local defs) |
| Links | `[text](https://…)` — clickable in the exported PDF |
| Code | `` `inline` `` and fenced blocks — `$` inside code stays literal |
| Manual breaks | `<!-- column-break -->`, `<!-- page-break -->` on their own line; `<!-- keep-topic -->` keeps the next section in one column |

A ⚠ badge lists every formula that failed to render (with the KaTeX error) instead of silently printing garbage.

## Design studio

The workspace follows the natural workflow: **Content → Design → Preview**. The Design button collapses the middle panel when you want more room; on smaller screens it becomes a drawer. Design controls style the *sheet only* — never the interface, and never your content.

Start from a preset — **GPAI** (the measured original), **Compact**, **Readable**, or **Spacious** — then fine-tune:

- **Layout:** columns (2/3/4), A4/US Letter, page margin, space between columns — and **sheet background colour** (White, Cream, Butter, Sage, Mist, or any custom colour; white is the exact GPAI original and the tint prints too when *Background graphics* is ON).
- **Typography:** **font** — *Serif · GPAI* (Liberation Serif, the exact original), *Sans* (Liberation Sans), *Georgia*, or *Jakarta* (Plus Jakarta Sans; formulas always typeset in KaTeX) — font size, precise line spacing, **space between words**, **space after sentences** (0–0.6em; 0 is the GPAI original, ~0.25–0.3em is a subtle “double space”), **space after paragraphs**, and **body-text boldness (400–700)**. Under *More spacing*: letter spacing, list-item gap, list indentation, space before/after headings, first-line indent. Under *Emphasis & headings*: weight of `**bold**` text/table headers and heading weight, independently of body weight. Justify is a switch, and **Line flow** chooses *Hyphenate · GPAI* (words may break across lines, exactly like the original) or *Whole words* (never breaks a word — no “quanti-tative”).
- **Flow modes:** *Layout → Keep topics intact* moves a section that no longer fits in a column to the **top of the next column** instead of starting it at the column foot (sections taller than a column still split, so nothing is ever lost). For one specific section, put `<!-- keep-topic -->` on its own line above it (the ▤ button in the editor inserts it at your cursor line) — that topic then stays in one column even with the mode off. Both modes are off by default because the GPAI original hyphenates and splits freely; the exported PDF follows whatever the preview shows.
- **Content spacing:** breathing room around display formulas, table-cell padding, and section rules.
- **Page details:** footer text and page numbers.
- **Preview:** *Fit page* keeps the whole sheet visible as the window/panel changes; moving the zoom slider or pressing **100%** switches to manual zoom. Pagination is always measured at true print scale, so preview zoom never changes page breaks.

**Reset all design settings** (or the GPAI preset) restores the original look exactly: white sheet, serif, single sentence spacing, 6.5pt/1.24.

Notes: word spacing sets the base space; on justified lines the browser may stretch it further to fill the column. Sentence spacing wraps only real sentence-final words (never decimals, abbreviations followed by lowercase, code, or math) and never changes the text itself. Liberation Serif ships physical 400/700 faces, so intermediate weight values are mapped/synthesised by the browser — the 400 and 700 endpoints are exact.

## Downloading the PDF

**Export** (the button above the preview) → destination **Save as PDF**, paper **A4 or US Letter to match Layout**, **Margins: None**, **Scale: 100%**, **Background graphics ON**, **Headers/footers OFF**.
This uses the browser's print engine, so the PDF has **selectable text, vector-sharp math and working links** (deliberately *not* a rasterised screenshot-to-PDF). With default settings the output is a near-identical match to the original GPAI sheet: same font families, dominant 6.5pt text, and three-column geometry.

## How it works

1. Protect code fences/spans, then math, from the Markdown parser (in that order).
2. Marked (GFM) → DOMPurify → restore code, render math with **KaTeX**.
3. Post-process: tables → splittable wrappers, images/SVG → figures, links hardened, sentence spacing applied.
4. **Wait for images to decode**, then a deterministic paginator — always measuring at true print scale, regardless of preview zoom — packs blocks into fixed A4/Letter pages × N columns, splitting lists/paragraphs/tables (with repeated `thead`) at safe points, keeping headings with their following content, and auto-shrinking over-wide equations/tables. Split continuations don't acquire a false paragraph gap or first-line indent.
5. Print CSS (`@page`, exact page boxes) exports precisely what the preview showed.

## Deployment & redeployment

**Simplest path — GitHub + Vercel import (recommended):** push this folder's contents to a GitHub repo so that `index.html` and `vendor/` sit at the **repo root**, then import that repo at https://vercel.com/new with **Framework preset: Other** and **empty** build command, output directory, and install command. Vercel serves the static `index.html` directly — there is nothing to build. A complete, copy-paste handoff for anyone (human or AI) doing the GitHub push and Vercel import is in **`GITHUB_HANDOFF_PROMPT.md`**. The `deploy/` bundle and the existing project below are optional alternates.

**Existing live project:** https://g-note-beta.vercel.app — Vercel project **`g-note`** (zero-build static site: no server, API routes, environment variables, or install step).

The deployed files are generated from the single canonical `index.html` by **`tools/build_online.py`**, which writes `deploy/`:

- `index.html` shell + `app.css`/`sheet.css` (the one `<style>` split in original cascade order) + `app-1.js`…`app-4.js` (the one app `<script>` split at newline boundaries and reassembled by a tiny loader, so behaviour is byte-identical),
- libraries/fonts swapped to pinned CDN equivalents (KaTeX + DOMPurify hash-identical to the vendored copies; Tinos/Arimo are the metric twins of Liberation Serif/Sans),
- `manifest.json` with the SHA-1 of every file, so any deployment can be verified byte-for-byte.

**To ship an update:**

1. Edit the canonical `index.html` (and/or `vendor/`), test it locally.
2. Run `python3 tools/build_online.py` to regenerate `deploy/`.
3. Deploy `deploy/` to the existing project — either drag the folder onto the project in the Vercel dashboard, or run `vercel deploy --prod` from inside `deploy/` (project already linked server-side as `g-note`; settings: no build/install command, output directory `.`).
4. Reload https://g-note-beta.vercel.app and sanity-check the sample renders (1 page, no ⚠ badge).

`deploy/` in this folder is exactly the build produced by step 2 for the current release, so step 3 alone republishes everything here. (Automated uploads through API connectors can be refused by provider content filters for code payloads of this size; the dashboard/CLI path above is the reliable one. The live URL always serves the most recent production deployment.)

`vercel.json` in `deploy/` adds the security headers; it is not needed for local/offline use.

Two origin-related notes:

- Editor content and design settings live in `localStorage`, which is per-domain. They will **not** carry over between localhost, `file://`, and the Vercel domain — use **Save .md** first, then Import it at the other address.
- On the HTTPS URL, hotlinked `http://` images are blocked as mixed content (they are flagged in the ⚠ list). Paste images into the editor to embed them instead.

## Known limits

- **Wide tables/equations** are shrunk/wrapped into a ~60mm column; there is no "span all columns" block yet. Split very wide tables, or switch to 2 columns.
- **KaTeX ≠ full LaTeX:** no TikZ, no custom macros/packages; `\ce{}` chemistry (mhchem) is not loaded. A MathJax fallback could be added later if needed.
- **Atomic blocks** (one huge image, or a single display formula taller than a column) are placed and flagged — resize the image or break the formula with `aligned`. Very long *unbreakable text* (a pasted minified-code line, a giant single token, a long URL) is now chunked and flows across columns instead of being clipped, so it is never lost in the PDF.
- **Deeply nested lists** that are taller than a column are one atomic item and get flagged; flatten the nesting or add a manual `<!-- page-break -->` if you hit that.
- **Hotlinked images** that block hotlinking or fail to load are flagged in the ⚠ list (paste the image instead to embed it).
- Column bottoms can show small white gaps where a heading/table was kept intact — the price of never slicing content mid-block.

## Files

- `index.html` — the whole app (UI + renderer + paginator + notes/autosave/undo); the canonical source.
- `vendor/` — Marked, DOMPurify, KaTeX (JS/CSS/fonts), Liberation Serif + Sans, Plus Jakarta Sans, Playfair Display (woff2). Liberation fonts are freely licensed (SIL OFL / Liberation license); KaTeX/Marked/DOMPurify are MIT.
- `GITHUB_HANDOFF_PROMPT.md` — copy-paste instructions for pushing this app to GitHub and importing it into Vercel (Framework: Other, no build).
- `deploy/` — the generated online build (regenerate with `tools/build_online.py`; don't hand-edit). Publish it with `vercel deploy --prod` or a dashboard drag-and-drop.
- `tools/build_online.py` — turns `index.html` into `deploy/` and prints a SHA-1 manifest.
- `tools/tests/` — Playwright suites: `test_final_audit_a.py` (multi-page, multi-image, feature-collision, hostile-content), `test_final_audit_b.py` (preference matrix, import/export edges, per-note isolation, responsive 320→1500px, storage-blocked boot), plus the persistence/undo/notes/dark/images, flow-modes/UI, new-features, and deploy-build regressions. Serve the folder over `python3 -m http.server 8000` (deploy on `:8010`) and run them from `tools/tests/`.
- `vercel.json` — static-deployment headers for Vercel; not needed for local/offline use.
- `DEMO_from_tool.pdf` / `.png` — output of the built-in Unit-4 sample at GPAI defaults, produced by this tool's own print pipeline in headless Chromium.
