      return '<span class="math-error" title="KaTeX error">' + escapeHtml((it.display?"$$":"$") + it.text + (it.display?"$$":"$")) + "</span>";
    }
  });
  // a display-math token standing alone became <p>…</p> — unwrap it
  html = html.replace(/<p>(<div class="math-display">[\s\S]*?<\/div>)<\/p>/g, "$1");

  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  postProcess(tmp);
  return tmp;
}

/* Extra space after sentence-ending punctuation ("double spacing", tunable).
   Wraps the sentence-final word+punctuation in .sent-end (margin-right comes
   from --sentence-gap). Only matches inside a single text node, requires the
   next sentence to start with a capital/digit/quote, and never touches
   code, pre or KaTeX. At the default 0 the rendered sheet is the untouched
   GPAI original. Text content is unchanged, so the exported PDF's text
   (and word counts) stay exact. */
function applySentenceSpacing(root){
  if (!(S.sentenceSpacing > 0)) return;
  const re = /(\S*?[.!?]+["'”’)\]]*)(\s+)(?=[A-Z0-9"“‘'(])/;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node){
      if (!node.nodeValue || !/[.!?]/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
      const p = node.parentElement;
      if (!p || p.closest("code,pre,.katex,.math-error,script,style")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  const globalRe = new RegExp(re.source, "g");
  nodes.forEach(node => {
    const text = node.nodeValue;
    if (!re.test(text)) return;
    const frag = document.createDocumentFragment();
    let last = 0, m;
    globalRe.lastIndex = 0;
    while ((m = globalRe.exec(text))){
      const wordEnd = m.index + m[1].length;
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const span = document.createElement("span");
      span.className = "sent-end";
      span.textContent = m[1];
      frag.appendChild(span);
      last = wordEnd; // the original whitespace stays as plain text in the next slice
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.replaceWith(frag);
  });
}
function postProcess(root){
  // links: new tab on screen; still clickable in PDF (same-page anchors stay same-tab)
  root.querySelectorAll("a[href]").forEach(a => {
    const href = a.getAttribute("href") || "";
    if (href.startsWith("#")) { a.removeAttribute("target"); a.removeAttribute("rel"); }
    else { a.target = "_blank"; a.rel = "noopener noreferrer"; }
  });
  // SVG <use> may reference local defs/markers only; never fetch an external document.
  root.querySelectorAll("use").forEach(u => {
    ["href", "xlink:href"].forEach(attr => {
      const value = u.getAttribute(attr);
      if (value && !value.startsWith("#")) u.removeAttribute(attr);
    });
    const xlink = u.getAttributeNS && u.getAttributeNS("http://www.w3.org/1999/xlink", "href");
    if (xlink && !xlink.startsWith("#")) u.removeAttributeNS("http://www.w3.org/1999/xlink", "href");
  });
  // images → figure (+ caption from title if present, else no forced caption)
  root.querySelectorAll("img").forEach(img => {
    img.loading = "eager"; img.decoding = "sync";
    // No load listener here: imagesReady() already waits for load before
    // pagination. Listening unconditionally made every render queue another
    // render (new <img> → load → render → …) for any document with an image.
    // an image that is the sole content of a <p> becomes a top-level <figure>
    const par = img.parentElement;
    if (par && par.tagName === "P" && par.childElementCount === 1 && !par.textContent.trim()){
      const fig = document.createElement("figure");
      par.replaceWith(fig); fig.appendChild(img);
      const cap = img.getAttribute("title");
      if (cap) { const fc = document.createElement("figcaption"); fc.textContent = cap; fig.appendChild(fc); }
    } else if (par && par.tagName !== "FIGURE") {
      const fig = document.createElement("figure");
      img.replaceWith(fig); fig.appendChild(img);
      const cap = img.getAttribute("title");
      if (cap) { const fc = document.createElement("figcaption"); fc.textContent = cap; fig.appendChild(fc); }
    }
  });
  // a lone <svg> inside a <p> becomes a figure (atomic for the paginator)
  root.querySelectorAll("p > svg").forEach(svg => {
    const p = svg.parentElement;
    // Ignore text inside the SVG itself (labels); only reject real prose around it.
    const onlySvg = p && [...p.childNodes].every(n => n === svg || (n.nodeType === 3 && !n.textContent.trim()));
    if (p && p.childElementCount === 1 && onlySvg){
      const fig = document.createElement("figure"); p.replaceWith(fig); fig.appendChild(svg);
    }
  });
  // tables → wrapper (lets the paginator split by rows)
  root.querySelectorAll("table").forEach(t => {
    if (t.parentElement && t.parentElement.classList.contains("table-wrap")) return;
    const w = document.createElement("div"); w.className = "table-wrap";
    t.replaceWith(w); w.appendChild(t);
  });
  // heading semantics: first H1 = document title; later H1s look like sections.
  // A lone short paragraph immediately before the first H1 becomes the kicker line ("G11, Phy, U4:").
  const h1s = root.querySelectorAll("h1");
  h1s.forEach((h, i) => { if (i > 0) h.classList.add("sectionlike"); });
  if (h1s.length){
    let prev = h1s[0].previousElementSibling;
    if (prev && prev.tagName === "P" && prev.textContent.trim().length <= 60) prev.classList.add("doc-kicker-line"), prev.style.marginBottom = ".1em";
  }
  applySentenceSpacing(root);
}

/* ---------------- pagination: blocks → columns → pages ---------------- */
function newPage(pagesRoot, pageNo){
  const page = document.createElement("section");
  page.className = "page";
  const cols = [];
  for (let i = 0; i < S.cols; i++){
    const c = document.createElement("div");
    c.className = "col sheet" + (S.rules ? " rules" : "") + (S.justify ? "" : " no-justify") + (S.hyphens ? "" : " no-hyphens");
    page.appendChild(c); cols.push(c);
  }
  if (S.footer || S.pageno){
    const f = document.createElement("div"); f.className = "pagefoot";
    f.innerHTML = "<span>" + escapeHtml(S.footer || "") + "</span><span>" + (S.pageno ? pageNo : "") + "</span>";
    page.appendChild(f);
  }
  pagesRoot.appendChild(page);
  return cols;
}
/* NOTE: scrollHeight of a fixed-height column is always >= clientHeight,
   so measure the real content bottom (last flow child's rect) instead. */
function contentHeight(col){
  const last = col.lastElementChild;
  if (!last) return 0;
  const mb = parseFloat(getComputedStyle(last).marginBottom) || 0;
  return last.getBoundingClientRect().bottom - col.getBoundingClientRect().top + mb;
}
const overflows = col => contentHeight(col) > col.clientHeight + 1;

/* Group sections (h2/h3/sectionlike-h1 + everything until the next such
   heading) into .topic-group wrappers. `auto` groups every topic; otherwise
   only topics tagged with a preceding <!-- keep-topic --> line (a tag with no
   heading after it groups the next single block). Break directives close the
   current group and pass through untouched. */
function groupTopics(blocks, auto){
  const isStarter = n => n.tagName === "H2" || n.tagName === "H3" || (n.tagName === "H1" && n.classList.contains("sectionlike"));
  const out = [];
  let cur = null, keep = false;
  const close = () => { if (cur){ out.push(cur); cur = null; } };
  const open = marked => { cur = document.createElement("div"); cur.className = "topic-group"; if (marked) cur.dataset.keep = "1"; };
  for (const n of blocks){
    if (n.dataset && n.dataset.break === "topic"){ keep = true; continue; }
    if (n.dataset && (n.dataset.break === "column" || n.dataset.break === "page")){ close(); out.push(n); continue; }
    if (isStarter(n) && (auto || keep)){ close(); open(keep); keep = false; cur.appendChild(n); }
    else if (cur){ cur.appendChild(n); }
    else if (keep){ open(true); keep = false; cur.appendChild(n); close(); }
    else out.push(n);
  }
  close();
  return out;
}

function paginate(contentRoot){
  // Measure at true print scale. Chromium's rect geometry under CSS `zoom`
  // is not a reliable basis for pagination; restoring the preview zoom at
  // the end keeps the visible page breaks identical to the exported PDF.
  const previewZoom = S.zoom;
  pagesEl.style.zoom = 1;
  pagesEl.innerHTML = "";
  let pageNo = 1;
  let cols = newPage(pagesEl, pageNo), ci = 0;
  const col = () => cols[ci];
  const advance = (forcePage) => {
    if (forcePage || ci >= cols.length - 1){ pageNo++; cols = newPage(pagesEl, pageNo); ci = 0; }
    else ci++;
  };
  const blocks = [...contentRoot.childNodes].filter(n => n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim()));
  // normalise stray text nodes into <p>
  let norm = blocks.map(n => {
    if (n.nodeType === 3){ const p = document.createElement("p"); p.textContent = n.textContent.trim(); return p; }
    return n;
  });
  // "Keep topics intact" mode (or explicit <!-- keep-topic --> tags): wrap each
  // section in a .topic-group so the packer can move it to a fresh column
  // whole, instead of letting it start at the foot of the current one.
  if (S.topicFit || norm.some(n => n.nodeType === 1 && n.dataset && n.dataset.break === "topic")){
    norm = groupTopics(norm, S.topicFit);
  }

  let placedBlocks = 0;
  for (let bi = 0; bi < norm.length; bi++){
    let node = norm[bi];
    // A break before any content must not manufacture a blank first column/page.
    // Later consecutive breaks are left alone (an intentional blank column/page).
    if (node.dataset && node.dataset.break === "column"){ if (placedBlocks) advance(false); continue; }
    if (node.dataset && node.dataset.break === "page"){ if (placedBlocks) advance(true); continue; }
    // keep headings with (at least the start of) what follows
    place(node, norm[bi+1]);
    placedBlocks++;
  }
  // drop a trailing empty page if breaks created one
  const allPages = [...pagesEl.querySelectorAll(".page")];
  const last = allPages[allPages.length-1];
  if (allPages.length > 1 && last && ![...last.querySelectorAll(".col")].some(c => c.childNodes.length)) last.remove();
  fitWideMath();
  pagesEl.style.zoom = previewZoom;
  updateStats();

  /* A topic enters the current column only when it fits the remaining space
     completely; otherwise it moves — whole — to the top of the next column.
     Topics taller than a full column split as usual (block by block). */
  function placeTopic(node){
    col().appendChild(node);
    if (!overflows(col())) return;
    col().removeChild(node);
    if (col().childNodes.length) advance(false);
    col().appendChild(node);
    if (!overflows(col())) return;
    col().removeChild(node);
    splitPlace(node, true);
  }

  function place(node, nextNode){
    if (node.classList && node.classList.contains("topic-group")){ placeTopic(node); return; }
    // heading keep-with-next: need heading + a little of next block in same column
    if (/^H[1-4]$/.test(node.tagName) && nextNode){
      col().appendChild(node);
      const need = 26; // px of following content
      if (contentHeight(col()) > col().clientHeight - need && col().childNodes.length > 1){
        col().removeChild(node); advance(false); col().appendChild(node);
      }
      if (overflows(col()) && col().childNodes.length > 1){ col().removeChild(node); advance(false); col().appendChild(node); }
      return;
    }
    col().appendChild(node);
    if (!overflows(col())) return;
    // doesn't fit here…
    if (col().childNodes.length === 1){
      // alone in a fresh column but still too tall → must split it in place
      col().removeChild(node);
      splitPlace(node, /*freshColumn=*/true);
      return;
    }
    col().removeChild(node);
    // try to fill the remaining space with the head of a splittable block
    if (isSplittable(node) && splitPlace(node, false)) return;
    advance(false);
    col().appendChild(node);
    if (overflows(col())){ col().removeChild(node); splitPlace(node, true); }
  }

  function isSplittable(node){
    return ["UL","OL","P","BLOCKQUOTE","PRE"].includes(node.tagName)
        || (node.classList && node.classList.contains("table-wrap"));
  }

  /* Split `node` across the current column (remainder) and following
     columns. Returns true if any part was placed. */
  function splitPlace(node, freshColumn){
    const parts = splitUnits(node);       // {shellProto, units:[Node...]} or null
    if (!parts){
      // Atomic block. In a fresh column we have no choice but to place it
      // (flagged). In a partly-filled column, decline so the caller moves
      // it to the next column instead of clipping it here.
      if (!freshColumn) return false;
      col().appendChild(node); node.classList.add("overflow-note");
      renderErrors.push("Oversized block placed without splitting: <" + node.tagName.toLowerCase() + "> " + node.textContent.trim().slice(0,80) + "…");
      return true;
    }
    let { shellProto, units } = parts;
    let placedAny = false, guard = 0, unitIndex = 0; // index, not shift(): O(n) on huge blocks
    const decorateShell = shell => {
      if (!placedAny && parts.decorateFirstShell) parts.decorateFirstShell(shell);
    };
    while (unitIndex < units.length && guard++ < 5000){
      const shell = shellProto.cloneNode(false);
      decorateShell(shell);
      if (placedAny) shell.classList.add("split-continuation");
      // for <ol> continuations keep numbering
      if (shell.tagName === "OL" && placedAny) shell.start = (shellProto._nextStart || 1);
      col().appendChild(shell);
      let took = 0;
      // Batch-append with binary refinement: overflow is monotonic as units
      // are added, so this finds the identical fill point as one-by-one
      // appending but with O(log n) forced layouts instead of one per word.
      let batch = (shell.tagName === "P" || shell.tagName === "PRE" || shell.tagName === "BLOCKQUOTE") ? 32 : 8;
      while (unitIndex < units.length){
        const n = Math.min(batch, units.length - unitIndex);
        for (let j = 0; j < n; j++) shellAppend(shell, units[unitIndex + j]);
        if (!overflows(col())){
          unitIndex += n; took += n; placedAny = true;
          batch = Math.min(batch * 2, 256);
          continue;
        }
        for (let j = n - 1; j >= 0; j--) shellRemove(shell, units[unitIndex + j]);
        if (n === 1) break;
        batch = Math.max(1, Math.floor(n / 2));
      }
      if (shell.tagName === "OL") shellProto._nextStart = (shell.start || 1) + took;
      if (!took){
        col().removeChild(shell);
        if (!freshColumn && col().childNodes.length){ advance(false); freshColumn = true; continue; }
        // single unit taller than a whole column: force-place it (flagged)
        const sh2 = shellProto.cloneNode(false);
        decorateShell(sh2);
        if (placedAny) sh2.classList.add("split-continuation");
        shellAppend(sh2, units[unitIndex++]);
        sh2.classList.add("overflow-note"); col().appendChild(sh2); placedAny = true;
        renderErrors.push("Very long item could not be split further (may overflow its column). Shorten the bullet/paragraph or add a manual break.");
        if (unitIndex < units.length) advance(false);
      } else if (unitIndex < units.length){
        shell.classList.add("split-head");
        advance(false); freshColumn = true;
      }
      if (shell.parentNode && !shellChildCount(shell)) shell.remove();
    }
    if (unitIndex < units.length) {
      renderErrors.push("A very large block could not be paginated completely; split it into smaller sections.");
    }
    return placedAny;
  }

  function shellAppend(shell, unit){
    if (shell.classList && shell.classList.contains("table-wrap")) shell.querySelector("tbody").appendChild(unit);
    else shell.appendChild(unit);
  }
  function shellRemove(shell, unit){ if (unit.parentNode) unit.parentNode.removeChild(unit); }
  function shellChildCount(shell){
    if (shell.classList && shell.classList.contains("table-wrap")) return shell.querySelectorAll("tbody tr").length;
    return shell.childNodes.length;
  }

  function splitUnits(node){
    if (node.classList && node.classList.contains("topic-group")){
      // split a too-tall topic at section-block granularity
      const units = [...node.children];
      return units.length > 1 ? { shellProto: node.cloneNode(false), units } : null;
    }
    if (node.tagName === "UL" || node.tagName === "OL"){
      const shell = node.cloneNode(false);
      const units = [...node.children].map(li => li.cloneNode(true));
      return units.length ? { shellProto: shell, units } : null;
    }
    if (node.classList && node.classList.contains("table-wrap")){
      const tbl = node.querySelector("table"); if (!tbl) return null;
      // Include footer rows: dropping <tfoot> would silently lose content when a table splits.
      const rows = [...tbl.querySelectorAll("tbody tr, tfoot tr")];
      if (!rows.length) return null; // atomic path: never let an unsplittable table vanish
      const caption = tbl.querySelector(":scope > caption");
      return {
        shellProto: makeTableShell(tbl),
        units: rows.map(r => r.cloneNode(true)),
        table:true,
        decorateFirstShell: caption ? shell => {
          const t = shell.querySelector("table");
          if (t && !t.querySelector(":scope > caption")) t.insertBefore(caption.cloneNode(true), t.firstChild);
        } : null
      };
    }
    if (node.tagName === "P" || node.tagName === "BLOCKQUOTE" || node.tagName === "PRE" || node.tagName === "FIGURE"){
      const shell = node.cloneNode(false);
      // units = child nodes; text nodes expanded word-by-word; <pre> by lines.
      // A single oversized token (long URL, minified code, huge hash) has no
      // whitespace split point, so chunk it by characters — otherwise it is one
      // unsplittable unit that overflows and gets clipped by overflow:hidden.
      let units = [];
      const CHUNK = 120;
      const pushText = txt => {
        if (!txt) return;
        if (txt.length > CHUNK){
          for (let i = 0; i < txt.length; i += CHUNK) units.push(document.createTextNode(txt.slice(i, i + CHUNK)));
        } else units.push(document.createTextNode(txt));
      };
      if (node.tagName === "PRE"){
        node.textContent.split("\n").forEach(line => pushText(line + "\n"));
      } else {
        [...node.childNodes].forEach(ch => {
          if (ch.nodeType === 3) ch.textContent.split(/(?<=\s)/).forEach(pushText);
          else units.push(ch.cloneNode(true));
        });
      }
      if (units.length < 2) return null;
      return { shellProto: shell, units };
    }
    return null;
  }
  function makeTableShell(tbl){
    const shellTbl = tbl.cloneNode(false);
    const cg = tbl.querySelector("colgroup"), th = tbl.querySelector("thead");
    if (cg) shellTbl.appendChild(cg.cloneNode(true));
    if (th) shellTbl.appendChild(th.cloneNode(true));
    shellTbl.appendChild(document.createElement("tbody"));
    const wrap = document.createElement("div"); wrap.className = "table-wrap"; wrap.appendChild(shellTbl);
    // make cloneNode(false) on the wrapper produce a fresh full shell:
    wrap.cloneNode = () => { const w = document.createElement("div"); w.className = "table-wrap"; w.appendChild(shellTbl.cloneNode(true)); return w; };
    return wrap;
  }
}

/* shrink any display equation / table wider than its column */
function fitWideMath(){
  document.querySelectorAll(".col .math-display").forEach(d => {
    d.style.fontSize = "";
    let guard = 0;
    while (d.scrollWidth > d.clientWidth + 1 && guard++ < 12){
      const cur = parseFloat(getComputedStyle(d).fontSize);
      d.style.fontSize = (cur * 0.92) + "px";
    }
  });
  // Inline formulas need the same horizontal protection; otherwise one long
  // fraction can be clipped by the fixed-width, overflow-hidden column.
  document.querySelectorAll(".col .katex").forEach(k => {
    if (k.closest(".math-display")) return;
    k.style.fontSize = "";
    const col = k.closest(".col");
    if (!col) return;
    let guard = 0;
    while (k.getBoundingClientRect().width > col.clientWidth + 1 && guard++ < 16){
      const cur = parseFloat(getComputedStyle(k).fontSize);
      if (!Number.isFinite(cur) || cur <= 1) break;
      k.style.fontSize = (cur * 0.92) + "px";
    }
  });
  document.querySelectorAll(".col table").forEach(t => {
    t.style.fontSize = "";
    let guard = 0;
    while (t.scrollWidth > t.clientWidth + 1 && guard++ < 8){
      const cur = parseFloat(getComputedStyle(t).fontSize);
      t.style.fontSize = (cur * 0.93) + "px";
    }
  });
}

/* ---------------- stats / errors ---------------- */
function updateStats(){
  const text = editor.value;
  const words = (text.match(/\S+/g) || []).length;
