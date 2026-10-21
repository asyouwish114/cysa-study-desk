// CySA+ Study Desk app. Vanilla JS, no build step: reads data from window.CYSA (data/*.js) and renders four views.
// Progress is kept in localStorage. When the page runs inside claude.ai, window.claude also provides
// account sync (db) and the AI features (sample); everywhere else those features hide themselves.
(() => {
"use strict";

const { domains: DOMAINS, questions: BANK, flashcards: CARDS, labs: LABS = [] } = window.CYSA;
const DKEYS = Object.keys(DOMAINS);

// ---------- State ----------
const LS_KEY = "cysa-study-desk-v1";
function blankState() { return { answers: {}, known: [], history: [], custom: [], labs: {}, cvss: {}, exam: null, exams: [] }; }
let state = blankState();
let dbRef = null, writing = false, dirty = false, saveTimer = null;

function normalize(s) {
  const b = blankState();
  if (!s || typeof s !== "object") return b;
  b.answers = s.answers && typeof s.answers === "object" ? { ...s.answers } : {};
  b.known = Array.isArray(s.known) ? s.known.slice() : [];
  b.history = Array.isArray(s.history) ? s.history.slice(0, 30) : [];
  b.custom = Array.isArray(s.custom) ? s.custom.filter(validQ).slice(-80) : [];
  b.labs = s.labs && typeof s.labs === "object" && !Array.isArray(s.labs) ? { ...s.labs } : {};
  b.cvss = s.cvss && typeof s.cvss === "object" && !Array.isArray(s.cvss) ? { ...s.cvss } : {};
  const x = s.exam;
  b.exam = x && Array.isArray(x.ids) && Array.isArray(x.order) && x.ids.length === x.order.length && x.ids.length
    && Number.isFinite(x.start) && Number.isFinite(x.end) && x.picks && typeof x.picks === "object" && Array.isArray(x.flags)
    ? { ids: x.ids.slice(), order: x.order.slice(), picks: { ...x.picks }, flags: x.flags.slice(), i: Number.isInteger(x.i) ? x.i : 0, start: x.start, end: x.end }
    : null;
  b.exams = Array.isArray(s.exams) ? s.exams.slice(0, 20) : [];
  return b;
}
function hasProgress(s) { return Object.keys(s.answers).length || s.known.length || s.history.length || s.custom.length || Object.keys(s.labs).length || Object.keys(s.cvss).length || s.exam || s.exams.length; }

function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 1200);
}
async function flush() {
  if (!dbRef) return;
  if (writing) { dirty = true; return; }
  writing = true;
  try { await dbRef.set(JSON.parse(JSON.stringify(state))); }
  catch (e) { if (e && e.code === "invalid_argument") { dbRef = null; setSync(false); } }
  writing = false;
  if (dirty) { dirty = false; flush(); }
}
function setSync(on) {
  const el = document.getElementById("sync");
  el.classList.toggle("on", on);
  el.querySelector("span").textContent = on ? "Synced to your account" : "Saved in this browser";
}

async function connectStore() {
  if (!window.claude) return;
  try {
    const [db, user] = await Promise.all([claude.use("db"), claude.use("user")]);
    if (!db || !user) return;
    const uid = await user.id();
    if (!uid) return;
    const ref = db.doc("data/users/" + uid + "/progress");
    const snap = await ref.get();
    if (snap.exists) {
      const remote = normalize(snap.data());
      if (hasProgress(remote) || !hasProgress(state)) state = remote;
    }
    dbRef = ref;
    setSync(true);
    if (!snap.exists && hasProgress(state)) flush();
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
    renderAll();
  } catch (e) {}
}

// ---------- Helpers ----------
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function allQuestions() { return BANK.concat(state.custom); }
function validQ(q) {
  return q && typeof q.q === "string" && Array.isArray(q.o) && q.o.length === 4 && q.o.every(x => typeof x === "string")
    && Number.isInteger(q.a) && q.a >= 0 && q.a < 4 && DOMAINS[q.d] && typeof q.x === "string";
}
// Each attempted lab (in its own domain) and CVSS scenario (in Vulnerability Management) counts as one
// answer, scored by the latest try (older saves only have `best`).
const CVSS_DOMAIN = "vm";
function domainStats(d) {
  let c = 0, t = 0, n = 0, lb = 0, cv = 0;
  for (const q of allQuestions()) {
    if (q.d !== d) continue;
    const r = state.answers[q.id];
    if (r) { c += r.c; t += r.c + r.w; n += r.c + r.w; }
  }
  for (const L of LABS) {
    const r = L.d === d && state.labs[L.id];
    if (r) { c += (r.last ?? r.best) / 100; t += 1; lb += 1; }
  }
  if (d === CVSS_DOMAIN) {
    for (const s of window.CYSA.cvssScenarios || []) {
      const r = state.cvss[s.id];
      if (r) { c += (r.last ?? r.best) / 8; t += 1; cv += 1; }
    }
  }
  return { c, t, n, lb, cv, pct: t ? Math.round((c / t) * 100) : null };
}
function practicedText(s) {
  return s.n + " answered" + (s.lb ? " · " + s.lb + (s.lb > 1 ? " labs" : " lab") : "") + (s.cv ? " · " + s.cv + " CVSS" : "");
}
function readiness() {
  let sum = 0, wsum = 0;
  for (const d of DKEYS) { const s = domainStats(d); if (s.pct !== null) { sum += s.pct * DOMAINS[d].weight; wsum += DOMAINS[d].weight; } }
  return wsum ? { score: Math.round(sum / 100), coverage: wsum } : null;
}
// Light markdown: paragraphs, bullets, **bold**, `code`.
function md(text) {
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");
  const out = []; let list = null;
  for (const raw of String(text).split("\n")) {
    const line = raw.trim();
    const m = line.match(/^([-*•]|\d+[.)])\s+(.*)$/);
    if (m) { if (!list) { list = []; } list.push("<li>" + inline(m[2]) + "</li>"); continue; }
    if (list) { out.push("<ul>" + list.join("") + "</ul>"); list = null; }
    if (!line) continue;
    const h = line.match(/^#{1,4}\s+(.*)$/);
    out.push("<p>" + (h ? "<strong>" + inline(h[1]) + "</strong>" : inline(line)) + "</p>");
  }
  if (list) out.push("<ul>" + list.join("") + "</ul>");
  return out.join("");
}

// ---------- Tabs ----------
const TABS = ["overview", "practice", "exam", "labs", "cvss", "cards", "tutor"];
function showTab(t) {
  if (!TABS.includes(t)) t = "overview";
  for (const k of TABS) $("v-" + k).hidden = k !== t;
  document.querySelectorAll("nav.tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
  if (t === "overview") renderOverview();
  if (t === "cards") renderCard();
  if (t === "practice") renderPoolNote();
  if (t === "exam") renderExam();
  if (t === "labs") renderLabList();
  if (t === "cvss") setCvMode(cvMode);
}
document.querySelectorAll("nav.tabs button").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));

// ---------- Overview ----------
function statusPill(pct) {
  if (pct === null) return '<span class="pill none">Not started</span>';
  if (pct >= 80) return '<span class="pill ok">On track</span>';
  if (pct >= 60) return '<span class="pill mid">Building</span>';
  return '<span class="pill bad">Needs work</span>';
}
function renderOverview() {
  const r = readiness();
  const arc = $("gauge-arc"), C = 326.7;
  if (r) {
    $("gauge-val").textContent = r.score;
    arc.style.strokeDashoffset = String(C * (1 - r.score / 100));
    arc.setAttribute("stroke", r.score >= 80 ? "var(--ok)" : "var(--accent)");
    const weak = weakestDomain();
    $("ready-head").textContent = r.coverage < 100
      ? "Partial picture: " + (100 - r.coverage) + "% of the exam still untested"
      : (r.score >= 80 ? "You're in exam-ready range" : "Focus next on " + DOMAINS[weak].name);
  } else {
    $("gauge-val").textContent = "—";
    arc.style.strokeDashoffset = String(C);
    $("ready-head").textContent = "Start with a 10-question set";
  }
  $("domains").innerHTML = DKEYS.map(d => {
    const D = DOMAINS[d], s = domainStats(d);
    return `<div class="dom">
      <span class="num">${D.code}</span>
      <div style="min-width:0"><div class="name">${esc(D.name)} ${statusPill(s.pct)}</div>
        <div class="sub">${D.weight}% of exam · ${practicedText(s)}</div>
        <div class="topics">${D.topics.map(t => `<span>${esc(t)}</span>`).join("")}</div></div>
      <div class="barcell"><div class="bar"><span style="width:${s.pct ?? 0}%"></span><i class="target"></i></div></div>
      <span class="pct">${s.pct === null ? "—" : s.pct + "%"}</span>
    </div>`;
  }).join("");
  const h = state.history;
  $("history").innerHTML = h.length
    ? `<div style="overflow-x:auto"><table class="hist"><thead><tr><th>Date</th><th>Set</th><th class="r">Score</th></tr></thead><tbody>${
        h.slice(0, 8).map(x => `<tr><td class="mono">${esc(new Date(x.t).toLocaleDateString(undefined, { month: "short", day: "numeric" }))}</td><td>${esc(x.label)}</td><td class="r mono">${x.c}/${x.n} · ${Math.round(x.c / x.n * 100)}%</td></tr>`).join("")
      }</tbody></table></div>`
    : '<div class="empty">No sessions yet. Your scores will appear here after your first practice set.</div>';
}
function weakestDomain() {
  let best = null, bestScore = Infinity;
  for (const d of DKEYS) {
    const s = domainStats(d);
    const v = s.pct === null ? -1 : s.pct; // untested first
    const score = v - DOMAINS[d].weight / 100; // tie-break toward heavier domains
    if (score < bestScore) { bestScore = score; best = d; }
  }
  return best;
}
$("ov-start").onclick = () => { showTab("practice"); };
$("ov-weak").onclick = () => { $("q-domain").value = weakestDomain(); $("q-mode").value = "all"; showTab("practice"); startSet(); };

// ---------- Practice ----------
const domOpts = '<option value="any">All domains (weighted)</option>' + DKEYS.map(d => `<option value="${d}">${DOMAINS[d].code} ${esc(DOMAINS[d].name)}</option>`).join("");
$("q-domain").innerHTML = domOpts;
let run = null;

function poolFor(dom, mode) {
  let pool = allQuestions().filter(q => dom === "any" || q.d === dom);
  if (mode === "missed") pool = pool.filter(q => state.answers[q.id] && state.answers[q.id].w > 0 && state.answers[q.id].last === 0);
  if (mode === "new") pool = pool.filter(q => !state.answers[q.id]);
  return pool;
}
function renderPoolNote() {
  const p = poolFor($("q-domain").value, $("q-mode").value);
  $("pool-note").textContent = p.length + " question" + (p.length === 1 ? "" : "s") + " in this pool";
  $("q-start").disabled = !p.length;
}
["q-domain", "q-mode"].forEach(id => $(id).addEventListener("change", renderPoolNote));

function weightedPick(pool, n) {
  // Approximate exam weighting when drawing from all domains.
  const by = {}; for (const d of DKEYS) by[d] = shuffle(pool.filter(q => q.d === d));
  const out = [];
  while (out.length < n && DKEYS.some(d => by[d].length)) {
    let r = Math.random() * 100;
    for (const d of DKEYS) { r -= DOMAINS[d].weight; if (r <= 0) { if (by[d].length) out.push(by[d].pop()); break; } }
  }
  return shuffle(out);
}
function startSet(fixed) {
  const dom = $("q-domain").value, mode = $("q-mode").value, cnt = $("q-count").value;
  let qs;
  if (fixed) qs = shuffle(fixed);
  else {
    const pool = poolFor(dom, mode);
    const n = cnt === "all" ? pool.length : Math.min(Number(cnt), pool.length);
    qs = dom === "any" ? weightedPick(pool, n) : shuffle(pool).slice(0, n);
  }
  if (!qs.length) return;
  const label = fixed ? "Retry missed" : (dom === "any" ? "All domains" : DOMAINS[dom].code + " " + DOMAINS[dom].name) + (mode === "missed" ? " · missed" : mode === "new" ? " · new" : "");
  run = { qs, i: 0, correct: 0, missed: [], label, perDom: {} };
  $("q-setup").hidden = true; $("q-done").hidden = true; $("q-run").hidden = false;
  showQ();
}
let aiCtl = null;
function showQ() {
  const q = run.qs[run.i];
  aiCtl?.abort();
  run.order = shuffle([0, 1, 2, 3]);
  $("q-tag").textContent = DOMAINS[q.d].code + " " + DOMAINS[q.d].name + (q.gen ? " · generated" : "");
  $("q-pos").textContent = (run.i + 1) + " / " + run.qs.length;
  $("q-prog").style.width = (run.i / run.qs.length * 100) + "%";
  $("q-text").textContent = q.q;
  $("q-opts").innerHTML = run.order.map((oi, k) => `<button class="opt" data-oi="${oi}"><span class="k">${"ABCD"[k]}</span><span>${esc(q.o[oi])}</span></button>`).join("");
  $("q-opts").querySelectorAll(".opt").forEach(b => b.onclick = () => answer(Number(b.dataset.oi)));
  $("q-exp").hidden = true; $("q-ai").innerHTML = ""; $("q-next").disabled = true;
  $("q-next").textContent = run.i === run.qs.length - 1 ? "Finish" : "Next";
  $("q-ask").hidden = !sampleFn; $("q-ask").disabled = false;
}
function answer(oi) {
  const q = run.qs[run.i];
  if (!$("q-next").disabled) return;
  const ok = oi === q.a;
  $("q-opts").querySelectorAll(".opt").forEach(b => {
    const v = Number(b.dataset.oi);
    b.disabled = true;
    if (v === q.a) b.classList.add("right");
    else if (v === oi) b.classList.add("wrong");
  });
  const rec = state.answers[q.id] || { c: 0, w: 0 };
  if (ok) rec.c++; else rec.w++;
  rec.last = ok ? 1 : 0;
  state.answers[q.id] = rec;
  const pd = run.perDom[q.d] || (run.perDom[q.d] = { c: 0, n: 0 });
  pd.n++; if (ok) { pd.c++; run.correct++; } else run.missed.push(q);
  run.picked = oi;
  $("q-verdict").textContent = ok ? "Correct." : "Not quite. The answer is " + "ABCD"[run.order.indexOf(q.a)] + ".";
  $("q-verdict").className = "verdict " + (ok ? "ok" : "bad");
  $("q-why").textContent = q.x;
  $("q-exp").hidden = false;
  $("q-next").disabled = false;
  $("q-next").focus();
  save();
}
$("q-next").onclick = () => { run.i++; if (run.i >= run.qs.length) finishSet(); else showQ(); };
$("q-quit").onclick = () => { if (run && run.i > 0 || (run && !$("q-next").disabled)) { if (!$("q-next").disabled) run.i++; finishSet(); } else backToSetup(); };
function backToSetup() { aiCtl?.abort(); run = null; $("q-run").hidden = true; $("q-done").hidden = true; $("q-setup").hidden = false; renderPoolNote(); }
function finishSet() {
  aiCtl?.abort();
  const n = run.i;
  if (!n) return backToSetup();
  state.history.unshift({ t: Date.now(), label: run.label, c: run.correct, n });
  state.history = state.history.slice(0, 30);
  save();
  $("q-run").hidden = true; $("q-done").hidden = false;
  $("d-score").textContent = Math.round(run.correct / n * 100) + "%";
  $("d-detail").textContent = run.correct + " of " + n + " correct";
  $("d-breakdown").innerHTML = Object.entries(run.perDom).map(([d, v]) =>
    `<div class="dom" style="grid-template-columns:52px minmax(0,1fr) 64px"><span class="num">${DOMAINS[d].code}</span><span>${esc(DOMAINS[d].name)}</span><span class="pct">${v.c}/${v.n}</span></div>`).join("");
  $("d-missed").hidden = !run.missed.length;
  run.lastMissed = run.missed.slice();
}
$("d-again").onclick = backToSetup;
$("d-missed").onclick = () => startSet(run.lastMissed);
$("q-start").onclick = () => startSet();
document.addEventListener("keydown", e => {
  if ($("v-practice").hidden || $("q-run").hidden) return;
  if (["TEXTAREA", "SELECT", "INPUT"].includes(document.activeElement?.tagName)) return;
  const k = e.key.toUpperCase();
  const idx = "ABCD".indexOf(k) >= 0 ? "ABCD".indexOf(k) : "1234".indexOf(e.key);
  if (idx >= 0 && $("q-next").disabled) answer(run.order[idx]);
});

// ---------- Mock exam ----------
// One full-length timed attempt with no feedback until submit. The attempt lives in state.exam so it
// survives a reload, and the clock is wall time like the real exam. Picks are keyed by position.
const EXAM_N = 85, EXAM_MIN = 165, PASS = 750;
let exTick = null, exResult = null, exConfirm = null;
const qById = id => allQuestions().find(q => q.id === id);
// CompTIA doesn't publish its scaling, so this is a straight-line estimate onto 100-900.
const scaled = (c, n) => Math.round(100 + 800 * (n ? c / n : 0));

function examCounts(n) {
  // Split n across domains by weight, giving leftovers to the largest remainders.
  const raw = DKEYS.map(d => ({ d, v: n * DOMAINS[d].weight / 100 }));
  const out = {}; let left = n;
  for (const r of raw) { out[r.d] = Math.floor(r.v); left -= out[r.d]; }
  raw.sort((a, b) => b.v % 1 - a.v % 1).slice(0, left).forEach(r => out[r.d]++);
  return out;
}
function drawExam() {
  const want = examCounts(EXAM_N), picked = [], spare = [];
  for (const d of DKEYS) {
    const pool = shuffle(allQuestions().filter(q => q.d === d));
    picked.push(...pool.slice(0, want[d])); spare.push(...pool.slice(want[d]));
  }
  // A domain short of questions is topped up from the others.
  picked.push(...shuffle(spare).slice(0, EXAM_N - picked.length));
  return shuffle(picked);
}
function startExam() {
  const qs = drawExam();
  if (!qs.length) return;
  const now = Date.now();
  state.exam = { ids: qs.map(q => q.id), order: qs.map(() => shuffle([0, 1, 2, 3])), picks: {}, flags: [], i: 0, start: now, end: now + EXAM_MIN * 60000 };
  exResult = null;
  save();
  renderExam();
  $("x-text").scrollIntoView({ block: "center" });
}
const answeredCount = () => Object.keys(state.exam.picks).length;

function syncExamClock() {
  if (state.exam && !exTick) exTick = setInterval(tickExam, 1000);
  if (!state.exam && exTick) { clearInterval(exTick); exTick = null; }
  if (state.exam) tickExam();
}
function tickExam() {
  const ex = state.exam;
  if (!ex) return syncExamClock();
  const s = Math.ceil(Math.max(0, ex.end - Date.now()) / 1000);
  if (!s) return submitExam(true);
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
  $("x-timer").textContent = h + ":" + String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
  $("x-timer").className = "x-timer mono" + (s <= 300 ? " low" : s <= 900 ? " warn" : "");
}

function renderExam() {
  // Drop an attempt whose questions no longer exist (a removed generated question).
  if (state.exam && state.exam.ids.some(id => !qById(id))) { state.exam = null; save(); }
  syncExamClock();
  const ex = state.exam;
  $("x-setup").hidden = !!ex || !!exResult;
  $("x-run").hidden = !ex;
  $("x-done").hidden = $("x-review").hidden = !!ex || !exResult;
  if (ex) return showExamQ();
  if (exResult) return renderExamResult();
  const total = allQuestions().length;
  $("x-n").textContent = Math.min(EXAM_N, total);
  $("x-note").textContent = total >= EXAM_N
    ? `Each attempt draws ${EXAM_N} of your ${total} questions.`
    : `Your bank has ${total} questions, so this exam uses all of them.`;
  $("x-start").disabled = !total;
  const p = state.exams;
  $("x-past").innerHTML = p.length
    ? `<h3 style="margin-bottom:8px">Past attempts</h3><div style="overflow-x:auto"><table class="hist"><thead><tr><th>Date</th><th>Result</th><th class="r">Correct</th><th class="r">Time</th><th class="r">Score</th></tr></thead><tbody>${
        p.slice(0, 8).map(x => `<tr><td class="mono">${esc(new Date(x.t).toLocaleDateString(undefined, { month: "short", day: "numeric" }))}</td><td>${x.score >= PASS ? '<span class="pill ok">Pass</span>' : '<span class="pill bad">Below passing</span>'}</td><td class="r mono">${x.c}/${x.n}</td><td class="r mono">${x.mins} min</td><td class="r mono">${x.score}</td></tr>`).join("")
      }</tbody></table></div>`
    : "";
}
function showExamQ() {
  const ex = state.exam, q = qById(ex.ids[ex.i]), pick = ex.picks[ex.i];
  $("x-pos").textContent = "Question " + (ex.i + 1) + " of " + ex.ids.length;
  $("x-prog").style.width = (answeredCount() / ex.ids.length * 100) + "%";
  $("x-text").textContent = q.q;
  $("x-opts").innerHTML = ex.order[ex.i].map((oi, k) => `<button class="opt${pick === oi ? " sel" : ""}" data-oi="${oi}" aria-pressed="${pick === oi}"><span class="k">${"ABCD"[k]}</span><span>${esc(q.o[oi])}</span></button>`).join("");
  $("x-opts").querySelectorAll(".opt").forEach(b => b.onclick = () => pickExam(Number(b.dataset.oi)));
  const fl = ex.flags.includes(ex.i);
  $("x-flag").setAttribute("aria-pressed", String(fl));
  $("x-flag").textContent = fl ? "Flagged" : "Flag for review";
  $("x-prev").disabled = ex.i === 0;
  $("x-next").disabled = ex.i === ex.ids.length - 1;
  $("x-count").textContent = `· ${answeredCount()} answered · ${ex.flags.length} flagged`;
  $("x-grid").innerHTML = ex.ids.map((_, i) => {
    const a = ex.picks[i] !== undefined, f = ex.flags.includes(i);
    return `<button type="button" class="x-cell${a ? " ans" : ""}${f ? " flag" : ""}${i === ex.i ? " cur" : ""}" data-i="${i}" aria-label="Question ${i + 1}${a ? ", answered" : ""}${f ? ", flagged" : ""}"${i === ex.i ? ' aria-current="true"' : ""}>${i + 1}</button>`;
  }).join("");
  $("x-grid").querySelectorAll(".x-cell").forEach(b => b.onclick = () => goExam(Number(b.dataset.i)));
  tickExam();
}
function pickExam(oi) {
  state.exam.picks[state.exam.i] = oi;
  save();
  showExamQ();
  $("x-opts").querySelector(`[data-oi="${oi}"]`)?.focus();
}
function goExam(i) {
  const ex = state.exam;
  if (!ex || i < 0 || i >= ex.ids.length) return;
  ex.i = i;
  save();
  showExamQ();
}
$("x-prev").onclick = () => goExam(state.exam.i - 1);
$("x-next").onclick = () => goExam(state.exam.i + 1);
$("x-flag").onclick = () => {
  const ex = state.exam, k = ex.flags.indexOf(ex.i);
  if (k >= 0) ex.flags.splice(k, 1); else ex.flags.push(ex.i);
  save();
  showExamQ();
};
$("x-start").onclick = startExam;

// Inline confirmation instead of confirm(), which sandboxed frames can block.
function askExam(mode) {
  exConfirm = mode;
  const ex = state.exam, open = ex.ids.length - answeredCount();
  $("x-confirm-text").textContent = mode === "submit"
    ? (open ? `${open} question${open > 1 ? "s are" : " is"} unanswered and will count as wrong. ` : "Every question is answered. ") + (ex.flags.length ? `${ex.flags.length} still flagged for review.` : "")
    : "Abandon this attempt? It won't be scored or saved.";
  $("x-yes").textContent = mode === "submit" ? "Submit now" : "Abandon";
  $("x-confirm").hidden = false;
  $("x-yes").focus();
}
$("x-submit").onclick = () => askExam("submit");
$("x-quit").onclick = () => askExam("quit");
$("x-no").onclick = () => { $("x-confirm").hidden = true; };
$("x-yes").onclick = () => {
  $("x-confirm").hidden = true;
  if (exConfirm === "submit") return submitExam(false);
  state.exam = null;
  save();
  renderExam();
};

function submitExam(timeUp) {
  const ex = state.exam;
  if (!ex) return;
  state.exam = null;
  const items = ex.ids.map((id, i) => ({ q: qById(id), order: ex.order[i], pick: ex.picks[i], flag: ex.flags.includes(i), pos: i + 1 })).filter(it => it.q);
  let c = 0;
  const perDom = {};
  for (const it of items) {
    const ok = it.pick === it.q.a;
    const pd = perDom[it.q.d] || (perDom[it.q.d] = { c: 0, n: 0 });
    pd.n++;
    if (ok) { c++; pd.c++; }
    // Answered questions feed readiness and the "missed" pool, like a practice set; blanks don't.
    if (it.pick !== undefined) {
      const rec = state.answers[it.q.id] || { c: 0, w: 0 };
      if (ok) rec.c++; else rec.w++;
      rec.last = ok ? 1 : 0;
      state.answers[it.q.id] = rec;
    }
  }
  const n = items.length, score = scaled(c, n), mins = Math.round((Math.min(Date.now(), ex.end) - ex.start) / 60000);
  state.exams.unshift({ t: Date.now(), score, c, n, mins, perDom });
  state.exams = state.exams.slice(0, 20);
  state.history.unshift({ t: Date.now(), label: "Mock exam · scored " + score, c, n });
  state.history = state.history.slice(0, 30);
  save();
  exResult = { score, c, n, mins, perDom, items, timeUp };
  $("x-filter").value = "missed";
  if (!$("v-exam").hidden) { renderExam(); scrollTo(0, 0); }
}

function renderExamResult() {
  const r = exResult, pass = r.score >= PASS;
  $("x-scaled").textContent = r.score;
  $("x-verdict").innerHTML = `<span class="pill ${pass ? "ok" : "bad"}">${pass ? "Pass" : "Below passing"}</span>`;
  $("x-detail").textContent = `${r.c} of ${r.n} correct (${Math.round(r.c / r.n * 100)}%) · ${r.mins} of ${EXAM_MIN} minutes` + (r.timeUp ? " · time ran out" : "");
  $("x-breakdown").innerHTML = DKEYS.filter(d => r.perDom[d]).map(d => {
    const v = r.perDom[d], pct = Math.round(v.c / v.n * 100);
    return `<div class="dom"><span class="num">${DOMAINS[d].code}</span><div style="min-width:0"><div class="name">${esc(DOMAINS[d].name)} ${statusPill(pct)}</div><div class="sub">${v.c} of ${v.n} correct</div></div>
      <div class="barcell"><div class="bar"><span style="width:${pct}%"></span><i class="target"></i></div></div><span class="pct">${pct}%</span></div>`;
  }).join("");
  $("x-practice").hidden = !r.items.some(it => it.pick !== it.q.a);
  renderExamReview();
}
function renderExamReview() {
  const f = $("x-filter").value;
  const list = exResult.items.filter(it => f === "all" || (f === "flagged" ? it.flag : it.pick !== it.q.a));
  const opt = (it, oi) => esc(it.q.o[oi]);
  $("x-list").innerHTML = list.length ? list.map(it => {
    const ok = it.pick === it.q.a;
    const mine = it.pick === undefined ? '<b class="mk warn">Not answered</b>' : `<b class="mk ${ok ? "ok" : "bad"}">${opt(it, it.pick)}</b>`;
    return `<div class="x-item"><div class="qhead"><span class="tag">Q${it.pos} · ${DOMAINS[it.q.d].code} ${esc(DOMAINS[it.q.d].name)}</span>${it.flag ? '<span class="pill mid">Flagged</span>' : ""}</div>
      <p>${esc(it.q.q)}</p>
      <div class="x-ans"><span>Your answer: ${mine}</span>${ok ? "" : `<span>Correct: <b class="mk ok">${opt(it, it.q.a)}</b></span>`}</div>
      <div class="x-why">${esc(it.q.x)}</div></div>`;
  }).join("") : `<div class="empty">${f === "flagged" ? "You didn't flag any questions." : "Nothing missed. Every question was right."}</div>`;
}
$("x-filter").addEventListener("change", renderExamReview);
$("x-again").onclick = () => { exResult = null; renderExam(); };
$("x-practice").onclick = () => {
  const missed = exResult.items.filter(it => it.pick !== it.q.a).map(it => it.q);
  showTab("practice");
  startSet(missed);
};
document.addEventListener("keydown", e => {
  if ($("v-exam").hidden || !state.exam || e.ctrlKey || e.metaKey || e.altKey) return;
  if (["TEXTAREA", "SELECT", "INPUT"].includes(document.activeElement?.tagName)) return;
  const k = e.key.toUpperCase(), idx = "ABCD".indexOf(k) >= 0 ? "ABCD".indexOf(k) : "1234".indexOf(e.key);
  if (idx >= 0) pickExam(state.exam.order[state.exam.i][idx]);
  else if (e.key === "ArrowRight") goExam(state.exam.i + 1);
  else if (e.key === "ArrowLeft") goExam(state.exam.i - 1);
  else if (k === "F") $("x-flag").click();
});

// ---------- Claude (sample) ----------
let sampleFn = null;
function errCopy(code) {
  return ({
    not_granted: "Claude access wasn't allowed for this page.",
    sampling_disabled: "Claude isn't available for this account.",
    rate_limited: "Too many requests right now. Wait a minute and try again.",
    session_expired: "Your session expired. Sign in again to continue.",
    refused: "Claude couldn't answer that. Try rephrasing it.",
    invalid_json: "The questions came back in an unexpected format. Try again."
  })[code] || "Something went wrong reaching Claude. Try again.";
}
function hideAI() {
  sampleFn = null;
  $("gen-row").hidden = true;
  $("q-ask").hidden = true;
  $("t-off").hidden = false;
  $("t-form").hidden = true; $("t-chips").hidden = true;
  // Outside claude.ai the tutor can't work, so drop the tab instead of showing a dead end.
  document.querySelector('nav.tabs [data-tab="tutor"]').hidden = true;
  if (!$("v-tutor").hidden) showTab("overview");
}
async function connectSample() {
  if (!window.claude) { hideAI(); return; }
  try { sampleFn = await claude.use("sample"); } catch (e) { sampleFn = null; }
  if (!sampleFn) hideAI();
}

$("q-ask").onclick = async () => {
  const q = run.qs[run.i];
  const btn = $("q-ask"); btn.disabled = true;
  aiCtl = new AbortController();
  const out = $("q-ai"); out.textContent = "Thinking...";
  const prompt = `You are a CompTIA CySA+ (CS0-003) tutor. A student just answered this practice question.

Question: ${q.q}
Options:
${q.o.map((o, i) => "ABCD"[i] + ". " + o).join("\n")}
Correct answer: ${"ABCD"[q.a]}. ${q.o[q.a]}
Student picked: ${"ABCD"[run.picked]}. ${q.o[run.picked]}

In under 180 words: explain why the correct answer is right, why the student's choice ${run.picked === q.a ? "was right (they got it)" : "is wrong"}, and give one memory hook or exam tip for this concept. Use short paragraphs or bullets. No preamble.`;
  try {
    await sampleFn(prompt, { signal: aiCtl.signal, modelTier: "quick", onText: ({ text }) => { out.innerHTML = md(text); } });
  } catch (e) {
    if (e.code === "cancelled") return;
    if (["not_granted", "sampling_disabled"].includes(e.code)) { hideAI(); out.textContent = ""; return; }
    out.innerHTML = e.text ? md(e.text) : "";
    out.insertAdjacentHTML("beforeend", `<p class="gen-note">${esc(errCopy(e.code))}</p>`);
  } finally { btn.disabled = false; }
};

$("q-gen").onclick = async () => {
  const dom = $("q-domain").value === "any" ? weakestDomain() : $("q-domain").value;
  const D = DOMAINS[dom];
  const btn = $("q-gen"), st = $("gen-status");
  btn.disabled = true; st.textContent = "Writing 5 questions for " + D.code + " " + D.name + "... this can take up to a minute.";
  const existing = allQuestions().filter(q => q.d === dom).map(q => "- " + q.q.slice(0, 90)).join("\n");
  const prompt = `Write 5 new CompTIA CySA+ (exam CS0-003) practice questions for domain ${D.code} "${D.name}". Cover a spread of these objective areas: ${D.topics.join("; ")}.

Make them scenario-based like the real exam (an analyst sees X, what is most likely / what should they do first). Exactly 4 options each, one unambiguously correct, plausible distractors. Explanations: 1-3 sentences saying why the answer is right and why the strongest distractor is wrong. Be technically accurate.

Avoid repeating these existing questions:
${existing}

Reply with only a JSON array, like:
[{"q": "question text", "o": ["option A", "option B", "option C", "option D"], "a": 2, "x": "explanation"}]
"a" is the 0-based index of the correct option. Vary which index is correct.`;
  try {
    const arr = await sampleFn.json(prompt, { cache: false });
    const stamp = Date.now().toString(36);
    const added = (Array.isArray(arr) ? arr : []).map((q, i) => ({ id: "g" + stamp + i, d: dom, q: q.q, o: q.o, a: q.a, x: q.x, gen: true })).filter(validQ);
    if (!added.length) throw { code: "invalid_json" };
    state.custom = state.custom.concat(added).slice(-80);
    save();
    st.textContent = "Added " + added.length + " questions to " + D.code + ". Choose \"Not yet seen\" to practice just the new ones.";
    renderPoolNote();
  } catch (e) {
    if (["not_granted", "sampling_disabled"].includes(e.code)) { hideAI(); return; }
    st.textContent = errCopy(e.code);
  } finally { btn.disabled = false; }
};

// ---------- Log labs ----------
// A lab is graded like a PBQ: half the score for flagging the right log lines (false flags cancel hits),
// half for the follow-up questions. 80% is the pass mark used across the app.
let lab = null;
function labStatus(id) {
  const r = state.labs[id];
  if (!r) return '<span class="pill none">Not attempted</span>';
  return `<span class="pill ${r.best >= 80 ? "ok" : r.best >= 60 ? "mid" : "bad"}">Best ${r.best}%</span>`;
}
function renderLabList() {
  $("lab-cards").innerHTML = LABS.map(l => `<button class="lab-card" data-id="${esc(l.id)}">
      <span class="tag">${DOMAINS[l.d].code} ${esc(DOMAINS[l.d].name)}</span>
      <h3>${esc(l.title)}</h3>
      <span class="src">${esc(l.source)}</span>
      <span class="meta"><span class="mono" style="color:var(--muted);font-size:12.5px">${l.rows.length} lines · ${l.tasks.length + 1} tasks</span>${labStatus(l.id)}</span>
    </button>`).join("");
  $("lab-cards").querySelectorAll(".lab-card").forEach(b => b.onclick = () => openLab(b.dataset.id));
}
function openLab(id) {
  const L = LABS.find(l => l.id === id);
  if (!L) return;
  lab = { L, flags: new Set(), picks: L.tasks.map(() => null), orders: L.tasks.map(() => shuffle([0, 1, 2, 3])), graded: false };
  $("lab-list").hidden = true; $("lab-run").hidden = false; $("lab-result").hidden = true;
  $("lab-tag").textContent = DOMAINS[L.d].code + " " + DOMAINS[L.d].name + " · " + L.source;
  $("lab-title").textContent = L.title;
  $("lab-brief").textContent = L.brief;
  $("lab-submit").hidden = false;
  renderLabLog(); renderLabTasks(); updateLabHint();
  window.scrollTo(0, 0);
}
function closeLab() {
  lab = null;
  $("lab-run").hidden = true; $("lab-list").hidden = false;
  renderLabList();
}
function toggleFlag(tr) {
  const i = Number(tr.dataset.i);
  if (lab.flags.has(i)) lab.flags.delete(i); else lab.flags.add(i);
  tr.classList.toggle("flag", lab.flags.has(i));
  tr.setAttribute("aria-checked", String(lab.flags.has(i)));
  updateLabHint();
}
function renderLabLog() {
  const L = lab.L, g = lab.graded, span = L.cols.length + (g ? 1 : 0);
  const head = "<thead><tr>" + L.cols.map(c => `<th>${esc(c)}</th>`).join("") + (g ? "<th>Result</th>" : "") + "</tr></thead>";
  const body = L.rows.map((r, i) => {
    const f = lab.flags.has(i);
    let cls = "line" + (f ? " flag" : ""), mark = "", note = "";
    if (g) {
      cls = "line" + (r.bad && f ? " hit" : r.bad ? " miss" : f ? " false" : "");
      mark = r.bad && f ? '<span class="mk ok">Caught</span>' : r.bad ? '<span class="mk warn">Missed</span>' : f ? '<span class="mk bad">Not malicious</span>' : "";
      if (r.note && (r.bad || f)) note = `<tr class="note"><td colspan="${span}">${esc(r.note)}</td></tr>`;
    }
    const attrs = g ? "" : ` tabindex="0" role="checkbox" aria-checked="${f}"`;
    return `<tr class="${cls}" data-i="${i}"${attrs}>${r.f.map(v => `<td>${esc(v)}</td>`).join("")}${g ? `<td>${mark}</td>` : ""}</tr>${note}`;
  }).join("");
  $("lab-log").innerHTML = head + "<tbody>" + body + "</tbody>";
  $("lab-log").classList.toggle("graded", g);
  if (!g) $("lab-log").querySelectorAll("tr.line").forEach(tr => {
    tr.onclick = () => toggleFlag(tr);
    tr.onkeydown = e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleFlag(tr); } };
  });
}
function renderLabTasks(focus) {
  const L = lab.L, g = lab.graded;
  $("lab-tasks").innerHTML = L.tasks.map((t, ti) => {
    const ok = lab.picks[ti] === t.a;
    const opts = lab.orders[ti].map((oi, k) => {
      let cls = "opt";
      if (g) { if (oi === t.a) cls += " right"; else if (oi === lab.picks[ti]) cls += " wrong"; }
      else if (oi === lab.picks[ti]) cls += " sel";
      return `<button class="${cls}" data-t="${ti}" data-oi="${oi}" aria-pressed="${oi === lab.picks[ti]}"${g ? " disabled" : ""}><span class="k">${"ABCD"[k]}</span><span>${esc(t.o[oi])}</span></button>`;
    }).join("");
    const exp = g ? `<div class="explain"><div class="verdict ${ok ? "ok" : "bad"}">${ok ? "Correct." : "Not quite."}</div><div>${esc(t.x)}</div></div>` : "";
    return `<div class="lab-q"><div class="step"><span class="mono">${ti + 2}</span> ${esc(t.q)}</div><div class="opts">${opts}</div>${exp}</div>`;
  }).join("");
  if (g) return;
  $("lab-tasks").querySelectorAll(".opt").forEach(b => b.onclick = () => {
    lab.picks[Number(b.dataset.t)] = Number(b.dataset.oi);
    renderLabTasks(`.opt[data-t="${b.dataset.t}"][data-oi="${b.dataset.oi}"]`);
    updateLabHint();
  });
  if (focus) $("lab-tasks").querySelector(focus)?.focus();
}
function updateLabHint() {
  if (lab.graded) return;
  $("lab-flagcount").textContent = "· " + lab.flags.size + " flagged";
  const todo = [];
  if (!lab.flags.size) todo.push("flag at least one line");
  lab.picks.forEach((p, i) => { if (p === null) todo.push("answer question " + (i + 2)); });
  $("lab-hint").textContent = todo.length ? "To submit: " + todo.join(", ") + "." : "Ready to submit.";
  $("lab-submit").disabled = todo.length > 0;
}
function gradeLab() {
  const L = lab.L;
  const bad = L.rows.map((r, i) => (r.bad ? i : -1)).filter(i => i >= 0);
  const hits = bad.filter(i => lab.flags.has(i)).length;
  const falses = [...lab.flags].filter(i => !L.rows[i].bad).length;
  const linePts = Math.round(50 * Math.max(0, hits - falses) / bad.length);
  const right = L.tasks.filter((t, i) => lab.picks[i] === t.a).length;
  const taskPts = Math.round(50 * right / L.tasks.length);
  const score = linePts + taskPts;
  lab.graded = true;
  renderLabLog(); renderLabTasks();
  $("lab-flagcount").textContent = ""; $("lab-hint").textContent = ""; $("lab-submit").hidden = true;

  const rec = state.labs[L.id] || { best: 0, tries: 0 };
  state.labs[L.id] = { best: Math.max(rec.best, score), tries: rec.tries + 1, last: score };
  state.history.unshift({ t: Date.now(), label: "Lab: " + L.title, c: score, n: 100 });
  state.history = state.history.slice(0, 30);
  save();

  $("lab-score").textContent = score + "%";
  $("lab-verdict").textContent = score >= 80 ? "Pass. Solid analysis." : "Below the 80% target. Read the notes on each line, then try again.";
  const row = (label, pts) => `<div class="dom" style="grid-template-columns:minmax(0,1fr) auto"><span>${label}</span><span class="pct">${pts} / 50</span></div>`;
  $("lab-breakdown").innerHTML =
    row(`Log lines: caught ${hits} of ${bad.length}${falses ? `, flagged ${falses} benign line${falses > 1 ? "s" : ""} (each cancels a catch)` : ""}`, linePts) +
    row(`Questions: ${right} of ${L.tasks.length} correct`, taskPts);
  $("lab-debrief").textContent = L.debrief;
  $("lab-result").hidden = false;
  $("lab-result").scrollIntoView({ block: "start" });
}
$("lab-submit").onclick = gradeLab;
$("lab-back").onclick = closeLab;
$("lab-back2").onclick = closeLab;
$("lab-retry").onclick = () => openLab(lab.L.id);

// ---------- CVSS ----------
// Calculator plus scoring challenges. The math lives in js/cvss.js (unit-tested); this section is UI only.
const CV = window.CYSA.cvss, CV_SC = window.CYSA.cvssScenarios || [];
const SEV = { None: "none", Low: "low", Medium: "med", High: "high", Critical: "crit" };
const metricLabel = (k, v) => CV.METRICS.find(m => m.key === k).values.find(x => x.v === v).label;
let cvMode = "calc";
let cvSel = CV.parse("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H");
let ch = { i: 0, sel: {}, graded: false };

// Renders the eight metric rows as button groups. With `answer`, shows grading instead of accepting input.
function renderPicker(el, sel, onPick, answer) {
  el.innerHTML = CV.METRICS.map(m => `<div class="cv-row"><div class="cv-name">${esc(m.name)}<span class="mono">${m.key}</span></div><div class="cv-seg" role="group" aria-label="${esc(m.name)}">${
    m.values.map(x => {
      let cls = "cv-opt";
      if (answer) { if (x.v === answer[m.key]) cls += " right"; else if (x.v === sel[m.key]) cls += " wrong"; }
      else if (x.v === sel[m.key]) cls += " on";
      return `<button type="button" class="${cls}" data-k="${m.key}" data-v="${x.v}" aria-pressed="${x.v === sel[m.key]}" title="${esc(x.mean)}"${answer ? " disabled" : ""}>${esc(x.label)}</button>`;
    }).join("")}</div></div>`).join("");
  if (!answer) el.querySelectorAll(".cv-opt").forEach(b => b.onclick = () => {
    onPick(b.dataset.k, b.dataset.v);
    el.querySelector(`[data-k="${b.dataset.k}"][data-v="${b.dataset.v}"]`)?.focus();
  });
}

function setCvMode(mode) {
  cvMode = mode;
  $("cv-calc").hidden = mode !== "calc";
  $("cv-chal").hidden = mode !== "chal";
  document.querySelectorAll("#cv-modes button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
  if (mode === "chal") renderChallenge(); else renderCalc();
}
document.querySelectorAll("#cv-modes button").forEach(b => b.onclick = () => setCvMode(b.dataset.mode));

function renderCalc() {
  renderPicker($("cv-picker"), cvSel, (k, v) => { cvSel = { ...cvSel, [k]: v }; renderCalc(); });
  const r = CV.score(cvSel);
  $("cv-num").textContent = r.score.toFixed(1);
  $("cv-num").className = "cv-num sevtext-" + SEV[r.severity];
  $("cv-sev").textContent = r.severity;
  $("cv-sev").className = "pill sev-" + SEV[r.severity];
  $("cv-marker").style.left = r.score * 10 + "%";
  $("cv-sub").textContent = `Impact ${r.impact.toFixed(1)} · Exploitability ${r.exploitability.toFixed(1)}`;
  $("cv-vector").textContent = CV.toVector(cvSel);
  $("cv-mean").innerHTML = CV.METRICS.map(m => {
    const x = m.values.find(v => v.v === cvSel[m.key]);
    return `<div class="cv-m"><span class="mono">${m.key}:${x.v}</span><div><b>${esc(m.name)}: ${esc(x.label)}.</b> ${esc(x.mean)}</div></div>`;
  }).join("");
}
$("cv-copy").onclick = () => {
  const btn = $("cv-copy"), text = $("cv-vector").textContent;
  const selectIt = () => { const r = document.createRange(); r.selectNodeContents($("cv-vector")); getSelection().removeAllRanges(); getSelection().addRange(r); };
  const done = msg => { btn.textContent = msg; setTimeout(() => { btn.textContent = "Copy vector"; }, 1500); };
  try { navigator.clipboard.writeText(text).then(() => done("Copied"), () => { selectIt(); done("Press Ctrl+C"); }); }
  catch (e) { selectIt(); done("Press Ctrl+C"); }
};
$("cv-form").addEventListener("submit", e => {
  e.preventDefault();
  const sel = CV.parse($("cv-paste").value);
  if (!sel) { $("cv-err").textContent = "That isn't a complete CVSS 3.1 base vector. It needs all eight metrics, for example CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H."; return; }
  $("cv-err").textContent = "";
  cvSel = sel;
  renderCalc();
});

$("ch-select").innerHTML = CV_SC.map((s, i) => `<option value="${i}">${i + 1}. ${esc(s.title)}</option>`).join("");
$("ch-select").addEventListener("change", () => openChallenge(Number($("ch-select").value)));
function openChallenge(i) {
  ch = { i, sel: {}, graded: false };
  $("ch-select").value = String(i);
  renderChallenge();
}
function renderChallenge() {
  const s = CV_SC[ch.i];
  if (!s) return;
  const rec = state.cvss[s.id];
  $("ch-status").innerHTML = rec
    ? `<span class="pill ${rec.best === 8 ? "ok" : rec.best >= 6 ? "mid" : "bad"}">Best ${rec.best}/8</span>`
    : '<span class="pill none">Not attempted</span>';
  $("ch-title").textContent = s.title;
  $("ch-text").textContent = s.scenario;
  renderPicker($("ch-picker"), ch.sel, (k, v) => { ch.sel = { ...ch.sel, [k]: v }; renderChallenge(); }, ch.graded ? CV.parse(s.vector) : null);
  const left = CV.KEYS.filter(k => !ch.sel[k]).length;
  $("ch-hint").textContent = ch.graded ? "" : left ? `Pick ${left} more metric${left > 1 ? "s" : ""} to check your vector.` : "Ready to check.";
  $("ch-submit").disabled = left > 0;
  $("ch-submit").hidden = ch.graded;
  $("ch-result").hidden = !ch.graded;
}
function gradeChallenge() {
  const s = CV_SC[ch.i], ans = CV.parse(s.vector);
  const right = CV.KEYS.filter(k => ch.sel[k] === ans[k]).length;
  const mine = CV.score(ch.sel), real = CV.score(ans);
  ch.graded = true;
  const rec = state.cvss[s.id] || { best: 0, tries: 0 };
  state.cvss[s.id] = { best: Math.max(rec.best, right), tries: rec.tries + 1, last: right };
  state.history.unshift({ t: Date.now(), label: "CVSS: " + s.title, c: right, n: 8 });
  state.history = state.history.slice(0, 30);
  save();

  $("ch-score").textContent = right + " / 8";
  $("ch-verdict").textContent = right === 8
    ? `Perfect vector. It scores ${real.score.toFixed(1)} (${real.severity}).`
    : `Your vector scores ${mine.score.toFixed(1)} (${mine.severity}). The correct one scores ${real.score.toFixed(1)} (${real.severity}).`;
  $("ch-vectors").innerHTML =
    `<div><span class="label">Your vector</span><code class="cv-vec">${esc(CV.toVector(ch.sel))}</code></div>` +
    `<div><span class="label">Correct vector</span><code class="cv-vec">${esc(s.vector)}</code></div>`;
  $("ch-why").innerHTML = "<thead><tr><th>Metric</th><th>You</th><th>Answer</th><th>Why</th></tr></thead><tbody>" + CV.METRICS.map(m => {
    const ok = ch.sel[m.key] === ans[m.key];
    return `<tr><td>${esc(m.name)}</td><td><span class="mk ${ok ? "ok" : "bad"}">${esc(metricLabel(m.key, ch.sel[m.key]))}</span></td><td>${esc(metricLabel(m.key, ans[m.key]))}</td><td>${esc(s.why[m.key])}</td></tr>`;
  }).join("") + "</tbody>";
  renderChallenge();
  $("ch-result").scrollIntoView({ block: "start" });
}
$("ch-submit").onclick = gradeChallenge;
$("ch-retry").onclick = () => openChallenge(ch.i);
$("ch-next").onclick = () => openChallenge((ch.i + 1) % CV_SC.length);

// ---------- Flashcards ----------
$("c-domain").innerHTML = '<option value="any">All domains</option>' + DKEYS.map(d => `<option value="${d}">${DOMAINS[d].code} ${esc(DOMAINS[d].name)}</option>`).join("");
let deck = [], ci = 0;
function buildDeck() {
  const d = $("c-domain").value, f = $("c-filter").value;
  deck = CARDS.filter(c => (d === "any" || c.d === d) && (f === "all" || !state.known.includes(c.id)));
  ci = Math.min(ci, Math.max(0, deck.length - 1));
}
function renderCard() {
  buildDeck();
  const card = $("card"); card.classList.remove("flipped");
  const known = CARDS.filter(c => state.known.includes(c.id) && ($("c-domain").value === "any" || c.d === $("c-domain").value)).length;
  const total = CARDS.filter(c => $("c-domain").value === "any" || c.d === $("c-domain").value).length;
  $("c-count").textContent = known + " / " + total + " known";
  if (!deck.length) {
    $("c-dom").textContent = ""; $("c-term").textContent = "Deck cleared";
    $("c-dom2").textContent = ""; $("c-def").textContent = "You've marked every card in this deck as known. Switch Show to \"All cards\" to review them again.";
    ["c-know", "c-again", "c-prev"].forEach(id => $(id).disabled = true);
    return;
  }
  ["c-know", "c-again", "c-prev"].forEach(id => $(id).disabled = false);
  const c = deck[ci];
  const tag = DOMAINS[c.d].code + " " + DOMAINS[c.d].name + " · " + (ci + 1) + "/" + deck.length;
  $("c-dom").textContent = tag; $("c-dom2").textContent = tag;
  $("c-term").textContent = c.term; $("c-def").textContent = c.def;
}
function flip() { if (deck.length) $("card").classList.toggle("flipped"); }
$("card").onclick = flip;
$("card").addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } });
$("c-know").onclick = () => {
  const c = deck[ci]; if (!c) return;
  if (!state.known.includes(c.id)) state.known.push(c.id);
  save();
  if ($("c-filter").value === "all") ci = (ci + 1) % deck.length;
  renderCard();
};
$("c-again").onclick = () => {
  const c = deck[ci]; if (!c) return;
  state.known = state.known.filter(id => id !== c.id); save();
  ci = (ci + 1) % deck.length; renderCard();
};
$("c-prev").onclick = () => { if (deck.length) { ci = (ci - 1 + deck.length) % deck.length; renderCard(); } };
["c-domain", "c-filter"].forEach(id => $(id).addEventListener("change", () => { ci = 0; renderCard(); }));

// ---------- Tutor ----------
const turns = [];
const CHIPS = [
  "What's the difference between STIX and TAXII?",
  "Walk me through scoring a CVSS v3.1 vector",
  "Quiz me on the order of volatility",
  "How should I approach performance-based questions?",
  "Build me a 2-week study plan from my scores"
];
$("t-chips").innerHTML = CHIPS.map(c => `<button class="chip" type="button">${esc(c)}</button>`).join("");
$("t-chips").querySelectorAll(".chip").forEach(b => b.onclick = () => { $("t-input").value = b.textContent; sendTutor(); });

function tutorRules() {
  const scores = DKEYS.map(d => { const s = domainStats(d); return `${DOMAINS[d].code} ${DOMAINS[d].name} (${DOMAINS[d].weight}% of exam): ${s.pct === null ? "not practiced yet" : s.pct + "% (" + practicedText(s) + ")"}`; }).join("\n");
  return `You are a patient, precise tutor for the CompTIA CySA+ exam (CS0-003). Keep answers focused and exam-relevant, under about 250 words unless asked for more. Use concrete SOC-analyst examples, name the relevant exam domain when useful, and end with a one-line exam tip when it fits. If you quiz the student, ask one question at a time and wait for their answer. Plain text with short paragraphs or "- " bullets; **bold** sparingly.

The student's current practice accuracy:
${scores}`;
}
function addMsg(role, html) {
  const el = document.createElement("div");
  el.className = "msg " + (role === "user" ? "me" : "ai");
  el.innerHTML = html;
  $("t-chat").appendChild(el);
  $("t-chat").scrollTop = $("t-chat").scrollHeight;
  return el;
}
let tutorCtl = null;
async function sendTutor() {
  const text = $("t-input").value.trim();
  if (!text || !sampleFn) return;
  if (tutorCtl) { tutorCtl.abort(); }
  $("t-input").value = "";
  turns.push({ role: "user", content: text });
  addMsg("user", md(text));
  const bubble = addMsg("assistant", "Thinking...");
  tutorCtl = new AbortController();
  $("t-send").disabled = true;
  try {
    const recent = turns.slice(-12);
    if (recent[0].role !== "user") recent.shift();
    const { text: reply } = await sampleFn([{ role: "user", content: tutorRules() }, ...recent], {
      cache: false, signal: tutorCtl.signal,
      onText: ({ text }) => { bubble.innerHTML = md(text); $("t-chat").scrollTop = $("t-chat").scrollHeight; }
    });
    turns.push({ role: "assistant", content: reply });
  } catch (e) {
    if (e.code === "cancelled") { bubble.innerHTML = e.text ? md(e.text) : "<em>Stopped.</em>"; return; }
    if (["not_granted", "sampling_disabled"].includes(e.code)) { hideAI(); bubble.remove(); return; }
    bubble.innerHTML = (e.text ? md(e.text) : "") + `<p><em>${esc(errCopy(e.code))}</em></p>`;
  } finally { $("t-send").disabled = false; }
}
$("t-form").addEventListener("submit", e => { e.preventDefault(); sendTutor(); });
$("t-input").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendTutor(); } });
addMsg("assistant", md("Hi! Ask me about anything on the CySA+ objectives, from SIEM queries and CVSS scoring to IR phases and reporting. You can also ask me to quiz you, or to plan your study time around your weakest domains."));

// ---------- Boot ----------
function renderAll() { renderOverview(); renderPoolNote(); if (!$("v-cards").hidden) renderCard(); if (!$("v-exam").hidden) renderExam(); else syncExamClock(); }
try { const raw = localStorage.getItem(LS_KEY); if (raw) state = normalize(JSON.parse(raw)); } catch (e) {}
const initial = (location.hash || "").slice(1);
showTab(TABS.includes(initial) ? initial : "overview");
renderAll();
connectStore();
connectSample();
})();
