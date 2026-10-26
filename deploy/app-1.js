
"use strict";
/* ================================================================
   G/note.
   Pipeline:  protect code+math → Marked (GFM) → DOMPurify →
              restore code, render math with KaTeX →
              post-process (figures/tables/links) →
              deterministic pagination into A4 pages × N columns →
              browser Print-to-PDF (@page, vector text/math/links)
   Measured from the reference GPAI PDF: Liberation Serif 6.5pt,
   A4, 10mm margins, 3 columns, ≈4.8mm gutters, KaTeX math.
   ================================================================ */
const $ = s => document.querySelector(s);
const editor = $("#editor"), pagesEl = $("#pages");
const LS_CONTENT = "cs-studio:content:v1", LS_SETTINGS = "cs-studio:settings:v1";
let renderErrors = [];
let repaginateQueued = false;
let storageWarningShown = false;

function lsGet(key){
  try { return localStorage.getItem(key); } catch(e) { return null; }
}
function lsSet(key, value, warnOnFailure = false){
  try {
    localStorage.setItem(key, value);
    storageWarningShown = false;
    return true;
  } catch(e) {
    if (warnOnFailure && !storageWarningShown){
      storageWarningShown = true;
      setTimeout(() => { try { toast("Autosave unavailable (browser storage is full or blocked). Use Save .md to keep a copy."); } catch(_){} }, 0);
    }
    return false;
  }
}
function saveContent(){
  const ok = lsSet(LS_CONTENT, editor.value, true); // immediate mirror — a refresh can never lose typed work
  scheduleNotesSave();                              // the notes library write is throttled + flushed on hide
  return ok;
}

/* ---------------- notes library (no account, no server) ----------------
   Current note content mirrors `cs-studio:content:v1` (kept for old saves),
   the library itself lives in `cs-studio:notes:v1`, undo/redo in
   `cs-studio:history:v1`. Everything is plain localStorage = synchronous,
   so nothing is ever pending when the tab reloads or the browser closes. */
const LS_NOTES = "cs-studio:notes:v1", LS_HISTORY = "cs-studio:history:v1", LS_IMAGES = "cs-studio:images:v1";
const HIST_MAX = 3;               // up to 3 undo steps and 3 redo steps, persisted
let NOTES_STORE = null;           // {v:1,current:noteId,notes:[{id,title,content,created,updated}]}
let curNote = null;               // the open note object (a reference inside NOTES_STORE)
let notesSaveTimer = null;
let HIST_STORE = {};              // noteId -> {undo:[...], redo:[...]}
let burstTimer = null;            // coalesces a typing burst into one undo step
let committedBase = "";           // content of the last committed undo checkpoint

function uid(prefix){ return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function deriveTitle(text){
  const m = /^#{1,3}\s+(.+)$/m.exec(text || "");
  let t = (m ? m[1] : (String(text || "").split("\n").find(l => l.trim()) || "")).trim();
  t = t.replace(/[*_`$\\]/g, "").replace(/\s+/g, " ").slice(0, 80);
  return t || "Untitled note";
}
function makeNote(title, content){
  return { id: uid("n"), title: String(title || "Untitled note").slice(0, 120), content: String(content || ""), created: Date.now(), updated: Date.now() };
}
function loadNotesStore(){
  try {
    const raw = lsGet(LS_NOTES);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.notes)) return null;
    const notes = parsed.notes
      .filter(n => n && typeof n === "object" && typeof n.id === "string" && typeof n.content === "string")
      .map(n => ({
        id: n.id,
        title: (typeof n.title === "string" && n.title.trim()) ? n.title.slice(0, 120) : deriveTitle(n.content),
        content: n.content,
        created: Number.isFinite(+n.created) ? +n.created : Date.now(),
        updated: Number.isFinite(+n.updated) ? +n.updated : Date.now()
      }));
    if (!notes.length) return null;
    let current = typeof parsed.current === "string" ? parsed.current : notes[0].id;
    if (!notes.some(n => n.id === current)) current = notes[0].id;
    return { v: 1, current, notes };
  } catch(e){ return null; }
}
function saveNotesStore(){
  if (!NOTES_STORE) return;
  if (curNote) { curNote.content = editor.value; curNote.updated = Date.now(); }
  lsSet(LS_NOTES, JSON.stringify(NOTES_STORE), true);
}
function scheduleNotesSave(){
  if (notesSaveTimer) return;
  notesSaveTimer = setTimeout(() => { notesSaveTimer = null; saveNotesStore(); }, 350);
}
function flushNotesSave(){
  if (notesSaveTimer){ clearTimeout(notesSaveTimer); notesSaveTimer = null; }
  saveNotesStore();
}
function initNotes(){
  NOTES_STORE = loadNotesStore();
  const mirror = lsGet(LS_CONTENT);         // immediate mirror is the freshest copy of the open note
  if (!NOTES_STORE){
    let content = mirror;
    if (content === null) content = SAMPLE; // first ever run
    const note = makeNote(deriveTitle(content), content);
    NOTES_STORE = { v: 1, current: note.id, notes: [note] };
  }
  curNote = NOTES_STORE.notes.find(n => n.id === NOTES_STORE.current) || NOTES_STORE.notes[0];
  NOTES_STORE.current = curNote.id;
  if (mirror !== null && mirror !== curNote.content){ curNote.content = mirror; curNote.updated = Date.now(); }
  editor.value = curNote.content;
  lsSet(LS_CONTENT, curNote.content, true); // (re)establish the mirror
  saveNotesStore();
  const titleEl = $("#note-title"); if (titleEl) titleEl.value = curNote.title;
}
function switchToNote(id){
  const note = NOTES_STORE ? NOTES_STORE.notes.find(n => n.id === id) : null;
  if (!note || note === curNote) return;
  commitPendingEdit(); flushNotesSave(); persistHistory();
  curNote = note; NOTES_STORE.current = note.id;
  editor.value = note.content; committedBase = note.content;
  const titleEl = $("#note-title"); if (titleEl) titleEl.value = note.title;
  lsSet(LS_CONTENT, note.content, true); saveNotesStore();
  updateHistUI(); renderNow().catch(reportRenderError);
}
function createNote(){
  commitPendingEdit(); flushNotesSave();
  const note = makeNote("Untitled note", "");
  NOTES_STORE.notes.push(note);
  curNote = note; NOTES_STORE.current = note.id;
  editor.value = ""; committedBase = "";
  const titleEl = $("#note-title"); if (titleEl) titleEl.value = note.title;
  lsSet(LS_CONTENT, "", true); saveNotesStore();
  updateHistUI(); renderNow().catch(reportRenderError);
  return note;
}
function deleteNote(id){
  if (!NOTES_STORE) return;
  const idx = NOTES_STORE.notes.findIndex(n => n.id === id);
  if (idx < 0) return;
  NOTES_STORE.notes.splice(idx, 1);
  if (id === (curNote && curNote.id)){
    if (NOTES_STORE.notes.length) switchToNote(NOTES_STORE.notes[Math.max(0, idx - 1)].id);
    else createNote();
  }
  delete HIST_STORE[id];   // after any switch, so no orphan entry is re-created
  saveNotesStore(); persistHistory();
}
function renameCurrent(raw){
  const t = String(raw || "").trim().slice(0, 120);
  const el = $("#note-title");
  if (!t || !curNote){ if (el && curNote) el.value = curNote.title; return; }
  if (t === curNote.title) return;
  curNote.title = t; saveNotesStore(); renderNotesList();
}
function safeFileName(name){
  return String(name || "").replace(/[\\/:*?"<>|]/g, "").replace(/^\.+/, "").replace(/\.+$/, "").trim().slice(0, 80);
}

/* ---------------- undo / redo (3 steps each way, survives reloads) ---------------- */
function loadHistoryStore(){
  try {
    const parsed = JSON.parse(lsGet(LS_HISTORY) || "null");
    if (!parsed || typeof parsed !== "object" || !parsed.notes || typeof parsed.notes !== "object") return {};
    const clean = arr => Array.isArray(arr) ? arr.filter(x => typeof x === "string").slice(-HIST_MAX) : [];
    const out = {};
    Object.entries(parsed.notes).forEach(([id, h]) => {
      if (typeof id === "string" && h && typeof h === "object") out[id] = { undo: clean(h.undo), redo: clean(h.redo) };
    });
    return out;
  } catch(e){ return {}; }
}
function histFor(id){ if (!HIST_STORE[id]) HIST_STORE[id] = { undo: [], redo: [] }; return HIST_STORE[id]; }
function persistHistory(){
  const build = () => JSON.stringify({ v: 1, notes: HIST_STORE });
  let raw = build(), guard = 0;
  // Undo history must never be the thing that fills the quota: trim oldest
  // steps (redo first) until it fits, then write silently.
  while (raw.length > 2400000 && guard++ < 80){
    let target = null, best = 0;
    Object.values(HIST_STORE).forEach(h => ["redo", "undo"].forEach(k => {
      if (h[k].length > best){ best = h[k].length; target = h[k]; }
    }));
    if (!target || target.length < 1) break;
    target.shift();
    raw = build();
  }
  if (!lsSet(LS_HISTORY, raw, false)) console.warn("G/note.: undo history kept in memory only (storage full).");
}
function updateHistUI(){
  const h = curNote ? histFor(curNote.id) : { undo: [], redo: [] };
  const u = $("#btn-undo"), r = $("#btn-redo");
  if (u) u.disabled = !h.undo.length;
  if (r) r.disabled = !h.redo.length;
}
function doPush(snap){
  if (!curNote) return;
  const h = histFor(curNote.id);
  h.undo.push(snap);
  while (h.undo.length > HIST_MAX) h.undo.shift();
  h.redo.length = 0;               // a new edit invalidates the redo branch
  persistHistory(); updateHistUI();
}
function sealBurst(){
  if (editor.value !== committedBase){
    const snap = committedBase;
    committedBase = editor.value;
    doPush(snap);
  }
}
function commitPendingEdit(){
  if (burstTimer){ clearTimeout(burstTimer); burstTimer = null; }
  sealBurst();
}
function histNoteInput(){
  clearTimeout(burstTimer);
  burstTimer = setTimeout(() => { burstTimer = null; sealBurst(); }, 900);
}
function applyHistoryState(value){
  editor.value = value; committedBase = value;
  saveContent(); renderNow().catch(reportRenderError);
  updateHistUI();
}
function doUndo(){
  if (!curNote) return;
  commitPendingEdit();
  const h = histFor(curNote.id);
  if (!h.undo.length) return;
  h.redo.push(editor.value);
  while (h.redo.length > HIST_MAX) h.redo.shift();
  applyHistoryState(h.undo.pop());
  persistHistory();
}
function doRedo(){
  if (!curNote) return;
  commitPendingEdit();
  const h = histFor(curNote.id);
  if (!h.redo.length) return;
  h.undo.push(editor.value);
  while (h.undo.length > HIST_MAX) h.undo.shift();
  applyHistoryState(h.redo.pop());
  persistHistory();
}
/* Wrap whole-content operations (sample / clear / import) as one undo step. */
function applyContentEdit(fn){
  commitPendingEdit();
  const prev = editor.value;
  fn();
  if (editor.value !== prev) doPush(prev);
  committedBase = editor.value;
}

/* ---------------- embedded images: short tags in the editor, data in the browser store ----
   Pasted/dropped images used to paste a megabyte of base64 into the editor.
   Now the editor holds `![alt](gnote-img:<id>)` and the bytes live in
   IndexedDB (localStorage fallback). renderMarkdown() swaps the tag back to
   the data URI before Markdown runs, so the rendered sheet — and the printed
   PDF — are exactly what they were with inline blobs. */
const IMAGE_REF = /(!\[[^\]\n]*\]\()gnote-img:([A-Za-z0-9_-]{1,64})\)/g;
const DATA_URI_IMG = /(!\[[^\]\n]*\]\()(data:image\/[a-z0-9.+_-]+;base64,[A-Za-z0-9+/=]+)\)/gi;
const IMG_MAP = new Map();
let imgBackend = "idb", imgDb = null;
function imgIdbOpen(){
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open("gnote-images", 1); } catch(e){ reject(e); return; }
    req.onupgradeneeded = () => { try { req.result.createObjectStore("images", { keyPath: "id" }); } catch(_){} };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB unavailable"));
    req.onblocked = () => reject(new Error("IndexedDB blocked"));
  });
}
function imgIdbAll(db){
  return new Promise((resolve, reject) => {
    try {
      const rq = db.transaction("images", "readonly").objectStore("images").getAll();
      rq.onsuccess = () => resolve(rq.result || []);
      rq.onerror = () => reject(rq.error);
    } catch(e){ reject(e); }
  });
}
function imgIdbPut(db, id, data){
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction("images", "readwrite");
      tx.objectStore("images").put({ id, data });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("write aborted"));
    } catch(e){ reject(e); }
  });
}
function imgLsDump(){
  try {
    const obj = JSON.parse(lsGet(LS_IMAGES) || "{}");
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch(e){ return {}; }
}
async function imgStoreInit(){
  try {
    const race = p => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("storage timeout")), 2500))]);
    const db = await race(imgIdbOpen());
    const rows = await race(imgIdbAll(db));
    rows.forEach(r => { if (r && typeof r.id === "string" && typeof r.data === "string") IMG_MAP.set(r.id, r.data); });
    imgDb = db; imgBackend = "idb";
  } catch(e){
    imgDb = null; imgBackend = "ls";   // file:// and blocked-storage browsers still work via localStorage
    const dump = imgLsDump();
    Object.entries(dump).forEach(([id, data]) => { if (typeof data === "string") IMG_MAP.set(id, data); });
  }
}
const IMG_READY = imgStoreInit();
function makeImgId(){
  let id;
  do { id = "i" + Math.random().toString(36).slice(2, 10); } while (IMG_MAP.has(id));
  return id;
}
async function imgPut(id, data){
  IMG_MAP.set(id, data);
  if (imgBackend === "idb" && imgDb){
    try { await imgIdbPut(imgDb, id, data); return true; }
    catch(e){ imgDb = null; imgBackend = "ls"; }
  }
  const dump = imgLsDump(); dump[id] = data;
  const ok = lsSet(LS_IMAGES, JSON.stringify(dump), false);
  if (!ok) IMG_MAP.delete(id);        // caller falls back to an inline blob then
  return ok;
}
function resolveImageRefs(md, errors){
  if (!/gnote-img:/.test(md)) return md;
  return md.replace(IMAGE_REF, (m, pre, id) => {
    const data = IMG_MAP.get(id);
    if (data) return pre + data + ")";
    const alt = /^!\[([^\]]*)\]/.exec(m);
    errors.push("Embedded image" + (alt && alt[1] ? " \"" + alt[1] + "\"" : "") + " (" + id + ") is missing from this browser's storage — re-insert it.");
    return "";
  });
}
/* Move inline base64 blobs out of note text into the image store (boot + import).
   Only rewrites the editor once every byte is safely stored, so a crash can
   never trade visible text for a dangling tag. */
async function extractInlineImages(text){
  await IMG_READY;
  if (!/data:image\//.test(text)) return text;
  const found = [];
  const replaced = text.replace(DATA_URI_IMG, (m, pre, data) => {
    const id = makeImgId();
    found.push([id, data]);
    return pre + "gnote-img:" + id + ")";
  });
  if (!found.length) return text;
  for (const [id, data] of found){
    if (!await imgPut(id, data)) return text;   // keep blobs inline; they still render
  }
  return replaced;
}
function expandRefs(text){
  if (!/gnote-img:/.test(text)) return text;
  return text.replace(IMAGE_REF, (m, pre, id) => { const d = IMG_MAP.get(id); return d ? pre + d + ")" : m; });
}

const missingLibraries = ["marked", "DOMPurify", "katex"].filter(name => typeof globalThis[name] === "undefined");
let dependencyError = "";
if (!missingLibraries.includes("marked")){
  try { marked.setOptions({ gfm:true, breaks:false, headerIds:false, mangle:false }); }
  catch(e) { dependencyError = "Marked failed to initialise: " + e.message; }
}
if (missingLibraries.length) dependencyError = "Required library failed to load: " + missingLibraries.join(", ") + ". Check that the vendor/ folder is deployed beside index.html.";

/* ---------------- sample (your Unit 4, in paste-ready Markdown) ---------------- */
const SAMPLE = String.raw`G11, Phy, U4:
# Unit 4: Force, Work, Energy, and Power

## The Concept of Force
A force is a push or a pull exerted on a body that changes its state of motion or causes deformation by changing its shape or size.
- **Vector Nature:** Force is a vector quantity determined by both magnitude and direction, represented as $\vec{F}$ or bold $\mathbf{F}$. It can be added using the head-to-tail method or trigonometric methods.
- **Measurement:** Forces are measured using the deformation of a spring. When a force is applied, the spring elongates, and a pointer on a calibrated scale reads the force value.
- **SI Unit:** The SI unit of force is the newton (N).

### Classification of Forces
1. **Contact Forces:** Forces that involve direct physical contact between two bodies, with the force experienced only while contact is maintained.
   - *Examples:* Applied forces, normal forces, frictional forces, and spring forces.
2. **Non-Contact Forces:** Forces that act on a body without physical contact.
   - *Examples:* Magnetic force (e.g., attraction of iron to a magnet) and gravitational force (e.g., an object falling back to Earth).

## Newton's First Law of Motion (Law of Inertia)
A body continues to be in its state of rest or of uniform motion in a straight line unless it is acted on by an unbalanced external force.
- **Inertia:** An inherent property of matter by which it continues in its existing state of rest or uniform motion in a straight line, resisting any attempt to change its velocity.
- **Mass as a Measure of Inertia:** Mass is the quantitative measure of an object's resistance to a change in its state of motion. Mass is constant everywhere. Objects with larger masses possess larger inertia and are more resistant to changes in velocity.
- **Inertial Frames of Reference:** A special set of reference frames in which Newton's first law is valid.
  - If an object does not interact with other objects, its acceleration is zero in an inertial frame.
  - Any reference frame moving with a constant velocity relative to an inertial frame is itself an inertial frame.

## Newton's Second Law of Motion
The acceleration of a body is directly proportional to the net force acting on it and inversely proportional to the mass of the body.

### The Net Force Formula
$$\vec{F} = m\vec{a}$$
- **Components:**
  - $\vec{F}$: Net force acting on the body, measured in Newtons (N) or kilogram-metres per second squared ($\mathrm{kg \cdot m/s^2}$).
  - $m$: Mass of the body, measured in kilograms (kg).
  - $\vec{a}$: Acceleration of the body, measured in metres per second squared ($\mathrm{m/s^2}$).
- **Application:** Used to calculate the acceleration produced when an unbalanced force acts on an object of a known mass. The direction of acceleration is always identical to the direction of the net force.
- **Definition of 1 Newton:** $1\ \mathrm{N} = 1\ \mathrm{kg \cdot m/s^2}$. It is the force that, acting on an object of mass $1\ \mathrm{kg}$, produces an acceleration of $1\ \mathrm{m/s^2}$.

### Gravitational Force (Weight) Formula
$$W = mg \qquad \text{or} \qquad F_g = mg$$
- **Components:**
  - $W$ (or $F_g$): Weight or gravitational force, measured in Newtons (N).
  - $m$: Mass of the body, measured in kilograms (kg).
  - $g$: Acceleration due to gravity, measured in metres per second squared ($\mathrm{m/s^2}$).
- **Application:** Calculate the magnitude of the gravitational pull on an object directed toward the centre of the Earth.
- **Earth's Surface Value:** $g \approx 9.8\ \mathrm{m/s^2}$ (or $10\ \mathrm{m/s^2}$ in simplified scenarios).
- **Variability:** $g$ decreases with height. On the Moon, $g_{\text{Moon}} \approx \tfrac{1}{6} g_{\text{Earth}}$.

## Newton's Third Law of Motion
Every action has an equal and opposite reaction. Forces always act in pairs.

### Action–Reaction Relationship
$$F_{12} = -F_{21}$$
- **Components:**
  - $F_{12}$: Force exerted by object 1 on object 2, in Newtons (N).
  - $F_{21}$: Force exerted by object 2 on object 1, in Newtons (N).
- **Application:** Analyze interacting bodies. Action and reaction are equal in magnitude, opposite in direction, and act on *different* objects — so they never cancel.
- **Example (Block on Table):** A block exerts a downward force on a table equal to its weight ($W=mg$); the table exerts an equal upward normal force on the block.

## Forces of Friction
Frictional force ($f$) is the resistance to the motion of an object offered by a contacting surface.
- **Surface Dependency:** Magnitude depends on the nature of the surfaces (rougher ⇒ larger friction).
- **Normal Force Dependency:** Friction is directly proportional to the normal force: $f_k = \mu_k F_N$, $0 \le f_s \le \mu_s F_N$.

### Types of Friction
1. **Static Friction:** Exists when a body tends to slide without moving; requires a relatively large force to overcome.
2. **Kinetic Friction:** Acts when surfaces slide or roll; its magnitude is less than maximum static friction for the same surfaces.

## Work & Kinetic Energy
Work is done when an applied force causes a displacement parallel to the force. It is the mechanical transfer of energy.

### Work Formula
$$W = FS\cos\theta$$
- **Components:** $W$ in Joules (J); $F$ in Newtons (N); $S$ in metres (m); $\theta$ = angle between $\vec{F}$ and $\vec{S}$.
