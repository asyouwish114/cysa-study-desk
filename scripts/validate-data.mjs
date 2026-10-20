#!/usr/bin/env node
// Validates the study data in data/*.js. Run: node scripts/validate-data.mjs
// Exits 1 and lists every problem when the data is invalid. Used by CI and by the Claude Code hook.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = ["data/domains.js", "data/questions.js", "data/flashcards.js", "data/labs.js", "data/cvss.js", "js/cvss.js"];

// The data files assign to window.CYSA, so run them in a sandbox with a fake window.
const sandbox = { window: {} };
vm.createContext(sandbox);
const errors = [];
for (const f of files) {
  try { vm.runInContext(readFileSync(join(root, f), "utf8"), sandbox, { filename: f }); }
  catch (e) { errors.push(`${f}: does not load (${e.message})`); }
}
const { domains = {}, questions = [], flashcards = [], labs = [], cvssScenarios = [], cvss } = sandbox.window.CYSA || {};
const isText = v => typeof v === "string" && v.trim().length > 0;

// Domains
const keys = Object.keys(domains);
if (!keys.length) errors.push("domains: none defined");
const total = keys.reduce((s, k) => s + (domains[k].weight || 0), 0);
if (keys.length && total !== 100) errors.push(`domains: weights sum to ${total}, expected 100`);
for (const k of keys) {
  const d = domains[k];
  if (!isText(d.code) || !isText(d.name)) errors.push(`domains.${k}: needs code and name`);
  if (!Array.isArray(d.topics) || !d.topics.length) errors.push(`domains.${k}: needs at least one topic`);
}

// Questions
const qIds = new Set(), qTexts = new Set();
questions.forEach((q, i) => {
  const at = `questions[${i}]${q && q.id ? ` (${q.id})` : ""}`;
  if (!q || typeof q !== "object") return errors.push(`${at}: not an object`);
  if (!isText(q.id)) errors.push(`${at}: missing id`);
  else if (qIds.has(q.id)) errors.push(`${at}: duplicate id`);
  else qIds.add(q.id);
  if (!domains[q.d]) errors.push(`${at}: unknown domain "${q.d}"`);
  if (!isText(q.q)) errors.push(`${at}: missing question text`);
  else {
    const norm = q.q.trim().toLowerCase();
    if (qTexts.has(norm)) errors.push(`${at}: duplicate question text`);
    qTexts.add(norm);
  }
  if (!Array.isArray(q.o) || q.o.length !== 4 || !q.o.every(isText)) errors.push(`${at}: needs exactly 4 non-empty options`);
  else if (new Set(q.o.map(o => o.trim().toLowerCase())).size !== 4) errors.push(`${at}: options must be distinct`);
  if (!Number.isInteger(q.a) || q.a < 0 || q.a > 3) errors.push(`${at}: answer index "a" must be 0-3`);
  if (!isText(q.x)) errors.push(`${at}: missing explanation`);
});

// Flashcards
const cIds = new Set();
flashcards.forEach((c, i) => {
  const at = `flashcards[${i}]${c && c.id ? ` (${c.id})` : ""}`;
  if (!isText(c.id)) errors.push(`${at}: missing id`);
  else if (cIds.has(c.id)) errors.push(`${at}: duplicate id`);
  else cIds.add(c.id);
  if (!domains[c.d]) errors.push(`${at}: unknown domain "${c.d}"`);
  if (!isText(c.term) || !isText(c.def)) errors.push(`${at}: needs term and def`);
});

// Log labs
const checkTask = (t, at) => {
  if (!isText(t.q)) errors.push(`${at}: missing question`);
  if (!Array.isArray(t.o) || t.o.length !== 4 || !t.o.every(isText)) errors.push(`${at}: needs exactly 4 non-empty options`);
  else if (new Set(t.o.map(o => o.trim().toLowerCase())).size !== 4) errors.push(`${at}: options must be distinct`);
  if (!Number.isInteger(t.a) || t.a < 0 || t.a > 3) errors.push(`${at}: answer index "a" must be 0-3`);
  if (!isText(t.x)) errors.push(`${at}: missing explanation`);
};
const lIds = new Set();
labs.forEach((l, i) => {
  const at = `labs[${i}]${l && l.id ? ` (${l.id})` : ""}`;
  if (!isText(l.id)) errors.push(`${at}: missing id`);
  else if (lIds.has(l.id)) errors.push(`${at}: duplicate id`);
  else lIds.add(l.id);
  if (!domains[l.d]) errors.push(`${at}: unknown domain "${l.d}"`);
  for (const k of ["title", "source", "brief", "debrief"]) if (!isText(l[k])) errors.push(`${at}: missing ${k}`);
  const cols = Array.isArray(l.cols) && l.cols.length && l.cols.every(isText) ? l.cols.length : 0;
  if (!cols) errors.push(`${at}: needs column headers in cols`);
  if (!Array.isArray(l.rows) || l.rows.length < 4) return errors.push(`${at}: needs at least 4 log rows`);
  l.rows.forEach((r, j) => {
    const rat = `${at} rows[${j}]`;
    if (!Array.isArray(r.f) || r.f.length !== cols) errors.push(`${rat}: has ${r.f?.length ?? 0} fields, expected ${cols}`);
    if (r.bad && !isText(r.note)) errors.push(`${rat}: malicious rows need a note explaining why`);
  });
  if (!l.rows.some(r => r.bad)) errors.push(`${at}: no rows marked bad`);
  if (l.rows.every(r => r.bad)) errors.push(`${at}: every row is bad; include benign lines as distractors`);
  if (!Array.isArray(l.tasks) || !l.tasks.length) errors.push(`${at}: needs at least one task`);
  else l.tasks.forEach((t, j) => checkTask(t, `${at} tasks[${j}]`));
});

// CVSS scenarios: the vector must be a complete, valid CVSS 3.1 base vector, with a reason for every metric.
const sIds = new Set();
cvssScenarios.forEach((s, i) => {
  const at = `cvssScenarios[${i}]${s && s.id ? ` (${s.id})` : ""}`;
  if (!isText(s.id)) errors.push(`${at}: missing id`);
  else if (sIds.has(s.id)) errors.push(`${at}: duplicate id`);
  else sIds.add(s.id);
  if (!isText(s.title) || !isText(s.scenario)) errors.push(`${at}: needs title and scenario`);
  if (!cvss) return;
  if (!cvss.parse(s.vector)) errors.push(`${at}: vector "${s.vector}" is not a complete CVSS 3.1 base vector`);
  for (const k of cvss.KEYS) if (!s.why || !isText(s.why[k])) errors.push(`${at}: missing why.${k}`);
});

if (errors.length) {
  console.error(`Data validation failed with ${errors.length} problem(s):`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
const perDomain = keys.map(k => `${domains[k].code} ${questions.filter(q => q.d === k).length}`).join(", ");
console.log(`OK: ${questions.length} questions (${perDomain}), ${flashcards.length} flashcards, ${labs.length} labs, ${cvssScenarios.length} CVSS scenarios, ${keys.length} domains.`);
