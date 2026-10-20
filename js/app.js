// CySA+ Study Desk app. Vanilla JS, no build step: reads data from window.CYSA (data/*.js) and renders four views.
// Progress is kept in localStorage. When the page runs inside claude.ai, window.claude also provides
// account sync (db) and the AI features (sample); everywhere else those features hide themselves.
(() => {
"use strict";

const { domains: DOMAINS, questions: BANK, flashcards: CARDS } = window.CYSA;
const DKEYS = Object.keys(DOMAINS);

// ---------- State ----------
const LS_KEY = "cysa-study-desk-v1";
function blankState() { return { answers: {}, known: [], history: [], custom: [] }; }
let state = blankState();
let dbRef = null, writing = false, dirty = false, saveTimer = null;

function normalize(s) {
  const b = blankState();
  if (!s || typeof s !== "object") return b;
  b.answers = s.answers && typeof s.answers === "object" ? { ...s.answers } : {};
  b.known = Array.isArray(s.known) ? s.known.slice() : [];
  b.history = Array.isArray(s.history) ? s.history.slice(0, 30) : [];
  b.custom = Array.isArray(s.custom) ? s.custom.filter(validQ).slice(-80) : [];
  return b;
}
function hasProgress(s) { return Object.keys(s.answers).length || s.known.length || s.history.length || s.custom.length; }

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
function domainStats(d) {
  let c = 0, t = 0;
  for (const q of allQuestions()) {
    if (q.d !== d) continue;
    const r = state.answers[q.id];
    if (r) { c += r.c; t += r.c + r.w; }
  }
  return { c, t, pct: t ? Math.round((c / t) * 100) : null };
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
const TABS = ["overview", "practice", "cards", "tutor"];
function showTab(t) {
  if (!TABS.includes(t)) t = "overview";
  for (const k of TABS) $("v-" + k).hidden = k !== t;
  document.querySelectorAll("nav.tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
  if (t === "overview") renderOverview();
  if (t === "cards") renderCard();
  if (t === "practice") renderPoolNote();
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
        <div class="sub">${D.weight}% of exam · ${s.t} answered</div>
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
  const scores = DKEYS.map(d => { const s = domainStats(d); return `${DOMAINS[d].code} ${DOMAINS[d].name} (${DOMAINS[d].weight}% of exam): ${s.pct === null ? "not practiced yet" : s.pct + "% over " + s.t + " answers"}`; }).join("\n");
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
function renderAll() { renderOverview(); renderPoolNote(); if (!$("v-cards").hidden) renderCard(); }
try { const raw = localStorage.getItem(LS_KEY); if (raw) state = normalize(JSON.parse(raw)); } catch (e) {}
const initial = (location.hash || "").slice(1);
showTab(TABS.includes(initial) ? initial : "overview");
renderAll();
connectStore();
connectSample();
})();
