# Handoff prompt — push "G/note." to GitHub for a Vercel import

Copy everything between the two `────` lines below and paste it to the new
AI agent that has GitHub access. Everything it needs is in this prompt.

────────────────────────────────────────────────────────────────────────────

You are going to publish a finished, self-contained static web app called
**"G/note."** to a new GitHub repository so its owner can import that repo into
Vercel with one click. The app is already built and tested. Your job is purely
to get the correct files into a GitHub repo, in the correct layout, without
changing how the app works. Follow the steps exactly and do not improvise.

## 1. What you have been given

You have a folder (or a zip that unpacks to a folder) named **`g-note`**. Inside
it, the files that actually run the deployed site are ONLY these, and they must
sit at the **root** of the repository:

- `index.html`  ← the entire application (one self-contained HTML file: all CSS
  and JS are inline). This is the site's home page.
- `vendor/`     ← a folder of third-party libraries and fonts the page loads by
  relative path (`vendor/katex.min.css`, `vendor/katex.min.js`,
  `vendor/marked.min.js`, `vendor/purify.min.js`, and `vendor/fonts/*`).
- `vercel.json` ← the static-hosting config (security headers only). Ship it as-is.
- `README.md`   ← documentation. Ship it as-is.

Everything else in the folder is optional and is NOT needed at runtime:
- `tools/` (a Python build script and Playwright test suites),
- `deploy/` (an alternate pre-split build — you do NOT need this),
- `DEMO_from_tool.pdf` / `DEMO_from_tool.png` (sample outputs),
- `.gitignore` (safe and helpful to include).

**Decision:** push the whole `g-note` folder's *contents* to the repo root. It is
fine to include `tools/`, `deploy/`, and the DEMO files — Vercel will ignore them
and only serve the root `index.html` + `vendor/`. If you prefer a minimal repo,
you may instead push only `index.html`, `vendor/`, `vercel.json`, `README.md`,
and `.gitignore`. Either choice works; do not spend long deciding.

## 2. Golden rules — do NOT do any of these

- **DO NOT edit `index.html` or anything inside `vendor/`.** Not one character.
  They are final and tested. No "clean-up", no re-formatting, no minifying, no
  renaming, no moving into a `src/` or `public/` folder.
- **DO NOT add a build step, a `package.json`, a bundler, a framework, or any
  dependency install.** This is a plain static site. There is nothing to build.
- **DO NOT rename `index.html`.** Vercel serves `index.html` as the home page;
  any other name breaks the deploy.
- **DO NOT split, merge, or reorganize the files.** Keep `vendor/` next to
  `index.html` at the repo root, exactly as given.
- **DO NOT delete `vercel.json`.**
- Keep `index.html` at the **top level of the repo** — NOT nested inside a
  sub-folder like `g-note/index.html`. When someone opens the repo, `index.html`
  must be visible immediately alongside `vendor/`.

## 3. Push to GitHub (choose the method you have access to)

The goal: a GitHub repo whose **root** contains `index.html`, `vendor/`,
`vercel.json`, and `README.md`.

### Option A — GitHub CLI (`gh`), if authenticated
```bash
cd path/to/g-note            # the folder that directly contains index.html
git init -b main
git add -A
git -c user.name="deploy-bot" -c user.email="deploy-bot@example.com" \
    commit -m "G/note. — static Markdown+LaTeX to GPAI-style cheat-sheet PDF app"
gh repo create g-note --public --source=. --remote=origin --push
```
(Use `--private` instead of `--public` if the owner asked for a private repo.
Vercel can import private repos too.)

### Option B — plain `git` + a repo you create on github.com
1. On github.com, create a new **empty** repository named `g-note`. Do NOT add a
   README, .gitignore, or license (the repo must start empty to avoid conflicts).
2. Then:
```bash
cd path/to/g-note
git init -b main
git add -A
git -c user.name="deploy-bot" -c user.email="deploy-bot@example.com" \
    commit -m "G/note. — static Markdown+LaTeX to GPAI-style cheat-sheet PDF app"
git remote add origin https://github.com/<OWNER>/g-note.git
git push -u origin main
```

### Sanity check before you finish the GitHub step
Run `git ls-files` (or look at the repo on github.com) and confirm these paths
exist at the top level:
```
index.html
vendor/katex.min.css
vendor/katex.min.js
vendor/marked.min.js
vendor/purify.min.js
vendor/fonts/            (about 30 .woff2 files)
vercel.json
README.md
```
If `index.html` shows up as `g-note/index.html` (nested), you committed from the
wrong directory — the repo root must BE the `g-note` folder's contents. Fix it so
`index.html` is at the top level.

## 4. Vercel import settings (tell the owner exactly this)

The owner will import the repo at **https://vercel.com/new**. On the
"Configure Project" screen, use these settings — they are the important part:

| Setting | Value |
|---|---|
| **Project name** | anything (e.g. `g-note`) |
| **Framework Preset** | **Other** |
| **Root Directory** | *(leave empty — the repo root)* |
| **Build Command** | *(leave empty / click the toggle to disable the auto-detected one)* |
| **Output Directory** | *(leave empty, or `.` )* |
| **Install Command** | *(leave empty / disable)* |

Then click **Deploy**. Because there is no build, Vercel simply serves the static
files: the root `index.html` becomes the home page and `vendor/…` is served at
`/vendor/…`. The deploy finishes in a few seconds.

**If Vercel auto-detects a framework or pre-fills a build command, clear it.**
There is nothing to install or build. The `vercel.json` at the repo root already
adds the correct security headers and needs no changes.

## 5. Verify it worked

Open the `https://<project>.vercel.app` URL Vercel gives you. You should see the
**G/note.** app: a Markdown/LaTeX editor on one side and a live 3-column
"GPAI-style" cheat-sheet preview on the other, pre-filled with a sample Physics
sheet (about "1,414 words · 73 formulas · 1 page"). Check that:
- the sample formulas render as proper math (this proves `vendor/` + KaTeX fonts
  loaded — if you see raw `$...$` or missing-math boxes, `vendor/` did not upload
  correctly), and
- the **Export** button above the preview opens the browser print/PDF dialog.

If the page is blank or math is missing, the most likely cause is that `vendor/`
was not pushed, or `index.html` is not at the repo root. Re-check Section 3's
sanity list.

## 6. Report back to the owner

When done, tell the owner:
1. The GitHub repo URL.
2. Confirmation that `index.html` and `vendor/` are at the repo root.
3. The exact Vercel settings you used (or the settings table above if the owner
   does the import).
4. The live Vercel URL once deployed, and that math renders + Export works.

That's the whole task. Ship the files unchanged, keep `index.html` at the repo
root, set Vercel to **Other** with no build, and you're done.

────────────────────────────────────────────────────────────────────────────
