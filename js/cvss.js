// CVSS v3.1 base score calculator, following the FIRST specification (https://www.first.org/cvss/v3.1/specification-document).
// Plain script with no DOM access: the app uses it via window.CYSA.cvss and the tests load it in Node.
(function (root) {
  "use strict";

  // Metric definitions in vector order. Each value carries its spec weight and a plain-language meaning.
  const METRICS = [
    { key: "AV", name: "Attack Vector", values: [
      { v: "N", label: "Network", w: 0.85, mean: "Exploitable remotely across networks, including the internet." },
      { v: "A", label: "Adjacent", w: 0.62, mean: "The attacker must be on the same local network segment, such as the same Wi-Fi, VLAN or Bluetooth range." },
      { v: "L", label: "Local", w: 0.55, mean: "The attacker needs local access (a shell or logged-in session), or a user must open a malicious file." },
      { v: "P", label: "Physical", w: 0.2, mean: "The attacker must physically touch or handle the device." }] },
    { key: "AC", name: "Attack Complexity", values: [
      { v: "L", label: "Low", w: 0.77, mean: "No special conditions. The attack works reliably, again and again." },
      { v: "H", label: "High", w: 0.44, mean: "Success depends on conditions outside the attacker's control, such as winning a race condition or gathering target-specific secrets." }] },
    { key: "PR", name: "Privileges Required", values: [
      { v: "N", label: "None", w: 0.85, mean: "No account needed. The attacker is unauthenticated." },
      { v: "L", label: "Low", w: 0.62, wc: 0.68, mean: "A basic user account is needed." },
      { v: "H", label: "High", w: 0.27, wc: 0.5, mean: "Administrative or otherwise significant privileges are needed." }] },
    { key: "UI", name: "User Interaction", values: [
      { v: "N", label: "None", w: 0.85, mean: "No other user has to do anything." },
      { v: "R", label: "Required", w: 0.62, mean: "A user other than the attacker must act, for example by clicking a link or opening a file." }] },
    { key: "S", name: "Scope", values: [
      { v: "U", label: "Unchanged", mean: "The impact stays inside the vulnerable component's own security authority." },
      { v: "C", label: "Changed", mean: "The exploit reaches beyond the vulnerable component, for example from a web app into the user's browser, or from a guest VM to the hypervisor." }] },
    { key: "C", name: "Confidentiality", values: [
      { v: "H", label: "High", w: 0.56, mean: "Total loss of confidentiality, or access to critical data such as passwords or keys." },
      { v: "L", label: "Low", w: 0.22, mean: "Some data is exposed, but the attacker doesn't control what, or it's of limited value." },
      { v: "N", label: "None", w: 0, mean: "No confidentiality impact." }] },
    { key: "I", name: "Integrity", values: [
      { v: "H", label: "High", w: 0.56, mean: "The attacker can modify any data, or critical data." },
      { v: "L", label: "Low", w: 0.22, mean: "Limited modification, with no direct serious consequence." },
      { v: "N", label: "None", w: 0, mean: "No integrity impact." }] },
    { key: "A", name: "Availability", values: [
      { v: "H", label: "High", w: 0.56, mean: "Full denial of service, or a serious, sustained loss of availability." },
      { v: "L", label: "Low", w: 0.22, mean: "Reduced performance or intermittent interruptions." },
      { v: "N", label: "None", w: 0, mean: "No availability impact." }] }
  ];
  const KEYS = METRICS.map(m => m.key);

  // Spec Appendix A rounding: smallest number, to one decimal, that is >= the input. Avoids float errors.
  function roundup(x) {
    const i = Math.round(x * 100000);
    return i % 10000 === 0 ? i / 100000 : (Math.floor(i / 10000) + 1) / 10;
  }

  function weight(key, v, scopeChanged) {
    const val = METRICS.find(m => m.key === key).values.find(x => x.v === v);
    return scopeChanged && val.wc !== undefined ? val.wc : val.w;
  }

  // Returns { score, impact, exploitability, severity } for a full metric selection like { AV: "N", ... }.
  function score(sel) {
    for (const k of KEYS) if (!METRICS.find(m => m.key === k).values.some(x => x.v === sel[k])) throw new Error("Missing or invalid metric " + k);
    const changed = sel.S === "C";
    const iss = 1 - (1 - weight("C", sel.C)) * (1 - weight("I", sel.I)) * (1 - weight("A", sel.A));
    const impact = changed ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15) : 6.42 * iss;
    const exploitability = 8.22 * weight("AV", sel.AV) * weight("AC", sel.AC) * weight("PR", sel.PR, changed) * weight("UI", sel.UI);
    let base = 0;
    if (impact > 0) base = roundup(Math.min((changed ? 1.08 : 1) * (impact + exploitability), 10));
    return { score: base, impact: Math.round(Math.max(impact, 0) * 10) / 10, exploitability: Math.round(exploitability * 10) / 10, severity: severity(base) };
  }

  function severity(s) {
    if (s === 0) return "None";
    if (s < 4) return "Low";
    if (s < 7) return "Medium";
    if (s < 9) return "High";
    return "Critical";
  }

  function toVector(sel) { return "CVSS:3.1/" + KEYS.map(k => k + ":" + sel[k]).join("/"); }

  // Parses "CVSS:3.1/AV:N/..." (prefix optional, any metric order). Returns the selection or null if invalid.
  function parse(str) {
    const parts = String(str).trim().replace(/^CVSS:3\.[01]\//i, "").split("/").filter(Boolean);
    const sel = {};
    for (const p of parts) {
      const [k, v] = p.toUpperCase().split(":");
      const m = METRICS.find(x => x.key === k);
      if (!m || !m.values.some(x => x.v === v) || sel[k]) return null;
      sel[k] = v;
    }
    return KEYS.every(k => sel[k]) ? sel : null;
  }

  root.CYSA = root.CYSA || {};
  root.CYSA.cvss = { METRICS, KEYS, score, severity, roundup, toVector, parse };
})(typeof window !== "undefined" ? window : globalThis);
