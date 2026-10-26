- **Special cases:** $\theta=0^\circ \Rightarrow W=FS$ (maximum); $\theta=90^\circ \Rightarrow W=0$; $\theta=180^\circ \Rightarrow W=-FS$ (e.g. friction).

### Kinetic Energy Formula
$$E_k = \tfrac{1}{2}mv^2$$
- **Components:** $E_k$ in Joules (J); $m$ in kg; $v$ in m/s.
- **Application:** Motion-based energy of a moving body. Doubling $v$ quadruples $E_k$.

## Gravitational Potential Energy
Gravitational potential energy ($E_p$) is the stored energy possessed by an object due to its vertical position relative to a reference level, working against the downward pull of gravity.

### Gravitational Potential Energy Formula
$$E_p = mgh$$
- **Components:**
  - $E_p$: Gravitational potential energy, measured in Joules (J).
  - $m$: Mass of the object, measured in kilograms (kg).
  - $g$: Acceleration due to gravity, in metres per second squared ($\mathrm{m/s^2}$).
  - $h$: Vertical height above the reference level, measured in metres (m).
- **Application:** Applied to calculate stored energy based on height and mass.

## Mechanical Energy
Mechanical energy is the total sum of an object's kinetic and potential energies:
$$E_{\text{mechanical}} = E_k + E_p$$

## Power
Power is defined as the rate at which work is done or the rate at which energy is being transferred. It is a scalar quantity.

### Power Formula
$$P = \frac{W}{t} \qquad \text{or} \qquad P = \frac{E}{t}$$
- **Components:**
  - $P$: Power, measured in Watts (W) or Joules per second ($\mathrm{J/s}$).
  - $W$: Work done, measured in Joules (J). $E$: Energy transferred, in Joules (J).
  - $t$: Time taken for the transfer/work, measured in seconds (s).
- **Application:** Used to measure how rapidly work is performed or how quickly energy is consumed/produced by machines, motors, or pumps.
- **Definition of 1 Watt:** $1\ \mathrm{W} = 1\ \mathrm{J/s}$. It represents the power developed when $1\ \mathrm{J}$ of energy is transferred in $1\ \mathrm{s}$.

## Comprehensive Unit Synthesis
1. **Systematic Classification of Forces:** Mechanical systems are driven by forces classified into contact forces (requiring physical touch — friction, normal force, tension, spring forces) and non-contact forces (field forces acting through space — gravity, magnetism).
2. **Work–Energy Connection:** Work ($W = F_{\parallel}S$) is the mechanical process of translating forces into energy transfers, changing either kinetic energy ($E_k=\tfrac{1}{2}mv^2$) or potential energy ($E_p=mgh$).
3. **The Temporal Element (Power):** Performing the same work in half the time requires doubling the power output ($P=W/t$).

### Formula index (table demo)
| Formula | Use it when |
|---|---|
| $\vec{F}=m\vec{a}$ | Net force / acceleration |
| $W=mg$ | Weight of a mass |
| $E_k=\frac12 mv^2$ | Energy of motion |
| $E_p=mgh$ | Stored energy of height |
| $P=\dfrac{W}{t}$ | Rate of doing work |

## KEY NOTES
1. **Zero Work Conditions:**
   1. If displacement is zero, work is zero — holding a heavy book still for two hours does $W=0$.
   2. If force is perpendicular to displacement, work is zero — the lifting force does no work when carrying a bucket horizontally.
- **Friction Extremes:** $f_{\text{static}} > f_{\text{kinetic}}$ for the same surfaces.
- **Misconception:** Action–reaction pairs never cancel — they act on different bodies.
- **Unit Conversions:** Always convert mass to kg ($200\ \mathrm{g}=0.2\ \mathrm{kg}$).
- **Links work too:** see the [KaTeX supported functions](https://katex.org/docs/supported.html) reference.

> **How to test this tool:** edit anything on the left and watch pagination update. Paste an image into the editor, add your own display formulas and Markdown tables, drag the Font slider, then **Download PDF (Print)**.
`;

/* ---------------- settings ---------------- */
const defaultSettings = {
  cols:3, paper:"a4", margin:10, columnGap:4.8,
  font:6.5, lineHeight:1.24, density:"1.24",
  wordSpacing:0, letterSpacing:0, paragraphSpacing:0.42, sentenceSpacing:0,
  listGap:0.14, listIndent:1.35, headingBefore:0.95, headingAfter:0.4,
  firstLineIndent:0, mathSpacing:0.35, tablePadding:0.22,
  bodyWeight:400, emphasisWeight:700, headingWeight:700,
  fontFamily:"serif", sheetBg:"#ffffff",
  rules:true, justify:true, hyphens:true, pageno:false, footer:"", zoom:1, zoomMode:"fit",
  uiTheme:"light", topicFit:false
};

const STYLE_PRESETS = {
  gpai: {
    cols:3, paper:"a4", margin:10, columnGap:4.8, font:6.5, lineHeight:1.24,
    wordSpacing:0, letterSpacing:0, paragraphSpacing:0.42, sentenceSpacing:0, listGap:0.14,
    listIndent:1.35, headingBefore:0.95, headingAfter:0.4, firstLineIndent:0,
    mathSpacing:0.35, tablePadding:0.22, bodyWeight:400, emphasisWeight:700,
    headingWeight:700, fontFamily:"serif", sheetBg:"#ffffff",
    rules:true, justify:true, hyphens:true
  },
  compact: {
    cols:3, paper:"a4", margin:8.5, columnGap:4, font:6.25, lineHeight:1.14,
    wordSpacing:-0.01, letterSpacing:-0.005, paragraphSpacing:0.2, listGap:0.06,
    listIndent:1.15, headingBefore:0.65, headingAfter:0.25, firstLineIndent:0,
    mathSpacing:0.22, tablePadding:0.14, bodyWeight:400, emphasisWeight:700,
    headingWeight:700, rules:true, justify:true, hyphens:true
  },
  readable: {
    cols:3, paper:"a4", margin:11, columnGap:5.5, font:7.25, lineHeight:1.38,
    wordSpacing:0.01, letterSpacing:0, paragraphSpacing:0.6, listGap:0.22,
    listIndent:1.45, headingBefore:1.05, headingAfter:0.45, firstLineIndent:0,
    mathSpacing:0.45, tablePadding:0.3, bodyWeight:400, emphasisWeight:700,
    headingWeight:700, rules:true, justify:true, hyphens:true
  },
  spacious: {
    cols:3, paper:"a4", margin:12.5, columnGap:6.5, font:8, lineHeight:1.5,
    wordSpacing:0.02, letterSpacing:0.005, paragraphSpacing:0.85, listGap:0.32,
    listIndent:1.6, headingBefore:1.25, headingAfter:0.55, firstLineIndent:0,
    mathSpacing:0.6, tablePadding:0.38, bodyWeight:400, emphasisWeight:700,
    headingWeight:700, rules:true, justify:false, hyphens:true
  }
};

let storedSettings = {};
try { storedSettings = JSON.parse(lsGet(LS_SETTINGS) || "{}") || {}; } catch(e) { storedSettings = {}; }
let S = { ...defaultSettings, ...storedSettings };
// v1 used a `density` select. Migrate it to the precise line-height slider.
// (density is kept in storage so older settings remain understandable.)
if (storedSettings.lineHeight == null && storedSettings.density != null) {
  const migrated = parseFloat(storedSettings.density);
  if (Number.isFinite(migrated)) S.lineHeight = migrated;
}
S = normalizeSettings(S);

const RANGE_FIELDS = [
  ["#opt-margin", "margin", "#val-margin", v => trimNum(v, 1) + "mm"],
  ["#opt-colgap", "columnGap", "#val-colgap", v => trimNum(v, 1) + "mm"],
  ["#opt-font", "font", "#val-font", v => trimNum(v, 2) + "pt"],
  ["#opt-line", "lineHeight", "#val-line", v => trimNum(v, 2) + "×"],
  ["#opt-word", "wordSpacing", "#val-word", v => signedEm(v)],
  ["#opt-sentence", "sentenceSpacing", "#val-sentence", v => em(v)],
  ["#opt-letter", "letterSpacing", "#val-letter", v => signedEm(v, 3)],
  ["#opt-paragraph", "paragraphSpacing", "#val-paragraph", v => em(v)],
  ["#opt-list-gap", "listGap", "#val-list-gap", v => em(v)],
  ["#opt-list-indent", "listIndent", "#val-list-indent", v => em(v)],
  ["#opt-heading-before", "headingBefore", "#val-heading-before", v => em(v)],
  ["#opt-heading-after", "headingAfter", "#val-heading-after", v => em(v)],
  ["#opt-first-indent", "firstLineIndent", "#val-first-indent", v => em(v)],
  ["#opt-math-gap", "mathSpacing", "#val-math-gap", v => em(v)],
  ["#opt-table-pad", "tablePadding", "#val-table-pad", v => em(v)],
  ["#opt-body-weight", "bodyWeight", "#val-body-weight", v => weightLabel(v)],
  ["#opt-emphasis-weight", "emphasisWeight", "#val-emphasis-weight", v => String(Math.round(v))],
  ["#opt-heading-weight", "headingWeight", "#val-heading-weight", v => String(Math.round(v))],
  ["#opt-zoom", "zoom", "#val-zoom", v => Math.round(v * 100) + "%"]
];

function normalizeSettings(raw){
  const src = (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw : {};
  const out = { ...defaultSettings };
  const ranges = {
    margin:[8,15], columnGap:[3,8], font:[6,9], lineHeight:[1.05,1.6],
    wordSpacing:[-0.05,0.3], letterSpacing:[-0.03,0.08], paragraphSpacing:[0,1.2], sentenceSpacing:[0,0.6],
    listGap:[0,0.6], listIndent:[0.8,2.4], headingBefore:[0,1.8], headingAfter:[0,1],
    firstLineIndent:[0,1.5], mathSpacing:[0,1], tablePadding:[0.05,0.6],
    bodyWeight:[400,700], emphasisWeight:[500,900], headingWeight:[500,900], zoom:[0.35,1.3]
  };
  Object.entries(ranges).forEach(([key, [min, max]]) => {
    const n = Number(src[key]);
    out[key] = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaultSettings[key];
  });
  ["bodyWeight", "emphasisWeight", "headingWeight"].forEach(key => {
    out[key] = Math.round(out[key] / 50) * 50;
  });
  const cols = Number(src.cols);
  out.cols = [2,3,4].includes(cols) ? cols : defaultSettings.cols;
  out.paper = src.paper === "letter" ? "letter" : "a4";
  const bool = (value, fallback) => value === true || value === "true" || value === 1 ? true :
    (value === false || value === "false" || value === 0 ? false : fallback);
  out.rules = bool(src.rules, defaultSettings.rules);
  out.justify = bool(src.justify, defaultSettings.justify);
  out.hyphens = bool(src.hyphens, defaultSettings.hyphens);
  out.topicFit = bool(src.topicFit, defaultSettings.topicFit);
  out.pageno = bool(src.pageno, defaultSettings.pageno);
  out.footer = typeof src.footer === "string" ? src.footer.slice(0, 300) : "";
  out.fontFamily = ["serif","sans","georgia","jakarta"].includes(src.fontFamily) ? src.fontFamily : defaultSettings.fontFamily;
  out.sheetBg = (typeof src.sheetBg === "string" && /^#[0-9a-f]{6}$/i.test(src.sheetBg.trim()))
    ? src.sheetBg.trim().toLowerCase() : defaultSettings.sheetBg;
  out.zoomMode = src.zoomMode === "manual" ? "manual" : "fit";
  out.uiTheme = src.uiTheme === "dark" ? "dark" : "light";
  out.density = String(out.lineHeight);
  return out;
}
function trimNum(value, decimals = 2){
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(decimals).replace(/\.?0+$/, "");
}
function em(value){ return trimNum(value, 2) + "em"; }
function signedEm(value, decimals = 2){
  const n = Number(value) || 0;
  return (n > 0 ? "+" : "") + trimNum(n, decimals) + "em";
}
function weightLabel(value){
  const n = Math.round(Number(value) || 400);
  if (n <= 425) return n + " Regular";
  if (n <= 550) return n + " Medium";
  if (n <= 650) return n + " Semi-bold";
  return n + " Bold";
}
function setRangeFill(input){
  if (!input) return;
  const min = parseFloat(input.min || 0), max = parseFloat(input.max || 100), value = parseFloat(input.value || 0);
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  input.style.setProperty("--fill", Math.max(0, Math.min(100, pct)) + "%");
}
function syncSegmented(id, value){
  document.querySelectorAll("#" + id + " button").forEach(btn => {
    btn.setAttribute("aria-pressed", String(btn.dataset.value) === String(value) ? "true" : "false");
  });
}
function segmentedValue(id, fallback){
  const active = document.querySelector("#" + id + " button[aria-pressed='true']");
  return active ? active.dataset.value : fallback;
}
function markActivePreset(){
  document.querySelectorAll(".preset-chip").forEach(chip => {
    const preset = STYLE_PRESETS[chip.dataset.preset];
    if (!preset) return;
    const active = Object.entries(preset).every(([key, value]) => {
      if (typeof value === "number") return Math.abs((+S[key] || 0) - value) < 0.001;
      return S[key] === value;
    });
    chip.classList.toggle("active", active);
    chip.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function applySettingsToControls(){
  syncSegmented("seg-cols", S.cols);
  syncSegmented("seg-paper", S.paper);
  syncSegmented("seg-fontfamily", S.fontFamily);
  document.querySelectorAll("#sw-sheetbg .swatch[data-value]").forEach(btn => {
    btn.setAttribute("aria-pressed", btn.dataset.value.toLowerCase() === S.sheetBg ? "true" : "false");
  });
  const bgCustom = $("#opt-sheetbg-custom");
  if (bgCustom && document.activeElement !== bgCustom) bgCustom.value = S.sheetBg;
  const bgOut = $("#val-sheetbg");
  if (bgOut) bgOut.textContent = S.sheetBg.toUpperCase();

  RANGE_FIELDS.forEach(([inputSel, key, outputSel, format]) => {
    const input = $(inputSel), output = $(outputSel);
    if (input) { input.value = S[key]; setRangeFill(input); }
    if (output) output.textContent = format(S[key]);
  });

  const footer = $("#opt-footer");
  if (footer && document.activeElement !== footer) footer.value = S.footer || "";
  // If the user is typing the footer, do not move their cursor by rewriting it.
  if (footer && document.activeElement === footer && footer.value !== (S.footer || "")) S.footer = footer.value;

  $("#opt-rules").checked = !!S.rules;
  $("#opt-justify").checked = !!S.justify;
  syncSegmented("seg-hyphens", S.hyphens ? "hyphenated" : "whole");
  const topicFitBox = $("#opt-topicfit");
  if (topicFitBox) topicFitBox.checked = !!S.topicFit;
  $("#opt-pageno").checked = !!S.pageno;

  const paperName = S.paper === "letter" ? "US Letter" : "A4";
  ["#help-paper", "#print-paper"].forEach(sel => { const el = $(sel); if (el) el.textContent = paperName; });

  const themeBtn = $("#btn-theme");
  if (themeBtn){
    themeBtn.setAttribute("aria-pressed", String(S.uiTheme === "dark"));
    themeBtn.title = S.uiTheme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  }
  markActivePreset();
}

function readControls(){
  S.cols = +segmentedValue("seg-cols", S.cols);
  S.paper = segmentedValue("seg-paper", S.paper);
  S.fontFamily = segmentedValue("seg-fontfamily", S.fontFamily);
  // sheetBg is written by its swatch/colour listeners; it already lives in S,
  // so readControls must simply not clobber it.

  RANGE_FIELDS.forEach(([inputSel, key]) => {
    const input = $(inputSel);
    if (input) S[key] = parseFloat(input.value);
  });
  S.density = String(S.lineHeight);

  S.rules = $("#opt-rules").checked;
  S.justify = $("#opt-justify").checked;
  S.hyphens = (document.querySelector("#seg-hyphens button[aria-pressed='true']")?.dataset.value || "hyphenated") === "hyphenated";
  S.topicFit = !!$("#opt-topicfit")?.checked;
  S.pageno = $("#opt-pageno").checked;
  S.footer = $("#opt-footer").value;
  S = normalizeSettings(S);

  persistSettings();
  applySettingsToControls();
  applyCSSVars();
}

function persistSettings(){
  lsSet(LS_SETTINGS, JSON.stringify(S));
}

function setSettings(patch, render = true){
  S = normalizeSettings({ ...S, ...(patch || {}) });
  persistSettings();
  applySettingsToControls();
  applyCSSVars();
  if (render) queueRender();
}

function calculateFitZoom(){
  const pane = $("#preview-pane");
  if (!pane || !pane.clientWidth) return Number.isFinite(+S.zoom) ? +S.zoom : 1;
  const cs = getComputedStyle(pane);
  const available = pane.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  const pagePx = (S.paper === "letter" ? 215.9 : 210) * 96 / 25.4;
  if (!available || !pagePx) return 1;
  return Math.max(0.35, Math.min(1.3, Math.floor((available / pagePx) * 100) / 100));
}
function syncZoomControl(){
  const input = $("#opt-zoom"), output = $("#val-zoom");
  if (input && document.activeElement !== input){ input.value = S.zoom; setRangeFill(input); }
  if (output) output.textContent = Math.round(S.zoom * 100) + "%";
}

function applyCSSVars(){
  document.documentElement.dataset.theme = S.uiTheme === "dark" ? "dark" : "light";
  if (S.zoomMode === "fit") S.zoom = calculateFitZoom();
  const r = document.documentElement.style;
  const dims = S.paper === "letter" ? [215.9, 279.4] : [210, 297];
  r.setProperty("--page-w", dims[0] + "mm");
  r.setProperty("--page-h", dims[1] + "mm");
  r.setProperty("--margin-mm", S.margin);
  r.setProperty("--gap-mm", S.columnGap);
  r.setProperty("--body-pt", S.font);
  r.setProperty("--leading", S.lineHeight);
  r.setProperty("--word-spacing", S.wordSpacing + "em");
  r.setProperty("--letter-spacing", S.letterSpacing + "em");
  r.setProperty("--paragraph-gap", S.paragraphSpacing + "em");
  r.setProperty("--list-gap", S.listGap + "em");
  r.setProperty("--list-indent", S.listIndent + "em");
  r.setProperty("--heading-before", S.headingBefore + "em");
  r.setProperty("--heading-after", S.headingAfter + "em");
  r.setProperty("--first-line-indent", S.firstLineIndent + "em");
  r.setProperty("--math-gap", S.mathSpacing + "em");
  r.setProperty("--table-pad-y", S.tablePadding + "em");
  r.setProperty("--table-pad-x", (Number(S.tablePadding) + 0.12) + "em");
  r.setProperty("--body-weight", S.bodyWeight);
  r.setProperty("--emphasis-weight", S.emphasisWeight);
  r.setProperty("--heading-weight", S.headingWeight);
  r.setProperty("--sheet-bg", S.sheetBg);
  r.setProperty("--sentence-gap", S.sentenceSpacing + "em");
  const SHEET_FONTS = {
    serif: '"Liberation Serif","Times New Roman",Times,serif',
    sans: '"Liberation Sans",Arial,"Helvetica Neue",sans-serif',
    georgia: 'Georgia,"Times New Roman",Times,serif',
    jakarta: '"Plus Jakarta Sans","Liberation Sans",Arial,sans-serif'
  };
  r.setProperty("--sheet-font", SHEET_FONTS[S.fontFamily] || SHEET_FONTS.serif);

  pagesEl.style.zoom = S.zoom;
  r.setProperty("--preview-zoom", S.zoom);
  syncZoomControl();

  const st = document.getElementById("pagesize-style") || document.createElement("style");
  st.id = "pagesize-style";
  st.textContent = "@page{size:" + (S.paper === "letter" ? "letter" : "A4") + ";margin:0}";
  document.head.appendChild(st);
}

/* ---------------- Markdown + math pipeline ---------------- */
const TOKEN = i => "\uE000" + i + "\uE001";
function escapeHtml(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function renderMarkdown(md, errors = []){
  if (dependencyError) throw new Error(dependencyError);
  const store = [];   // {kind:'code'|'math', display, text, lang}
  const keep = item => { store.push(item); return TOKEN(store.length-1); };

  // 1) fenced code blocks first (so math inside code stays literal)
  md = md.replace(/```([^\n`]*)\n([\s\S]*?)(?:```|(?=$))/g, (m, lang, code) => "\n\n" + keep({kind:"code", lang:lang.trim(), text:code.replace(/\n$/,"")}) + "\n\n");
  // 2) inline code `…` BEFORE math, so `$` inside code spans stays literal
  md = md.replace(/`([^`\n]+)`/g, (m, t) => keep({kind:"icode", text:t}));
  // 2b) embedded-image tags → data URIs (after code protection so tags inside
  //     fenced/inline code stay literal; before math so nothing else shifts)
  md = resolveImageRefs(md, errors);
  // 3) display math: $$…$$, \[…\], \begin{env}…\end{env}
  md = md.replace(/\$\$([\s\S]+?)\$\$/g, (m, t) => keep({kind:"math", display:true, text:t.trim()}));
  md = md.replace(/\\\[([\s\S]+?)\\\]/g, (m, t) => keep({kind:"math", display:true, text:t.trim()}));
  md = md.replace(/\\begin\{([a-zA-Z*]+)\}[\s\S]+?\\end\{\1\}/g, (m) => keep({kind:"math", display:true, text:m.trim()}));
  // 4) inline math: \(…\) then $…$ (single-line, not currency-like: no space right after $ or before closing $)
  md = md.replace(/\\\((.+?)\\\)/g, (m, t) => keep({kind:"math", display:false, text:t.trim()}));
  md = md.replace(/(?<![\\$\w])\$(?!\s)((?:\\.|[^$\\\n])+?)(?<!\s)\$(?!\w)/g, (m, t) => keep({kind:"math", display:false, text:t.trim()}));
  // 5) explicit breaks
  md = md.replace(/<!--\s*column-break\s*-->/gi, '\n\n<div data-break="column"></div>\n\n')
         .replace(/<!--\s*page-break\s*-->/gi,   '\n\n<div data-break="page"></div>\n\n')
         .replace(/<!--\s*keep-topic\s*-->/gi,   '\n\n<div data-break="topic"></div>\n\n');

  let html = marked.parse(md);
  html = DOMPurify.sanitize(html, {
    ADD_TAGS:["figure","figcaption","caption","svg","path","line","rect","circle","text","g","defs","marker","polygon","polyline","ellipse","use","title","desc"],
    ADD_ATTR:["target","data-break","viewBox","d","x","y","x1","y1","x2","y2","cx","cy","r","rx","ry","width","height","fill","stroke","stroke-width","points","transform","text-anchor","font-size","marker-end","marker-start","id","markerWidth","markerHeight","refX","refY","orient"],
    ALLOW_DATA_ATTR:false
  });

  // 6) restore protected chunks; render math with KaTeX
  html = html.replace(/\uE000(\d+)\uE001/g, (m, idx) => {
    const it = store[+idx]; if(!it) return m;
    if(it.kind === "code")  return "<pre><code>" + escapeHtml(it.text) + "</code></pre>";
    if(it.kind === "icode") return "<code>" + escapeHtml(it.text) + "</code>";
    try {
      const out = katex.renderToString(it.text, { displayMode: !!it.display, throwOnError:true, strict:false, trust:false, output:"htmlAndMathml" });
      return it.display ? '<div class="math-display">' + out + "</div>" : out;
    } catch(e){
      errors.push((it.display ? "$$" : "$") + it.text.slice(0,160) + "  →  " + e.message);
