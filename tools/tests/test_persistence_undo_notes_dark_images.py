from playwright.sync_api import sync_playwright
import base64, json

URL = "http://localhost:8000/"
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=")
open("/tmp/tiny.png", "wb").write(PNG)

with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------- 1. persistence across refresh (content + name) ----------
    ctx = b.new_context(viewport={"width": 1500, "height": 950}); pg = ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(900)
    title0 = pg.input_value("#note-title")
    pg.fill("#editor", "# Persistence probe\n\nWords that must survive a refresh: alpha, beta, gamma.")
    pg.fill("#note-title", "Physics revision"); pg.press("#note-title", "Enter"); pg.wait_for_timeout(600)
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(1200)
    got = pg.input_value("#editor"); t = pg.input_value("#note-title")
    print("PERSIST-REFRESH content_ok=", "alpha, beta, gamma" in got, "title=", repr(t), "boot_title=", repr(title0), "errs=", errs)
    assert "alpha, beta, gamma" in got and t == "Physics revision" and title0.startswith("Unit 4")
    # immediate refresh (no settle time) must not lose the keystroke either
    pg.fill("#editor", got + "\n\nimmediate-flush line 991")
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(900)
    got2 = pg.input_value("#editor")
    print("INSTANT-REFRESH ok=", "immediate-flush line 991" in got2)
    assert "immediate-flush line 991" in got2

    # ---------- 2. undo / redo (3 steps each way, persisted) ----------
    for s in ["one apple", "one apple two", "one apple two three", "one apple two three four"]:
        pg.fill("#editor", s); pg.wait_for_timeout(1200)
    assert not pg.is_disabled("#btn-undo") and pg.is_disabled("#btn-redo")
    seq = []
    for _ in range(3):
        pg.click("#btn-undo"); pg.wait_for_timeout(300); seq.append(pg.input_value("#editor"))
    print("UNDO SEQ:", seq, "undo_disabled_after_3=", pg.is_disabled("#btn-undo"))
    assert seq == ["one apple two three", "one apple two", "one apple"]
    assert pg.is_disabled("#btn-undo")          # cap = 3 steps backwards
    rs = []
    for _ in range(3):
        pg.click("#btn-redo"); pg.wait_for_timeout(250); rs.append(pg.input_value("#editor"))
    print("REDO SEQ:", rs, "redo_disabled_after_3=", pg.is_disabled("#btn-redo"))
    assert rs == ["one apple two", "one apple two three", "one apple two three four"]
    assert pg.is_disabled("#btn-redo")          # cap = 3 steps forwards
    # keyboard + persistence of the stacks across reload
    pg.click("#btn-undo"); pg.wait_for_timeout(250)          # -> ...three
    pg.click("#btn-undo"); pg.wait_for_timeout(250)          # -> ...two
    pg.focus("#editor"); pg.keyboard.press("Control+z"); pg.wait_for_timeout(300)   # -> ...one
    after_kb = pg.input_value("#editor")
    print("KB-UNDO:", repr(after_kb))
    assert after_kb == "one apple"
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(1000)
    persisted = pg.input_value("#editor")
    redo_on = not pg.is_disabled("#btn-redo")
    pg.click("#btn-redo"); pg.wait_for_timeout(300)
    after_reload_redo = pg.input_value("#editor")
    print("HISTORY-PERSIST editor=", repr(persisted), "redo_enabled=", redo_on, "after_redo=", repr(after_reload_redo))
    assert persisted == "one apple" and redo_on and after_reload_redo == "one apple two"
    ctx.close()

    # ---------- 3. notes library: create / switch / rename / delete ----------
    ctx = b.new_context(viewport={"width": 1500, "height": 950}); pg = ctx.new_page()
    pg.on("dialog", lambda d: d.accept())
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(900)
    pg.click("#btn-notes"); pg.wait_for_timeout(300)
    rows1 = pg.evaluate("document.querySelectorAll('#notes-list .note-row').length")
    pg.click("#btn-new-note"); pg.wait_for_timeout(500)
    empty = pg.input_value("#editor") == "" and pg.input_value("#note-title") == "Untitled note"
    pg.fill("#editor", "# Note B\n\nSecond note content with $E=mc^2$.")
    pg.fill("#note-title", "Relativity"); pg.press("#note-title", "Enter"); pg.wait_for_timeout(500)
    pg.click("#btn-notes"); pg.wait_for_timeout(300)
    rows2 = pg.evaluate("document.querySelectorAll('#notes-list .note-row').length")
    titles = pg.eval_on_selector_all("#notes-list .note-row-title", "els => els.map(e => e.value)")
    # switch back to the sample note (the row that is NOT current)
    pg.eval_on_selector_all("#notes-list .note-row-open:not([disabled])", "els => els[els.length-1].click()")
    pg.wait_for_timeout(900)
    back_title = pg.input_value("#note-title"); back_len = len(pg.input_value("#editor"))
    print("NOTES rows1=", rows1, "rows2=", rows2, "titles=", titles, "back=", repr(back_title), back_len, "new_empty=", empty)
    assert rows1 == 1 and rows2 == 2 and empty and back_len > 1000 and back_title != "Relativity"
    # switch to note B again, then delete the other note from the dialog
    pg.click("#btn-notes"); pg.wait_for_timeout(300)
    pg.eval_on_selector_all("#notes-list .note-row-open:not([disabled])", "els => els[els.length-1].click()")
    pg.wait_for_timeout(900)
    b_title = pg.input_value("#note-title")
    pg.click("#btn-notes"); pg.wait_for_timeout(300)
    # delete the OTHER note deterministically (list is sorted by `updated`, so a
    # positional pick is timing-sensitive). Current note is "Relativity"; drop the rest.
    pg.eval_on_selector_all("#notes-list .note-row:not(.current) .note-row-del", "els => els[0].click()")
    pg.wait_for_timeout(500)
    rows3 = pg.evaluate("document.querySelectorAll('#notes-list .note-row').length")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(1000)
    after = pg.input_value("#note-title")
    print("NOTES-DELETE b_title=", repr(b_title), "rows3=", rows3, "after_reload=", repr(after), "errs=", errs)
    assert b_title == "Relativity" and rows3 == 1 and after == "Relativity" and not errs
    ctx.close()

    # ---------- 4. dark mode ----------
    ctx = b.new_context(viewport={"width": 1500, "height": 950}); pg = ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(900)
    pg.click("#btn-theme"); pg.wait_for_timeout(500)
    dark = pg.evaluate("""() => ({theme: document.documentElement.dataset.theme,
        body: getComputedStyle(document.body).backgroundColor,
        editor: getComputedStyle(document.querySelector('#editor')).backgroundColor,
        page: getComputedStyle(document.querySelector('.page')).backgroundColor,
        header: getComputedStyle(document.querySelector('.app-header')).backgroundImage.slice(0,40),
        pressed: document.querySelector('#btn-theme').getAttribute('aria-pressed')})""")
    print("DARK:", dark)
    assert dark["theme"] == "dark" and dark["body"] == "rgb(21, 17, 11)" and dark["page"] == "rgb(255, 255, 255)"
    assert "gradient" in dark["header"] and dark["pressed"] == "true"
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(900)
    still = pg.evaluate("document.documentElement.dataset.theme")
    pg.emulate_media(media="print"); pg.wait_for_timeout(300)
    printed = pg.evaluate("""() => ({body: getComputedStyle(document.body).backgroundColor,
        header: getComputedStyle(document.querySelector('.app-header')).display})""")
    print("DARK-PERSIST:", still, "PRINT:", printed)
    assert still == "dark" and printed["body"] == "rgb(255, 255, 255)" and printed["header"] == "none"
    pg.emulate_media(media="screen"); pg.click("#btn-theme"); pg.wait_for_timeout(400)
    light = pg.evaluate("document.documentElement.dataset.theme")
    assert light == "light" and not errs
    ctx.close()

    # ---------- 5. images: tag in editor, real image in preview/PDF, survives reload ----------
    ctx = b.new_context(viewport={"width": 1500, "height": 950}); pg = ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(900)
    before_len = len(pg.input_value("#editor"))
    pg.set_input_files("#file-img", "/tmp/tiny.png"); pg.wait_for_timeout(1200)
    ed = pg.input_value("#editor")
    img = pg.evaluate("""() => [...document.querySelectorAll('#pages img')].map(i => ({nw: i.naturalWidth, h: i.getBoundingClientRect().height}))""")
    tag_ok = "gnote-img:" in ed and "base64," not in ed and (len(ed) - before_len) < 100
    print("IMG editor_tag=", tag_ok, "delta=", len(ed) - before_len, "preview=", img)
    assert tag_ok and img and img[0]["nw"] > 0
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(1200)
    img2 = pg.evaluate("document.querySelectorAll('#pages img').length")
    ed2 = pg.input_value("#editor")
    print("IMG-RELOAD count=", img2, "tag_still_short=", "base64," not in ed2)
    assert img2 == 1 and "base64," not in ed2
    # Save .md must expand the tag back into a self-contained file
    with pg.expect_download() as dl:
        pg.click("#btn-download-md")
    path = dl.value.path()
    mdtext = open(path, encoding="utf-8").read()
    print("MD-EXPORT expanded=", "data:image/png;base64," in mdtext, "name=", dl.value.suggested_filename)
    assert "data:image/png;base64," in mdtext
    # and the printed PDF contains the image
    pg.emulate_media(media="print"); pg.wait_for_timeout(400)
    pg.pdf(path="/tmp/v3_img_print.pdf", format="A4", print_background=True, scale=1.0,
           margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
    import fitz
    d = fitz.open("/tmp/v3_img_print.pdf")
    nimg = sum(len(pg_.get_images()) for pg_ in d)
    print("IMG-PDF pages=", d.page_count, "images=", nimg, "errs=", errs)
    assert nimg >= 1 and not errs
    ctx.close()

    # ---------- 6. corrupt notes/history stores must not break boot ----------
    ctx = b.new_context(viewport={"width": 1500, "height": 950}); pg = ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.add_init_script("localStorage.setItem('cs-studio:notes:v1','{broken');localStorage.setItem('cs-studio:history:v1','[1,2]');localStorage.setItem('cs-studio:content:v1','# Recovered\\n\\nStill here.')")
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(1000)
    ed = pg.input_value("#editor"); ti = pg.input_value("#note-title")
    print("CORRUPT-STORES editor=", repr(ed[:30]), "title=", repr(ti), "errs=", errs)
    assert "Still here." in ed and ti == "Recovered" and not errs
    ctx.close(); b.close()
print("ALL V3 (persistence/undo/notes/dark/images) CHECKS PASSED")
