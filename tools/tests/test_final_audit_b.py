from playwright.sync_api import sync_playwright
import base64, json, os

URL = "http://localhost:8000/"
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=")
open("/tmp/fa.png", "wb").write(PNG)  # self-contained: don't rely on audit A having run
OVERFLOW_PROBE = """() => {
  const cols = [...document.querySelectorAll('.col')];
  const over = cols.map(c => { const l = c.lastElementChild; if (!l) return 0;
    const mb = parseFloat(getComputedStyle(l).marginBottom) || 0;
    return l.getBoundingClientRect().bottom - c.getBoundingClientRect().top + mb - c.clientHeight; });
  return { maxOver: Math.max(0, ...over), pages: document.querySelectorAll('.page').length,
           stats: document.querySelector('#stats').textContent };
}"""
DOC = ("# Matrix doc\n\n## Section 1\nParagraph one with $E=mc^2$ and enough words to flow across columns nicely.\n\n"
       "## Section 2\n- bullet with $p=mv$\n- second bullet\n\n| A | B |\n|---|---|\n| $x$ | y |\n\n"
       "## Section 3\n$$\\int_0^1 x dx = \\tfrac12$$\n\nClosing paragraph keeps the column packing honest.\n")

with sync_playwright() as p:
    b = p.chromium.launch()

    # ================= S3: preference matrix =============================================
    combos = []
    for cols in (2, 4):
        for paper in ("a4", "letter"):
            for fam in ("sans", "jakarta"):
                combos.append({"cols": cols, "paper": paper, "fontFamily": fam, "justify": False,
                               "hyphens": False, "topicFit": True, "sentenceSpacing": 0.3,
                               "sheetBg": "#eef3ec", "bodyWeight": 700, "margin": 15,
                               "zoomMode": "manual", "zoom": 1})
    for i, settings in enumerate(combos):
        ctx = b.new_context(viewport={"width": 1500, "height": 950}); pg = ctx.new_page()
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.add_init_script("localStorage.setItem('cs-studio:content:v1'," + json.dumps(DOC) + ");"
                           "localStorage.setItem('cs-studio:settings:v1'," + json.dumps(json.dumps(settings)) + ");")
        pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(1400)
        o = pg.evaluate(OVERFLOW_PROBE)
        ok_text = pg.evaluate("document.querySelector('#pages').innerText.includes('Section 3')")
        print(f"S3 combo{i} {settings['cols']}c/{settings['paper']}/{settings['fontFamily']}:", o, ok_text, errs[:2])
        assert o["maxOver"] == 0 and ok_text and not errs
        ctx.close()

    # ================= S5: import / export edges =========================================
    ctx = b.new_context(viewport={"width": 1500, "height": 950}); pg = ctx.new_page()
    pg.on("dialog", lambda d: d.accept())
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(900)
    # note with an image -> save .md with a hostile name -> re-import in a fresh context
    pg.set_input_files("#file-img", "/tmp/fa.png"); pg.wait_for_timeout(900)
    pg.fill("#note-title", "../../evil / name:with*chars"); pg.press("#note-title", "Enter"); pg.wait_for_timeout(500)
    with pg.expect_download() as dl:
        pg.click("#btn-download-md")
    d_obj = dl.value; fname = d_obj.suggested_filename
    stable = "/tmp/reimport.md"
    d_obj.save_as(stable)  # copy out of the context's temp dir before it's cleaned up on close
    mdtext = open(stable, encoding="utf-8").read()
    print("S5 filename=", repr(fname), "self_contained=", "data:image/png;base64," in mdtext)
    assert "/" not in fname and "\\" not in fname and fname.endswith(".md") and "data:image/png;base64," in mdtext
    ctx.close()
    ctx = b.new_context(viewport={"width": 1500, "height": 950}); pg = ctx.new_page()
    pg.on("dialog", lambda d: d.accept())  # accept the "Replace current content?" confirm
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(900)
    pg.set_input_files("#file-md", stable); pg.wait_for_timeout(1800)
    imp = pg.evaluate("""() => ({ imgs: document.querySelectorAll('#pages img').length,
        tags: (document.querySelector('#editor').value.match(/gnote-img:/g)||[]).length,
        blobs: (document.querySelector('#editor').value.match(/base64,/g)||[]).length })""")
    print("S5 re-import:", imp, errs[:2])
    assert imp["imgs"] == 1 and imp["tags"] == 1 and imp["blobs"] == 0 and not errs
    # image through the .md picker: refused politely
    before = pg.input_value("#editor")
    pg.set_input_files("#file-md", "/tmp/fa.png"); pg.wait_for_timeout(900)
    after = pg.input_value("#editor")
    print("S5 wrong-type import unchanged=", before == after)
    assert before == after and not errs
    # empty file
    open("/tmp/empty.md", "w").write("")
    pg.set_input_files("#file-md", "/tmp/empty.md"); pg.wait_for_timeout(1200)
    e = pg.evaluate(OVERFLOW_PROBE)
    print("S5 empty import:", e["stats"], e["pages"])
    assert e["pages"] == 1 and not errs
    # ~1 MB import (prose-only to keep KaTeX load low; exercises bulk pagination)
    para = ("Filler sentence with enough prose to weigh about five hundred bytes per block, "
            "repeated to bulk up the file for the import stress test and exercise pagination. ")
    bigmd = "# Big doc\n\n" + "".join(f"## Big {i}\n\n" + para * 3 + "\n\n" for i in range(2500))
    open("/tmp/big.md", "w").write(bigmd)
    print("S5 big.md bytes=", os.path.getsize("/tmp/big.md"))
    pg.set_input_files("#file-md", "/tmp/big.md"); pg.wait_for_timeout(20000)
    o = pg.evaluate(OVERFLOW_PROBE)
    print("S5 big import:", o, errs[:2])
    assert o["pages"] >= 5 and o["maxOver"] == 0 and not errs
    ctx.close()

    # ================= S6: persistence collisions ========================================
    ctx = b.new_context(viewport={"width": 1500, "height": 950}); pg = ctx.new_page()
    pg.on("dialog", lambda d: d.accept())
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(900)
    pg.set_input_files("#file-img", "/tmp/fa.png"); pg.wait_for_timeout(900)
    pg.click("#btn-notes"); pg.wait_for_timeout(300); pg.click("#btn-new-note"); pg.wait_for_timeout(700)
    b_tags = pg.evaluate("(document.querySelector('#editor').value.match(/gnote-img:/g)||[]).length")
    pg.click("#btn-notes"); pg.wait_for_timeout(300)
    pg.eval_on_selector_all("#notes-list .note-row-open:not([disabled])", "els => els[els.length-1].click()")
    pg.wait_for_timeout(900)
    a_tags = pg.evaluate("(document.querySelector('#editor').value.match(/gnote-img:/g)||[]).length")
    # delete the image note while on the other note
    pg.click("#btn-notes"); pg.wait_for_timeout(300)
    pg.eval_on_selector_all("#notes-list .note-row-del", "els => els[els.length-1].click()")
    pg.wait_for_timeout(700)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    alive = pg.evaluate("document.querySelectorAll('.page').length")
    print("S6 note isolation b_tags=", b_tags, "a_tags=", a_tags, "alive=", alive, errs[:2])
    assert b_tags == 0 and a_tags == 1 and alive >= 1 and not errs
    ctx.close()

    # ================= S7: responsiveness ================================================
    for w, h in [(320, 700), (390, 844), (760, 1024), (1024, 800), (1180, 900), (1500, 950)]:
        ctx = b.new_context(viewport={"width": w, "height": h}); pg = ctx.new_page()
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(1100)
        m = pg.evaluate("""() => ({ scrollX: document.documentElement.scrollWidth > innerWidth,
            exp: (() => { const r = document.querySelector('#btn-print').getBoundingClientRect();
                  return r.left >= 0 && r.right <= innerWidth && r.width > 30; })(),
            editor: !!document.querySelector('#editor').offsetParent })""")
        if w <= 1180:
            pg.click("#btn-design"); pg.wait_for_timeout(500)
            drawer = pg.evaluate("!!document.querySelector('#controls .inspector-head').offsetParent")
            pg.click("#btn-close-design"); pg.wait_for_timeout(400)
        else:
            drawer = True
        pg.click("#btn-notes"); pg.wait_for_timeout(400)
        dlg = pg.evaluate("""() => { const r = document.querySelector('#notesdlg').getBoundingClientRect();
            return r.left >= 0 && r.right <= innerWidth + 1; }""")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
        print(f"S7 {w}x{h}:", m, "drawer=", drawer, "dlg=", dlg, errs[:2])
        assert not m["scrollX"] and m["exp"] and m["editor"] and drawer and dlg and not errs
        ctx.close()

    # ================= S10: storage fully blocked ========================================
    ctx = b.new_context(viewport={"width": 1400, "height": 900}); pg = ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.add_init_script("""const g = Storage.prototype.getItem, s = Storage.prototype.setItem;
      Storage.prototype.getItem = function(){ throw new DOMException('blocked','SecurityError'); };
      Storage.prototype.setItem = function(){ throw new DOMException('blocked','SecurityError'); };""")
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(1500)
    o = pg.evaluate(OVERFLOW_PROBE)
    typed = pg.evaluate("""() => { const e = document.querySelector('#editor'); e.value += '\\n\\nstill works';
      e.dispatchEvent(new Event('input', {bubbles:true}));
      return new Promise(r => setTimeout(() => r(document.querySelector('#pages').innerText.includes('still works')), 900)); }""")
    print("S10 blocked storage:", o["stats"], o["pages"], "typed=", typed, "errs=", errs[:3])
    assert o["pages"] == 1 and typed and not errs
    ctx.close(); b.close()
print("ALL FINAL AUDIT B CHECKS PASSED")
