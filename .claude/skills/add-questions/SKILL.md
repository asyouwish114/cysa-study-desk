---
name: add-questions
description: Write new CySA+ practice questions for a given exam domain and add them to data/questions.js. Use when asked to add, expand or fill gaps in the question bank.
---

# Add CySA+ practice questions

Arguments: a domain key (`so`, `vm`, `ir`, `rc`) and optionally a count (default 5) and a topic focus.

1. Read `data/domains.js` for the domain's code, name and topics. Read `data/questions.js` and note the
   existing questions for that domain and the highest id number used (ids look like `so10`, `vm7`).
2. Pick topics in that domain that the current questions cover least. Say which gaps you chose and why.
3. Write the questions so they match the real CS0-003 exam:
   - Scenario-based: "An analyst sees X. What is most likely / what should they do first?"
   - Exactly 4 options. One is clearly correct, and the distractors are plausible but wrong.
   - `a` is the 0-based index of the correct option. Options are shuffled when shown, so index 0 is fine.
   - `x` is 1-3 sentences: why the answer is right, and why the strongest distractor is wrong.
   - Be technically precise: real event IDs, ports, CVSS metrics, NIST and MITRE names.
     If you aren't sure a fact is correct, leave that question out.
4. Append the questions to the domain's block in `data/questions.js` with the next free ids, matching
   the existing one-object-per-line style.
5. Run `node scripts/validate-data.mjs`. The PostToolUse hook also runs it after every edit to `data/`.
   Fix any reported problem before finishing.
6. Report the new ids and a one-line summary of each question.
