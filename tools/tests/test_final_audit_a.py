from playwright.sync_api import sync_playwright
import base64, json, re

URL = "http://localhost:8000/"
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=")
open("/tmp/fa.png", "wb").write(PNG)

OVERFLOW_PROBE = """() => {
  const cols = [...document.querySelectorAll('.col')];
  const over = cols.map(c => { const l = c.lastElementChild; if (!l) return 0;
    const mb = parseFloat(getComputedStyle(l).marginBottom) || 0;
    return l.getBoundingClientRect().bottom - c.getBoundingClientRect().top + mb - c.clientHeight; });
  const wide = [...document.querySelectorAll('.col > *, .col .topic-group > *')].filter(el =>
    el.scrollWidth > (el.closest('.col').clientWidth + 2) && !el.querySelector('table,.katex,svg,img')).length;
  return { maxOver: Math.max(0, ...over), pages: document.querySelectorAll('.page').length,
           blank: [...document.querySelectorAll('.page')].filter(p => !p.innerText.trim()).length, wide };
}"""

with sync_playwright() as p:
    b = p.chromium.launch()

    # ================= S1: multi-page doc with everything; no missing content ============
    ctx = b.new_context(viewport={"width": 1500, "height": 950}); pg = ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append("console:" + m.text) if m.type == "error" else None)
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(900)
    doc = ["# Mega doc", ""]
    for i in range(1, 15):
        doc += [f"## Section {i} with formula $E_{{{i}}}=mc^2$",
                f"Paragraph {i} explains enough content to force realistic pagination across "
                f"several columns and pages while keeping every sentence reachable in the export.",
                "",
                f"### Sub {i}",
                "- item a with $x^2$",
                "- item b with a [link](https://example.org/" + str(i) + ")",
                "",
                "| A | B |", "|---|---|", f"| $v_{i}$ | row |", "",
                f"$$\\sum_{{k=1}}^{{{i}}} k = \\frac{{{i}({i}+1)}}{{2}}$$", ""]
        if i == 5: doc += ["<!-- column-break -->", ""]
        if i == 9: doc += ["<!-- page-break -->", ""]
    md = "\n".join(doc)
    pg.fill("#editor", md); pg.wait_for_timeout(2500)
    st = pg.evaluate(OVERFLOW_PROBE)
    heads = [f"Section {i} with formula" for i in range(1, 15)] + [f"Sub {i}" for i in range(1, 15)]
    missing = pg.evaluate("(hs) => hs.filter(h => !document.querySelector('#pages').innerText.includes(h))", heads)
    print("S1 multi-page:", st, "missing_headings=", missing, "errs=", errs[:3])
    assert st["pages"] >= 2 and st["maxOver"] == 0 and not missing and not errs
    # PDF must contain every section (no missing content in the final export)
    pg.emulate_media(media="print"); pg.wait_for_timeout(500)
    pg.pdf(path="/tmp/fa_mega.pdf", format="A4", print_background=True, scale=1.0,
           margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
    ctx.close()
    import fitz
    d = fitz.open("/tmp/fa_mega.pdf")
    ptext = "".join(pg_.get_text() for pg_ in d)
    lost = [h for h in heads if h not in ptext]
    links = sum(len(pg_.get_links()) for pg_ in d)
    print("S1 PDF pages=", d.page_count, "lost=", lost, "links=", links)
    assert d.page_count >= 2 and not lost and links >= 10

    # ================= S2: many images, persistence, undo, print =========================
    ctx = b.new_context(viewport={"width": 1500, "height": 950}); pg = ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(900)
    pg.fill("#editor", "# Gallery\n")
    for i in range(6):
        pg.set_input_files("#file-img", "/tmp/fa.png"); pg.wait_for_timeout(500)
    pg.wait_for_timeout(1500)
    g = pg.evaluate("""() => ({ tags: (document.querySelector('#editor').value.match(/gnote-img:/g)||[]).length,
        blobs: (document.querySelector('#editor').value.match(/base64,/g)||[]).length,
        imgs: document.querySelectorAll('#pages img').length })""")
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(1500)
    g2 = pg.evaluate("document.querySelectorAll('#pages img').length")
    pg.click("#btn-undo"); pg.wait_for_timeout(900)
    g3 = pg.evaluate("document.querySelectorAll('#pages img').length")
    print("S2 images:", g, "after_reload=", g2, "after_undo=", g3, "errs=", errs[:3])
    assert g["tags"] == 6 and g["blobs"] == 0 and g["imgs"] == 6 and g2 == 6 and g3 == 5 and not errs
    pg.emulate_media(media="print"); pg.wait_for_timeout(400)
    pg.pdf(path="/tmp/fa_imgs.pdf", format="A4", print_background=True, scale=1.0,
           margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
    ctx.close()
    d = fitz.open("/tmp/fa_imgs.pdf")
    nimg = sum(len(pg_.get_image_info()) for pg_ in d)  # placements, not deduped xrefs
    nuniq = sum(len(pg_.get_images()) for pg_ in d)
    print("S2 PDF image placements=", nimg, "unique xrefs=", nuniq)
    assert nimg == 5

    # ================= S4: feature collisions ============================================
    ctx = b.new_context(viewport={"width": 1500, "height": 950}); pg = ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(900)
    clash = ("# Clash\n\nIntro line.\n\n<!-- keep-topic -->\n## Kept topic\nKept body text that must stay in one column no matter what else happens here.\n\n"
             "<!-- column-break -->\n## After column break\nBody after the manual column break with a wide table.\n\n"
             "| " + " | ".join(f"C{i}" for i in range(12)) + " |\n|" + "---|" * 12 + "\n|" + " | ".join(f"v{i}" for i in range(12)) + " |\n\n"
             "<!-- page-break -->\n## After page break\n$$\\int_0^1 x^2 dx = \\tfrac13$$\n\n"
             "## Tail topic\n" + "Tail sentence number %d. " % 1 * 0 + "Tail text fills space so the packer has real work to do across the remaining columns of this page and beyond.\n")
    # 4 columns + letter + whole words + topicFit + sentence spacing + cream + jakarta
    pg.fill("#editor", clash); pg.wait_for_timeout(1000)
    pg.evaluate("""() => { const set = (id, v) => { const e = document.querySelector(id); e.value = v; e.dispatchEvent(new Event('input', {bubbles:true})); };
      document.querySelector('#seg-cols button[data-value="4"]').click();
      document.querySelector('#seg-paper button[data-value="letter"]').click();
      document.querySelector('#seg-fontfamily button[data-value="jakarta"]').click();
      document.querySelector('#seg-hyphens button[data-value="whole"]').click();
      document.querySelector('#opt-topicfit').click();
      set('#opt-sentence', '0.3'); set('#opt-margin', '15');
      document.querySelector('#sw-sheetbg .swatch[data-value="#fdf0cd"]').click(); }""")
    pg.wait_for_timeout(2000)
    c = pg.evaluate(OVERFLOW_PROBE)
    kept = pg.evaluate("""() => { const g = [...document.querySelectorAll('.topic-group[data-keep]')];
        return g.map(x => { const kids = [...x.children]; const c0 = kids[0].closest('.col');
        return kids.every(k => k.closest('.col') === c0); }); }""")
    pages = pg.evaluate("document.querySelectorAll('.page').length")
    print("S4 clash:", c, "kept_intact=", kept, "pages=", pages, "errs=", errs[:3])
    assert c["maxOver"] == 0 and pages >= 2 and kept == [True] and not errs
    # zoom fit vs manual must not change pagination (buttons live in a collapsed <details>)
    zf = pg.evaluate("document.querySelectorAll('.page').length")
    pg.evaluate("document.querySelector('#btn-zoom-100').closest('details').open = true")
    pg.click("#btn-zoom-100"); pg.wait_for_timeout(900)
    zm = pg.evaluate("document.querySelectorAll('.page').length")
    print("S4 zoom invariance:", zf, zm)
    assert zf == zm
    ctx.close()

    # ================= S8: hostile content probes ========================================
    hostile = [
        ("unclosed fence", "# H\n\n```python\nx = 1\n\nText after unclosed fence with $math$ inside."),
        ("unclosed math", "# H\n\n$$\\frac{1}{\n\nAfter."),
        ("html bomb", "# H\n\n<div><div><div><span>deep</span>\n\n<script>alert(1)</scr" + "ipt>\n\n<img src=x onerror=alert(2)> after."),
        ("deep list", "# H\n\n" + "  " * 0 + "- a\n" + "".join("  " * i + "- nested %d\n" % i for i in range(1, 40))),
        ("giant word", "# H\n\n" + "x" * 60000),
        ("wide table", "# H\n\n| " + " | ".join(f"h{i}" for i in range(200)) + " |\n|" + "---|" * 200 + "\n|" + " | ".join(str(i) for i in range(200)) + " |"),
        ("svg bomb", "# H\n\n<svg width='4000' height='90'><rect width='4000' height='90'/><use href='https://evil.example/x#y'/></svg>"),
        ("many breaks", "# H\n\n" + "<!-- page-break -->\n\n" * 12 + "end"),
    ]
    for name, content in hostile:
        ctx = b.new_context(viewport={"width": 1400, "height": 900}); pg = ctx.new_page()
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(700)
        pg.fill("#editor", content); pg.wait_for_timeout(1600)
        alive = pg.evaluate("""() => { const e = document.querySelector('#editor'); e.value += '\\n\\nprobe lives';
          e.dispatchEvent(new Event('input', {bubbles:true}));
          return new Promise(r => setTimeout(() => r(document.querySelector('#pages').innerText.includes('probe lives')), 900)); }""")
        o = pg.evaluate(OVERFLOW_PROBE)
        print(f"S8 {name}: pages={o['pages']} over={o['maxOver']} alive={alive} errs={errs[:2]}")
        assert alive and not errs
        ctx.close()
    b.close()
print("ALL FINAL AUDIT A CHECKS PASSED")
