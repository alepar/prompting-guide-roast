---
key: openai-decision-boundaries
title: Decision boundaries and approval gates (OpenAI)
scope: group
families: openai
---
Digest entries: O01, O02, O03, X16; keep list K4, K5.
GPT-6 Astra is more tentative than GPT-5.x about how far to take a task, asks more questions, and takes boundary language seriously. Hunt in text read by OpenAI models:
- ask-first, "do not mutate", "wait for approval" or "STOP and ask" language on reversible, read-only or local work (O01);
- unsolicited warnings, disclaimers, approval flows or compliance checklists added for hypothetical risk (O01);
- a required stop for review after the first implementation, or milestone pauses with no blocking reason (O02);
- approval asked before the work is concrete, instead of approval as the final step on a reviewable result;
- no explicit permission for a known-safe loop (local tests with disposable fixtures: run, fix, rerun);
- a harness that loads many skills with no line saying the user's explicit instructions take precedence (O03).
Keep, and say so if asked: confirmation before deploy, merge, publish, delete or external writes, placed as the last step (K4); scope fences on what a write-capable agent may touch (K5). A gate on a reversible action is a finding; a fence on what to touch is not.
For GPT-6 Sol and Luna readers, OpenAI's guidance is based on Astra; report with at most medium confidence.
