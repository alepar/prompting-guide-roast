---
key: pressure-language
title: Pressure and absolute language
scope: group
families: any
---
Digest entries: X01, C01, C10; keep list K2, K9.
Hunt: MUST/NEVER/ALWAYS/CRITICAL/IMPORTANT density and emphasis with no adjacent reason; "if in doubt, X" and "default to X" overtrigger phrasing; "be thorough, don't be lazy, don't stop early" exhortations; hedges ("try to", "if possible", "ideally") attached to real requirements; trait claims ("you tend to..."); prohibition clusters where individual lines carry no reason.
Classify text by function first. A frontmatter description is routing text and may carry calibrated urgency (K9). A shout attached to a demonstrated failure stays (K2); recommend keeping it and, if missing, adding its one-clause reason.

## claude
For Claude readers also hunt C01: "think step by step / think carefully / think harder / don't overthink" prose (effort is the control, and Opus 5.5 and Fable 5.1 think by default), and instructions to write reasoning out in the response text, which risk a `reasoning_extraction` refusal on Opus 5.5, Sonnet 5.5 and Fable 5.1. A short justification field in a schema is fine. A think-it-through line for Sonnet doing structured-output reasoning at low effort is fine.

## openai
For GPT-6 Astra readers, strong wording is taken literally: OpenAI warns Astra "could take it too seriously" and stop where continuing was wanted. Weigh each absolute against that. If the absolute is an approval or ask-first gate, leave it to the openai-decision-boundaries lane.
