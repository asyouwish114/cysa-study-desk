---
name: add-lab
description: Design a new CySA+ log analysis lab (performance-based practice) and add it to data/labs.js. Use when asked to add, write or expand the log labs.
---

# Add a log analysis lab

Arguments: an attack or scenario idea (e.g. "Kerberoasting", "DNS tunneling", "phishing to macro"), optionally a domain key.

1. Read `data/labs.js` to match its structure and style, and to avoid repeating a scenario.
2. Pick a realistic log source for the attack: Windows Security/System, Sysmon, Entra ID sign-ins,
   firewall, proxy, DNS, web server access logs or similar. Use that source's real column names,
   event IDs, status codes and formats. Use documentation IP ranges (192.0.2.0/24, 198.51.100.0/24,
   203.0.113.0/24) or other non-attributable IPs, and `example`/`corp.example` domains.
3. Write 8-14 rows in time order:
   - The attack chain (`bad: true`), each with a `note` that explains what the line shows. Cite
     ATT&CK technique IDs where they fit.
   - At least 2 benign rows, and ideally one realistic distractor that looks suspicious but isn't
     (a typo'd password, an apostrophe in a search). Give distractors a `note` too.
4. Add two `tasks`: "What happened?" and "What should the analyst do first?". Use exactly 4 options,
   a 0-based `a`, plausible distractors, and an `x` that explains why each tempting wrong answer fails.
   The response answer should follow IR order: contain and preserve evidence before eradicating.
5. Write a `debrief` covering the root cause plus the detection or prevention control.
6. Run `node scripts/validate-data.mjs` (the hook also runs it on edits) and fix any problems.
7. Re-read every `note` and answer for technical accuracy. If you aren't sure of a detail, change the
   scenario rather than guess.
