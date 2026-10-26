from playwright.sync_api import sync_playwright
import base64
URL = "http://localhost:8010/"
open("/tmp/tiny.png","wb").write(base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII="))
with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={"width":1500,"height":950}); pg = ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append("console:"+m.text) if m.type == "error" else None)
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_selector("#pages .page"); pg.wait_for_timeout(1500)
    st = pg.evaluate("""() => ({stats: document.querySelector('#stats').textContent,
      katex: document.querySelectorAll('#pages .katex').length,
      title: document.title, themeBtn: !!document.querySelector('#btn-theme'),
      undo: !!document.querySelector('#btn-undo')})""")
    print("DEPLOY DEFAULTS:", st, "errs:", errs)
    assert "1,414 words" in st["stats"] and st["katex"] == 73 and not errs
    # new features on the deploy variant
    pg.fill("#editor", "deploy probe one"); pg.wait_for_timeout(1200)
    pg.fill("#editor", "deploy probe two"); pg.wait_for_timeout(1200)
    pg.click("#btn-undo"); pg.wait_for_timeout(400)
    u = pg.input_value("#editor")
    pg.click("#btn-theme"); pg.wait_for_timeout(400)
    th = pg.evaluate("document.documentElement.dataset.theme")
    pg.set_input_files("#file-img", "/tmp/tiny.png"); pg.wait_for_timeout(1200)
    ed = pg.input_value("#editor")
    img = pg.evaluate("document.querySelectorAll('#pages img').length")
    print("DEPLOY FEATURES undo=", repr(u), "theme=", th, "tag=", "gnote-img:" in ed, "img=", img)
    assert u == "deploy probe one" and th == "dark" and "gnote-img:" in ed and img == 1 and not errs
    pg.emulate_media(media="print"); pg.wait_for_timeout(400)
    pg.pdf(path="/tmp/deploy_v3_print.pdf", format="A4", print_background=True, scale=1.0,
           margin={"top":"0","bottom":"0","left":"0","right":"0"})
    b.close()
import fitz
d = fitz.open("/tmp/deploy_v3_print.pdf")
txt = "".join(p.get_text() for p in d)
print("DEPLOY PRINT pages=", d.page_count, "imgs=", sum(len(p.get_images()) for p in d), "has_text=", "deploy probe" in txt)
assert d.page_count == 1 and "deploy probe" in txt
print("DEPLOY BUILD OK")
