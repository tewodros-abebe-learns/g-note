  const formulas = document.querySelectorAll("#pages .katex").length;
  const pgs = document.querySelectorAll("#pages .page").length;
  $("#stats").innerHTML = "<b>" + words.toLocaleString() + "</b> words · <b>" + formulas + "</b> formulas · <b>" + pgs + "</b> page" + (pgs===1?"":"s");
  const pageInfoEl = $("#pageinfo");
  if (pageInfoEl) pageInfoEl.textContent = pgs + " page" + (pgs===1?"":"s") + " · " + S.cols + " columns · " + (S.paper==="letter"?"US Letter":"A4");
  const lines = text ? text.split("\n").length : 0;
  const meta = $("#editor-meta");
  if (meta) meta.textContent = lines.toLocaleString() + " line" + (lines===1?"":"s");
  const badge = $("#errbadge");
  if (renderErrors.length){ badge.style.display = "inline-block"; badge.textContent = "⚠ " + renderErrors.length + " rendering problem" + (renderErrors.length===1?"":"s"); }
  else badge.style.display = "none";
  syncHeaderHeight();
}
$("#errbadge").addEventListener("click", () => {
  $("#errlist").innerHTML = renderErrors.map(e => "<li>" + escapeHtml(e) + "</li>").join("");
  $("#errors").showModal();
});
$("#btn-close-errors").addEventListener("click", () => $("#errors").close());

/* ---------------- render driver ---------------- */
let debounce = null;
/* Wait for images to decode BEFORE paginating — otherwise a not-yet-loaded
   image measures as 0px tall, gets placed at a column bottom, and is then
   clipped when its real height arrives. (Classic paste-to-print bug.) */
async function imagesReady(root, errors, isCurrent){
  const imgs = [...root.querySelectorAll("img")];
  const stillCurrent = () => !isCurrent || isCurrent();
  await Promise.all(imgs.map(async img => {
    if (img.complete && img.naturalWidth) return;
    const ev = new Promise(r => { img.addEventListener("load", r, {once:true}); img.addEventListener("error", r, {once:true}); });
    const dec = (img.decode ? img.decode().catch(() => {}) : Promise.resolve());
    const finished = await Promise.race([
      Promise.all([ev, dec]).then(() => true),
      new Promise(r => setTimeout(() => r(false), 2500))
    ]);
    if (!stillCurrent()) return;
    if (!finished){
      // We paginate provisionally now; refresh exactly once when this slow
      // image actually arrives (normal-speed images never take this path).
      if (img.complete && img.naturalWidth) queueRepaginate();
      else if (!img.complete) img.addEventListener("load", () => { if (stillCurrent()) queueRepaginate(); }, { once:true });
    }
    if (!img.naturalWidth){
      const src = (img.getAttribute("src") || "").slice(0, 90);
      errors.push((finished || img.complete)
        ? "Image failed to load (check the URL or re-paste it): " + src
        : "Image is still loading; the preview will refresh when it arrives: " + src);
    }
  }));
}
let renderSequence = 0;
async function renderNow(){
  const mySequence = ++renderSequence;
  await IMG_READY;   // embedded-image tags resolve against the loaded browser store
  if (mySequence !== renderSequence) return false;
  const myErrors = [];
  const root = renderMarkdown(editor.value || "", myErrors);
  await imagesReady(root, myErrors, () => mySequence === renderSequence);
  if (mySequence !== renderSequence) return false; // a newer edit superseded this render
  renderErrors = myErrors;
  try {
    paginate(root);
  } finally {
    pagesEl.style.zoom = S.zoom; // paginate measures at zoom 1; always restore, even on error
  }
  return true;
}
function showFatalError(error){
  const message = error && error.message ? error.message : String(error || "Unknown render error");
  renderErrors = [message];
  pagesEl.style.zoom = 1;
  pagesEl.innerHTML = '<div class="fatal-error" role="alert"><strong>The preview could not be rendered.</strong>' +
    escapeHtml(message) + '<br>Your editor content is untouched. Fix the problem above, then edit or reload to render again.</div>';
  try { updateStats(); } catch(_){}
}
function reportRenderError(error){
  console.error(error);
  showFatalError(error);
  try { toast("Render error: " + (error && error.message ? error.message : error)); } catch(_){}
}
function queueRender(){
  clearTimeout(debounce);
  debounce = setTimeout(async () => {
    debounce = null;
    try { await renderNow(); } catch(e) { reportRenderError(e); }
  }, 220);
}
async function flushRender(){
  if (debounce){ clearTimeout(debounce); debounce = null; }
  await renderNow();
}
function queueRepaginate(){
  if (repaginateQueued) return; repaginateQueued = true;
  setTimeout(() => { repaginateQueued = false; queueRender(); }, 60);
}
editor.addEventListener("input", () => { saveContent(); histNoteInput(); queueRender(); });
document.getElementById("controls").addEventListener("input", e => {
  if (e.target && e.target.id === "opt-zoom") S.zoomMode = "manual";
  readControls(); queueRender();
});
document.getElementById("controls").addEventListener("change", () => { readControls(); queueRender(); });
window.addEventListener("resize", () => { syncHeaderHeight(); applyCSSVars(); queueRepaginate(); });

/* ---------------- design panel interactions ---------------- */
function syncHeaderHeight(){
  const header = $(".app-header");
  if (header) document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
}
function setDesignOpen(open, persist = true){
  document.body.classList.toggle("design-closed", !open);
  const btn = $("#btn-design");
  if (btn) btn.setAttribute("aria-expanded", String(open));
  const panel = $("#controls");
  if (panel) panel.inert = !open;
  if (persist) {
    lsSet("cheatsheet-studio.design", open ? "open" : "closed");
  }
  requestAnimationFrame(() => { syncHeaderHeight(); applyCSSVars(); queueRepaginate(); });
}
$("#btn-design").addEventListener("click", () => {
  setDesignOpen(document.body.classList.contains("design-closed"));
});
const closeDesignBtn = $("#btn-close-design");
if (closeDesignBtn) closeDesignBtn.addEventListener("click", () => setDesignOpen(false));
syncHeaderHeight();
try {
  const designPref = lsGet("cheatsheet-studio.design");
  if (designPref === "closed" || (designPref === null && window.matchMedia("(max-width: 1180px)").matches)) {
    setDesignOpen(false, false);
  } else if (designPref === "open") {
    setDesignOpen(true, false);
  }
} catch(e) {}

document.querySelectorAll(".segmented").forEach(group => {
  group.addEventListener("click", e => {
    const btn = e.target.closest("button[data-value]");
    if (!btn) return;
    group.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === btn ? "true" : "false"));
    readControls(); queueRender();
  });
});

document.querySelectorAll("#sw-sheetbg .swatch[data-value]").forEach(btn => {
  btn.addEventListener("click", () => setSettings({ sheetBg: btn.dataset.value }, false));
});
const sheetBgCustom = $("#opt-sheetbg-custom");
if (sheetBgCustom) sheetBgCustom.addEventListener("input", () => setSettings({ sheetBg: sheetBgCustom.value }, false));

document.querySelectorAll(".preset-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    const preset = STYLE_PRESETS[chip.dataset.preset];
    if (!preset) return;
    setSettings({ ...preset });
    toast(chip.textContent.trim() + " preset applied");
  });
});

$("#btn-reset-style").addEventListener("click", () => {
  if (!confirm("Reset all design settings to the GPAI defaults? Your content and footer text will be kept.")) return;
  setSettings({ ...defaultSettings, footer: S.footer, zoom: S.zoom, zoomMode: S.zoomMode, uiTheme: S.uiTheme });
  toast("Design reset to GPAI defaults");
});

$("#btn-fit").addEventListener("click", () => {
  setSettings({ zoomMode:"fit", zoom: calculateFitZoom() }, false);
});
$("#btn-zoom-100").addEventListener("click", () => setSettings({ zoomMode:"manual", zoom: 1 }, false));

// Floating help/print panels close on outside click or Escape, like menus should.
document.addEventListener("click", e => {
  document.querySelectorAll(".help-menu[open], .print-check[open]").forEach(panel => {
    if (!panel.contains(e.target)) panel.open = false;
  });
});
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  document.querySelectorAll(".help-menu[open], .print-check[open]").forEach(panel => { panel.open = false; });
});

/* ---------------- insert helpers ---------------- */
function insertAtCursor(text){
  commitPendingEdit();              // the typing before this insertion is its own undo step
  const prev = editor.value;
  const s = editor.selectionStart ?? editor.value.length, e = editor.selectionEnd ?? s;
  editor.setRangeText(text, s, e, "end");
  editor.focus();
  if (editor.value !== prev) doPush(prev);   // insertion = one undo step
  committedBase = editor.value;
  saveContent(); queueRender(); updateHistUI();
}
function fileToDataURL(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Could not read that file."));
    reader.onabort = () => reject(new Error("Reading that file was cancelled."));
    try { reader.readAsDataURL(file); } catch(e) { reject(e); }
  });
}
async function handleImageFile(file){
  if (!file) return;
  if (!file.type || !file.type.startsWith("image/")){ toast("That file is not an image."); return; }
  try {
    const url = await fileToDataURL(file);
    if (typeof url !== "string" || !url.startsWith("data:")) throw new Error("The browser did not return image data.");
    const alt = (file.name || "image").replace(/\.[^.]+$/,"").replace(/[\[\]]/g,"");
    await IMG_READY;
    const id = makeImgId();
    const stored = await imgPut(id, url);
    if (stored){
      // The editor shows a short tag instead of megabytes of base64.
      insertAtCursor("\n\n![" + alt + "](gnote-img:" + id + ")\n\n");
      toast("Image stored — a short tag stands for it in the editor");
    } else {
      insertAtCursor("\n\n![" + alt + "](" + url + ")\n\n");   // storage unavailable: old inline behaviour
      toast("Image embedded");
    }
  } catch(e) {
    console.error(e);
    toast("Could not embed that image: " + (e.message || e));
  }
}
function isTextLikeFile(file){
  if (!file) return false;
  return (file.type && file.type.startsWith("text/")) || /\.(md|markdown|txt|text)$/i.test(file.name || "");
}
async function handleMdFile(file){
  if (!file) return;
  if (!isTextLikeFile(file)){
    toast("Unsupported file: import a .md, .markdown or .txt file, or an image.");
    return;
  }
    try {
      const text = await extractInlineImages(await file.text()); // imported base64 → stored tags
      if (editor.value.trim() && !confirm("Replace current editor content with this file? (Cancel = insert at cursor)")){
        insertAtCursor("\n\n" + text);
      } else {
        applyContentEdit(() => { editor.value = text; });
        saveContent(); queueRender();
        if (curNote && curNote.title === "Untitled note"){
          const t = (file.name || "").replace(/\.[^.]+$/, "").trim();
          if (t){ curNote.title = t.slice(0, 120); const el = $("#note-title"); if (el) el.value = curNote.title; saveNotesStore(); }
        }
        toast("Loaded " + (file.name || "file"));
      }
    } catch(e) {
    console.error(e);
    toast("Could not read that file: " + (e.message || e));
  }
}
async function handleFiles(files){
  for (const file of [...(files || [])]){
    if (file.type && file.type.startsWith("image/")) await handleImageFile(file);
    else await handleMdFile(file);
  }
}
editor.addEventListener("paste", async ev => {
  const items = [...(ev.clipboardData?.files || [])];
  if (items.length){ ev.preventDefault(); await handleFiles(items); }
});
function dragHasFiles(e){ return [...(e.dataTransfer?.types || [])].includes("Files"); }
document.addEventListener("dragover", e => {
  if (!dragHasFiles(e)) return; // preserve ordinary text drag-and-drop into the textarea
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  document.body.classList.add("dragging");
});
document.addEventListener("dragleave", e => { if (!e.relatedTarget) document.body.classList.remove("dragging"); });
document.addEventListener("dragend", () => document.body.classList.remove("dragging"));
document.addEventListener("drop", async e => {
  const files = [...(e.dataTransfer?.files || [])];
  document.body.classList.remove("dragging");
  if (!files.length) return; // let the browser handle dropped text normally
  e.preventDefault();
  await handleFiles(files);
});

/* ---------------- buttons ---------------- */
$("#btn-sample").addEventListener("click", () => {
  if (editor.value.trim() && editor.value !== SAMPLE && !confirm("Replace editor content with the Unit-4 sample?")) return;
  applyContentEdit(() => { editor.value = SAMPLE; });
  saveContent(); renderNow().catch(reportRenderError); toast("Sample loaded");
});
$("#btn-clear").addEventListener("click", () => {
  if (!confirm("Clear the editor?")) return;
  applyContentEdit(() => { editor.value = ""; });
  saveContent(); renderNow().catch(reportRenderError);
});
$("#btn-import").addEventListener("click", () => $("#file-md").click());
$("#file-md").addEventListener("change", e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) handleMdFile(f); });
$("#btn-image").addEventListener("click", () => $("#file-img").click());
$("#file-img").addEventListener("change", e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) handleImageFile(f); });

$("#btn-topic").addEventListener("click", () => {
  const pos = editor.selectionStart ?? 0;
  const lineStart = editor.value.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
  const lineEndIdx = editor.value.indexOf("\n", pos);
  const line = editor.value.slice(lineStart, lineEndIdx === -1 ? editor.value.length : lineEndIdx);
  if (/<!--\s*keep-topic\s*-->/.test(line)){ toast("This line already carries a keep-topic tag."); return; }
  commitPendingEdit();
  const prev = editor.value;
  editor.setRangeText("<" + "!-- keep-topic --" + ">\n", lineStart, lineStart, "end");
  if (editor.value !== prev) doPush(prev);
  committedBase = editor.value;
  saveContent(); queueRender(); updateHistUI();
  toast("Topic tag added — that section will stay in one column");
});

/* ---------------- note name, notes library, theme, undo/redo ---------------- */
const titleInputEl = $("#note-title");
if (titleInputEl){
  titleInputEl.addEventListener("change", () => renameCurrent(titleInputEl.value));
  titleInputEl.addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); titleInputEl.blur(); } });
}
$("#btn-undo").addEventListener("click", doUndo);
$("#btn-redo").addEventListener("click", doRedo);
editor.addEventListener("keydown", e => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === "z" && !e.shiftKey){ e.preventDefault(); doUndo(); }
  else if ((k === "z" && e.shiftKey) || k === "y"){ e.preventDefault(); doRedo(); }
});

const notesDlg = $("#notesdlg");
function renderNotesList(){
  const list = $("#notes-list");
  if (!list || !NOTES_STORE) return;
  list.innerHTML = "";
  const rows = [...NOTES_STORE.notes].sort((a, b) => (b.updated || 0) - (a.updated || 0));
  if (!rows.length){
    const empty = document.createElement("div");
    empty.className = "notes-empty"; empty.textContent = "No notes yet — create one below.";
    list.appendChild(empty); return;
  }
  rows.forEach(n => {
    const row = document.createElement("div");
    row.className = "note-row" + (n.id === curNote.id ? " current" : "");
    const ti = document.createElement("input");
    ti.className = "note-row-title"; ti.value = n.title; ti.maxLength = 120;
    ti.setAttribute("aria-label", "Rename note");
    ti.title = "Rename";
    ti.addEventListener("change", () => {
      const t = (ti.value || "").trim().slice(0, 120);
      if (!t){ ti.value = n.title; return; }
      n.title = t;
      if (n === curNote){ const el = $("#note-title"); if (el) el.value = t; }
      saveNotesStore();
    });
    ti.addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); ti.blur(); } });
    row.appendChild(ti);
    if (n.id === curNote.id){
      const badge = document.createElement("span");
      badge.className = "note-row-badge"; badge.textContent = "editing";
      row.appendChild(badge);
    }
    const meta = document.createElement("span");
    meta.className = "note-row-meta";
    const d = new Date(n.updated || Date.now());
    meta.textContent = d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " +
      d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    row.appendChild(meta);
    const open = document.createElement("button");
    open.className = "btn small note-row-open"; open.textContent = "Open";
    if (n.id === curNote.id) open.disabled = true;
    open.addEventListener("click", () => { notesDlg.close(); switchToNote(n.id); });
    row.appendChild(open);
    const del = document.createElement("button");
    del.className = "btn small ghost icon-only note-row-del";
    del.title = "Delete this note"; del.setAttribute("aria-label", "Delete note");
    del.innerHTML = '<svg class="icon" viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6.5 7l1 13h9l1-13"/><path d="M10 11v5M14 11v5"/></svg>';
    del.addEventListener("click", () => {
      if (confirm('Delete "' + n.title + '"? This cannot be undone.')){ deleteNote(n.id); renderNotesList(); }
    });
    row.appendChild(del);
    list.appendChild(row);
  });
}
$("#btn-notes").addEventListener("click", () => {
  renderNotesList();
  try { notesDlg.showModal(); } catch(e){ notesDlg.setAttribute("open", ""); }
});
$("#btn-notes-close").addEventListener("click", () => notesDlg.close());
$("#btn-new-note").addEventListener("click", () => {
  notesDlg.close();
  createNote();
  toast("New note — give it a name above the editor");
  const el = $("#note-title");
  if (el){ el.focus(); el.select(); }
});
$("#btn-theme").addEventListener("click", () => setSettings({ uiTheme: S.uiTheme === "dark" ? "light" : "dark" }, false));
$("#btn-download-md").addEventListener("click", () => {
  // Tags are expanded so the saved .md is fully self-contained (images included).
  const url = URL.createObjectURL(new Blob([expandRefs(editor.value)], { type:"text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = (safeFileName(curNote && curNote.title) || "g-note") + ".md";
  document.body.appendChild(a); // required by some browsers for a synthetic download click
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
});
const APP_TITLE = document.title;
$("#btn-print").addEventListener("click", async () => {
  const btn = $("#btn-print");
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    await flushRender(); // never print a stale preview after a just-typed edit / slider move
    document.title = safeFileName(curNote && curNote.title) || "g-note";   // nice default PDF filename = note name
    window.print();
  } catch(e) {
    reportRenderError(e);
  } finally {
    document.title = APP_TITLE;
    btn.disabled = false;
  }
});
window.addEventListener("afterprint", () => { document.title = APP_TITLE; });
function toast(msg){
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------------- boot ---------------- */
applySettingsToControls(); applyCSSVars();
initNotes();                        // notes library + content mirror (synchronous → refresh-safe)
HIST_STORE = loadHistoryStore();
committedBase = editor.value;
updateHistUI();
/* Embedded images: let the browser store open (short grace period), migrate any
   legacy inline base64 blobs into stored tags, then render ONCE. Migrating
   before the first render keeps the preview from flickering or re-paginating
   after load. */
IMG_READY.then(async () => {
  try {
    const migrated = await extractInlineImages(editor.value);
    if (migrated !== editor.value){
      editor.value = migrated; committedBase = migrated; saveContent();
    }
  } catch(e){ console.error(e); }
  renderNow().catch(reportRenderError);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => queueRepaginate()).catch(() => {});
});
/* Last-resort flush: a tab close, refresh or backgrounding can never cost a
   keystroke, an undo step or the note library. */
function flushEverything(){
  commitPendingEdit(); persistHistory(); flushNotesSave();
  lsSet(LS_CONTENT, editor.value, false);
}
window.addEventListener("pagehide", flushEverything);
window.addEventListener("beforeunload", flushEverything);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushEverything(); });
