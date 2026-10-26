from playwright.sync_api import sync_playwright
import json

URL = "http://localhost:8000/"

TOPICS = ""
for i in range(1, 13):
    TOPICS += (f"## Topic number {i}\n"
               f"This section discusses item {i} in enough detail to occupy a meaningful part of a column, "
               f"so that the packer must decide whether the whole topic fits in the space that is left, "
               f"or whether it should travel to the next column instead of being cut in half here. "
               f"Extra sentences make the block tall enough that column boundaries fall inside some "
               f"topics when the flow mode is off, which is exactly the case the mode must repair.\n\n")

SPLIT_PROBE = """() => {
  const flat = [];
  [...document.querySelectorAll('.page')].forEach((p, pi) => [...p.querySelectorAll('.col')].forEach((c, ci) => {
    [...c.children].forEach(el => {
      if (el.classList.contains('topic-group')) [...el.children].forEach(k => flat.push({ el: k, loc: pi * 100 + ci }));
      else flat.push({ el, loc: pi * 100 + ci });
    });
  }));
  const idxs = flat.map((f, i) => (f.el.tagName === 'H2' ? i : -1)).filter(i => i >= 0);
  return idxs.map((start, n) => {
    const end = (n + 1 < idxs.length ? idxs[n + 1] : flat.length) - 1;
    return { topic: flat[start].el.textContent.slice(0, 18), split: flat[start].loc !== flat[end].loc,
             start: flat[start].loc, end: flat[end].loc };
  });
}"""

with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------- 1. toolbar / header rework + defaults ----------
    ctx = b.new_context(viewport={"width": 1500, "height": 950}); pg = ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append("console:" + m.text) if m.type == "error" else None)
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(1200)
    ui = pg.evaluate("""() => ({
      stats: document.querySelector('#stats').textContent,
      katex: document.querySelectorAll('#pages .katex').length,
      exportInToolbar: !!document.querySelector('.preview-toolbar #btn-print'),
      exportLabel: document.querySelector('.preview-toolbar #btn-print')?.textContent.trim(),
      headerExport: document.querySelectorAll('.app-header #btn-print').length,
      pageinfo: document.querySelector('#pageinfo'),
      toolbarText: document.querySelector('.preview-toolbar').innerText.trim(),
      hyphens: getComputedStyle(document.querySelector('.sheet')).hyphens })""")
    print("UI:", ui)
    assert "1,414 words" in ui["stats"] and ui["katex"] == 73 and ui["exportInToolbar"]
    assert ui["exportLabel"] == "Export" and ui["headerExport"] == 0 and ui["pageinfo"] is None
    assert ui["toolbarText"] == "Export" and ui["hyphens"] == "auto" and not errs
    pg.evaluate("window.__printed = 0; window.print = () => { window.__printed++; }")
    pg.click(".preview-toolbar #btn-print"); pg.wait_for_timeout(600)
    assert pg.evaluate("window.__printed") >= 1
    print("EXPORT CLICK OK")
    ctx.close()

    # ---------- 2. whole-words mode ----------
    ctx = b.new_context(viewport={"width": 1500, "height": 950}); pg = ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(1000)
    pg.click("#seg-hyphens button[data-value='whole']"); pg.wait_for_timeout(900)
    h1 = pg.evaluate("getComputedStyle(document.querySelector('.sheet')).hyphens")
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(1000)
    h2 = pg.evaluate("""() => ({hy: getComputedStyle(document.querySelector('.sheet')).hyphens,
        pressed: document.querySelector('#seg-hyphens button[aria-pressed=true]').dataset.value})""")
    pg.click(".preset-chip[data-preset='gpai']"); pg.wait_for_timeout(700)
    h3 = pg.evaluate("""() => ({hy: getComputedStyle(document.querySelector('.sheet')).hyphens,
        pressed: document.querySelector('#seg-hyphens button[aria-pressed=true]').dataset.value})""")
    print("WHOLE-WORDS:", h1, h2, "GPAI-reset:", h3, "errs=", errs)
    assert h1 == "none" and h2["hy"] == "none" and h2["pressed"] == "whole"
    assert h3["hy"] == "auto" and h3["pressed"] == "hyphenated" and not errs
    ctx.close()

    # ---------- 3. keep-topics-intact mode + manual tag ----------
    ctx = b.new_context(viewport={"width": 1500, "height": 950}); pg = ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(900)
    pg.fill("#editor", "# Flow doc\n\n" + TOPICS)
    pg.wait_for_timeout(1200)
    off = pg.evaluate(SPLIT_PROBE)
    pg.click("#opt-topicfit"); pg.wait_for_timeout(1400)
    on = pg.evaluate(SPLIT_PROBE)
    groups = pg.evaluate("document.querySelectorAll('.topic-group').length")
    print("TOPICFIT off splits=", sum(t['split'] for t in off), off[:4])
    print("TOPICFIT on  splits=", sum(t['split'] for t in on), "groups=", groups, on[:4], "errs=", errs)
    assert sum(t["split"] for t in off) >= 1, "test doc must cross column boundaries with mode off"
    assert sum(t["split"] for t in on) == 0 and groups == 12 and not errs
    # manual tag with the mode OFF keeps just that topic intact
    pg.click("#opt-topicfit"); pg.wait_for_timeout(1200)   # mode back off
    pg.fill("#editor", "# Flow doc\n\n" + TOPICS.replace("## Topic number 3", "<!-- keep-topic -->\n## Topic number 3"))
    pg.wait_for_timeout(1400)
    man = pg.evaluate(SPLIT_PROBE)
    t3 = [t for t in man if t["topic"].startswith("Topic number 3")]
    others_split = sum(t["split"] for t in man if not t["topic"].startswith("Topic number 3"))
    print("MANUAL TAG topic3=", t3, "others_split=", others_split)
    assert t3 and not t3[0]["split"]
    # the editor button inserts the tag at the cursor line
    pg.fill("#editor", "# Flow doc\n\n" + TOPICS)
    pg.wait_for_timeout(800)
    idx = pg.evaluate("() => document.querySelector('#editor').value.indexOf('## Topic number 5')")
    pg.evaluate("(i) => { const e = document.querySelector('#editor'); e.focus(); e.setSelectionRange(i, i); }", idx)
    pg.click("#btn-topic"); pg.wait_for_timeout(900)
    val = pg.input_value("#editor")
    line_before = val.split("## Topic number 5")[0].splitlines()[-1]
    kept5 = pg.evaluate("() => document.querySelectorAll('.topic-group[data-keep]').length")
    print("BUTTON TAG line=", repr(line_before), "kept_groups=", kept5)
    assert line_before.strip() == "<!-- keep-topic -->" and kept5 == 1 and not errs
    ctx.close()

    # ---------- 4. print PDF still perfect with both modes on ----------
    ctx = b.new_context(viewport={"width": 1500, "height": 950}); pg = ctx.new_page()
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(1000)
    pg.click("#seg-hyphens button[data-value='whole']")
    pg.click("#opt-topicfit"); pg.wait_for_timeout(1400)
    pg.emulate_media(media="print"); pg.wait_for_timeout(400)
    pg.pdf(path="/tmp/v4_modes_print.pdf", format="A4", print_background=True, scale=1.0,
           margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
    ctx.close()

    # default (modes off) print must stay the 1-page GPAI match
    ctx = b.new_context(viewport={"width": 1500, "height": 950}); pg = ctx.new_page()
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(1200)
    pg.emulate_media(media="print"); pg.wait_for_timeout(400)
    pg.pdf(path="/tmp/v4_default_print.pdf", format="A4", print_background=True, scale=1.0,
           margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
    ctx.close(); b.close()

import fitz
d = fitz.open("/tmp/v4_modes_print.pdf")
text = "".join(pg.get_text() for pg in d)
print("MODES PDF pages=", d.page_count, "words_ok=", "newton" in text.lower(), "ui_leak=", ("Export" in text))
assert d.page_count >= 1 and "Export" not in text and "newton" in text.lower()
d2 = fitz.open("/tmp/v4_default_print.pdf")
text2 = "".join(pg.get_text() for pg in d2)
fonts = sorted(set(x[3] for pg in d2 for x in pg.get_fonts(full=True)))
print("DEFAULT PDF pages=", d2.page_count, "chars=", len(text2), "fonts=", fonts[:4])
assert d2.page_count == 1 and len(text2) > 7000
print("ALL V4 (flow modes + toolbar) CHECKS PASSED")
