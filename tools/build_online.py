#!/usr/bin/env python3
"""Build the Vercel (CDN) variant of G/note. from the canonical vendored
index.html in the project root.

Usage:  python3 tools/build_online.py
Outputs deploy/{index.html, app.css, sheet.css,
app-1.js..app-4.js, vercel.json, manifest.json}:
  - CSS split in 2 (link order = original cascade order), font srcs -> CDN
    metric twins (Tinos = Liberation Serif, Arimo = Liberation Sans),
    Jakarta/Playfair -> Fontsource statics.
  - app JS split into 4 text parts at newline boundaries; the shell loads
    them with a fetch+concat loader so single-script semantics (hoisting,
    "use strict", globals) are preserved byte-for-byte.
  - vendor <script>/<link> -> pinned jsdelivr equivalents (KaTeX + DOMPurify
    hash-identical to vendored; Marked = official 12.0.2 UMD min build).
  - the PDF engine Share loads at runtime (html2canvas + jsPDF) -> the pinned
    jsdelivr builds, since deploy/ ships without a vendor folder.
"""
from pathlib import Path
import re, hashlib, json, shutil

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'index.html'
OUT = ROOT / 'deploy'
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)

html = SRC.read_text(encoding='utf-8')

css_m = re.search(r'<style>([\s\S]*?)</style>', html)
css = css_m.group(1)
scripts = list(re.finditer(r'<script(?:[^>]*)>([\s\S]*?)</script>', html))
app_js = scripts[-1].group(1)

FS = 'https://cdn.jsdelivr.net/fontsource/fonts'
font_map = {
    'vendor/fonts/LiberationSerif-Regular.woff2':    f'{FS}/tinos@latest/latin-400-normal.woff2',
    'vendor/fonts/LiberationSerif-Bold.woff2':       f'{FS}/tinos@latest/latin-700-normal.woff2',
    'vendor/fonts/LiberationSerif-Italic.woff2':     f'{FS}/tinos@latest/latin-400-italic.woff2',
    'vendor/fonts/LiberationSerif-BoldItalic.woff2': f'{FS}/tinos@latest/latin-700-italic.woff2',
    'vendor/fonts/LiberationSans-Regular.woff2':     f'{FS}/arimo@latest/latin-400-normal.woff2',
    'vendor/fonts/LiberationSans-Bold.woff2':        f'{FS}/arimo@latest/latin-700-normal.woff2',
    'vendor/fonts/LiberationSans-Italic.woff2':      f'{FS}/arimo@latest/latin-400-italic.woff2',
    'vendor/fonts/LiberationSans-BoldItalic.woff2':  f'{FS}/arimo@latest/latin-700-italic.woff2',
}
for local, cdn in font_map.items():
    assert local in css, local
    css = css.replace(local, cdn)

jakarta_old = '@font-face{font-family:"Plus Jakarta Sans";src:url("vendor/fonts/PlusJakartaSans-Variable.woff2") format("woff2");font-weight:200 800;font-style:normal;font-display:swap}'
jakarta_new = '\n'.join(
    f'@font-face{{font-family:"Plus Jakarta Sans";src:url("{FS}/plus-jakarta-sans@latest/latin-{w}-normal.woff2") format("woff2");font-weight:{w};font-style:normal;font-display:swap}}'
    for w in (400, 600, 700, 800))
assert jakarta_old in css
css = css.replace(jakarta_old, jakarta_new)

playfair_old = '@font-face{font-family:"Playfair Display";src:url("vendor/fonts/PlayfairDisplay-Italic-Variable.woff2") format("woff2");font-weight:400 900;font-style:italic;font-display:swap}'
playfair_new = '\n'.join(
    f'@font-face{{font-family:"Playfair Display";src:url("{FS}/playfair-display@latest/latin-{w}-italic.woff2") format("woff2");font-weight:{w};font-style:italic;font-display:swap}}'
    for w in (500, 600))
assert playfair_old in css
css = css.replace(playfair_old, playfair_new)
assert 'vendor/' not in css

marker = '/* ============================= Preview canvas'
idx = css.index(marker)
app_css, sheet_css = css[:idx], css[idx:]
(OUT / 'app.css').write_text(app_css, encoding='utf-8')
(OUT / 'sheet.css').write_text(sheet_css, encoding='utf-8')

# --- split app JS into 4 parts at newline boundaries -----------------------
targets = [len(app_js) * i // 4 for i in (1, 2, 3)]
cuts = []
for t in targets:
    nl = app_js.index('\n', t) + 1
    cuts.append(nl)
parts = [app_js[:cuts[0]], app_js[cuts[0]:cuts[1]], app_js[cuts[1]:cuts[2]], app_js[cuts[2]:]]
assert ''.join(parts) == app_js

# Share loads its PDF engine at runtime from vendor/; the CDN build has no
# vendor folder, so point those two paths at the pinned jsdelivr builds.
lib_map = {
    'vendor/html2canvas.min.js': 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
    'vendor/jspdf.umd.min.js':   'https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js',
}
def _cdn(part):
    for local, cdn in lib_map.items():
        part = part.replace(local, cdn)
    return part
parts_cdn = [_cdn(part) for part in parts]
assert all('vendor/' not in part.replace('vendor/ folder is deployed', '') for part in parts_cdn), \
    'vendor lib path left in the CDN build'
for i, part in enumerate(parts_cdn, 1):
    (OUT / f'app-{i}.js').write_text(part, encoding='utf-8')

# --- shell -------------------------------------------------------------------
# Slice the <style> block out FIRST (offsets are from the original html);
# length-changing string replaces must come afterwards.
shell = html[:css_m.start()] + '<link rel="stylesheet" href="app.css">\n<link rel="stylesheet" href="sheet.css">' + html[css_m.end():]
shell = shell.replace('<link rel="stylesheet" href="vendor/katex.min.css">',
                      '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">')
shell = shell.replace('<script src="vendor/marked.min.js"></script>',
                      '<script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/lib/marked.umd.min.js"></script>')
shell = shell.replace('<script src="vendor/purify.min.js"></script>',
                      '<script src="https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js"></script>')
shell = shell.replace('<script src="vendor/katex.min.js"></script>',
                      '<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>')
scripts2 = list(re.finditer(r'<script(?:[^>]*)>([\s\S]*?)</script>', shell))
last = scripts2[-1]
assert last.group(1) == app_js
loader = '''<script>
/* G/note. online build: the app code ships as 4 text parts (byte-identical
   to the single <script> in the downloadable offline build). Fetch, join
   and run them as one script so semantics are exactly preserved. */
(async () => {
  try {
    let code = "";
    for (const part of ["app-1.js", "app-2.js", "app-3.js", "app-4.js"]) {
      const r = await fetch(part);
      if (!r.ok) throw new Error("Could not load " + part + " (" + r.status + ")");
      code += await r.text();
    }
    const s = document.createElement("script");
    s.textContent = code;
    document.body.appendChild(s);
  } catch (e) {
    const d = document.createElement("div");
    d.className = "fatal-error";
    d.setAttribute("role", "alert");
    d.innerHTML = "<strong>G/note. could not finish loading.</strong>" +
      String((e && e.message) || e) + " Check your connection and reload.";
    (document.getElementById("pages") || document.body).appendChild(d);
  }
})();
</script>'''
shell = shell[:last.start()] + loader + shell[last.end():]
assert 'vendor/' not in shell.replace('vendor/ folder is deployed', ''), 'vendor ref left in shell'
(OUT / 'index.html').write_text(shell, encoding='utf-8')
(OUT / 'vercel.json').write_bytes((ROOT / 'vercel.json').read_bytes())

print(f"{'file':<14} {'bytes':>8}  sha1 (vercel digest)")
manifest = {}
for p in sorted(OUT.iterdir()):
    data = p.read_bytes()
    digest = hashlib.sha1(data).hexdigest()
    manifest[p.name] = {'bytes': len(data), 'sha1': digest}
    print(f"{p.name:<14} {len(data):>8}  {digest}")
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2))
print('app.js reassembled == original:', ''.join(parts) == app_js)
