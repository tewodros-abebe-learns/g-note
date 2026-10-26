from playwright.sync_api import sync_playwright
import base64

URL = "http://localhost:8000/"
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=")
open("/tmp/tiny.png", "wb").write(PNG)

with sync_playwright() as p:
    b = p.chromium.launch()

    # ---- A. image tags inside code must stay literal; undo/redo across an image insert ----
    ctx = b.new_context(viewport={"width": 1500, "height": 950}); pg = ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("dialog", lambda d: d.accept())
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(900)
    pg.fill("#editor", "# t\n\n```\n![x](gnote-img:abc123)\n```\n\nand `![y](gnote-img:zzz)` inline.")
    pg.wait_for_timeout(900)
    guard = pg.evaluate("""() => ({imgs: document.querySelectorAll('#pages img').length,
        pre: document.querySelector('#pages pre')?.textContent || '', code: document.querySelector('#pages p code')?.textContent || ''})""")
    print("CODE-GUARD:", guard)
    assert guard["imgs"] == 0 and "gnote-img:abc123" in guard["pre"] and "gnote-img:zzz" in guard["code"]
    # unknown ref (never stored) must degrade to a listed rendering problem, not a crash
    pg.fill("#editor", "# t\n\n![ghost](gnote-img:notstored1)\n\nAfter.")
    pg.wait_for_timeout(900)
    ghost = pg.evaluate("""() => ({badge: document.querySelector('#errbadge').textContent,
        imgs: document.querySelectorAll('#pages img').length, text: document.querySelector('#pages').innerText.includes('After.')})""")
    print("GHOST-REF:", ghost)
    assert "rendering problem" in ghost["badge"] and ghost["text"] and not errs
    # undo/redo across a real image insertion
    pg.fill("#editor", "# t\n\nbefore image")
    pg.wait_for_timeout(1200)
    pg.set_input_files("#file-img", "/tmp/tiny.png"); pg.wait_for_timeout(1000)
    with_tag = pg.input_value("#editor")
    pg.click("#btn-undo"); pg.wait_for_timeout(500)
    undone = pg.input_value("#editor")
    pg.click("#btn-redo"); pg.wait_for_timeout(500)
    redone = pg.input_value("#editor")
    print("IMG-UNDO tag=", "gnote-img:" in with_tag, "undone_clean=", "gnote-img:" not in undone, "redone=", redone == with_tag)
    assert "gnote-img:" in with_tag and "gnote-img:" not in undone and redone == with_tag
    ctx.close()

    # ---- B. history is per-note (no cross-note leaks) ----
    ctx = b.new_context(viewport={"width": 1500, "height": 950}); pg = ctx.new_page()
    pg.on("dialog", lambda d: d.accept())
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(900)
    pg.fill("#editor", "note A draft one"); pg.wait_for_timeout(1200)
    pg.fill("#editor", "note A draft two"); pg.wait_for_timeout(1200)
    pg.click("#btn-notes"); pg.wait_for_timeout(300); pg.click("#btn-new-note"); pg.wait_for_timeout(600)
    undo_disabled_fresh = pg.is_disabled("#btn-undo")
    pg.fill("#editor", "note B first"); pg.wait_for_timeout(1200)
    pg.fill("#editor", "note B second"); pg.wait_for_timeout(1200)
    pg.click("#btn-undo"); pg.wait_for_timeout(400)
    b_val = pg.input_value("#editor")
    pg.click("#btn-notes"); pg.wait_for_timeout(300)
    pg.eval_on_selector_all("#notes-list .note-row-open:not([disabled])", "els => els[els.length-1].click()")
    pg.wait_for_timeout(900)
    a_val = pg.input_value("#editor")
    a_undo = not pg.is_disabled("#btn-undo")
    pg.click("#btn-undo"); pg.wait_for_timeout(400)
    a_undone = pg.input_value("#editor")
    print("PER-NOTE-HISTORY fresh_disabled=", undo_disabled_fresh, "b=", repr(b_val), "a=", repr(a_val), "a_undo=", a_undo, "a_undone=", repr(a_undone), "errs=", errs)
    assert undo_disabled_fresh and b_val == "note B first" and a_val == "note A draft two" and a_undo and a_undone == "note A draft one" and not errs
    ctx.close()

    # ---- C. XSS-safe note titles + storage-failure fallback for images ----
    ctx = b.new_context(viewport={"width": 1500, "height": 950}); pg = ctx.new_page()
    pg.on("dialog", lambda d: d.accept())
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.add_init_script("""window.__x = 0;
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function(k, v){ if (k === 'cs-studio:images:v1') throw new DOMException('full','QuotaExceededError'); return orig.call(this, k, v); };
      const oo = window.indexedDB.open.bind(window.indexedDB);
      window.indexedDB.open = () => { throw new Error('IDB disabled for test'); };""")
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(900)
    pg.set_input_files("#file-img", "/tmp/tiny.png"); pg.wait_for_timeout(1200)
    ed = pg.input_value("#editor")
    imgs = pg.evaluate("document.querySelectorAll('#pages img').length")
    print("STORAGE-FALLBACK inline_blob=", "data:image/png;base64," in ed, "renders=", imgs, "xss=", pg.evaluate("window.__x"))
    assert "data:image/png;base64," in ed and imgs == 1
    pg.fill("#note-title", '"><svg onload="window.__x=1">'); pg.press("#note-title", "Enter"); pg.wait_for_timeout(400)
    pg.click("#btn-notes"); pg.wait_for_timeout(400)
    xss = pg.evaluate("window.__x")
    rows = pg.evaluate("document.querySelectorAll('#notes-list .note-row').length")
    print("TITLE-XSS x=", xss, "rows=", rows, "errs=", errs)
    assert xss == 0 and rows == 1 and not errs
    ctx.close()

    # ---- D. mobile layout with the new header buttons + dialog usability ----
    for w, h, name in [(390, 844, "mobile"), (820, 1180, "tablet")]:
        ctx = b.new_context(viewport={"width": w, "height": h}); pg = ctx.new_page()
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(1000)
        m = pg.evaluate("""() => { const hd = document.querySelector('.app-header').getBoundingClientRect();
          const ph = document.querySelector('.pane-head').getBoundingClientRect();
          return {headerRight: hd.right, headerW: hd.width, paneHeadH: ph.height,
                  scrollX: document.documentElement.scrollWidth > innerWidth,
                  titleVisible: !!document.querySelector('#note-title').offsetParent}; }""")
        pg.click("#btn-notes"); pg.wait_for_timeout(400)
        dlg = pg.evaluate("""() => { const d = document.querySelector('#notesdlg').getBoundingClientRect();
          return {left: d.left, right: d.right, w: d.width, vw: innerWidth}; }""")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
        print(f"LAYOUT {name}:", m, dlg, "errs=", errs)
        assert not m["scrollX"] and dlg["left"] >= 0 and dlg["right"] <= dlg["vw"] + 1 and not errs
        if name == "mobile":
            pg.screenshot(path="/tmp/v3_mobile_dark.png")
        ctx.close()

    # ---- E. screenshots: light + dark desktop ----
    ctx = b.new_context(viewport={"width": 1500, "height": 950}); pg = ctx.new_page()
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(1400)
    pg.screenshot(path="/tmp/v3_light.png")
    pg.click("#btn-theme"); pg.wait_for_timeout(600)
    pg.screenshot(path="/tmp/v3_dark.png")
    pg.click("#btn-notes"); pg.wait_for_timeout(500)
    pg.screenshot(path="/tmp/v3_dark_notes.png")
    ctx.close(); b.close()
print("ALL V3B AUDIT CHECKS PASSED")
