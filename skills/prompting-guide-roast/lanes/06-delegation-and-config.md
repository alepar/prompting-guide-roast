---
key: delegation-and-config
title: Delegation shape and per-role model and effort
scope: group
families: any
---
Digest entries: X09, X10, X13, C05, O05, O08, O09.
Hunt: subagent briefs missing objective, output shape, boundaries or stop condition; briefs that assume shared context the subagent cannot see ("as discussed", skills it has not loaded, conversation facts); overlapping parallel scopes or unsettled shared interfaces between parallel workers; parallel write-heavy agents on shared files; fan-out over tightly coupled sequential work; subagents told to paste large artifacts into their reply instead of writing files and returning paths; subagents told to silently resolve conflicts instead of reporting both sides; orchestration that never says whether to wait for all agents or what each returns; model calls whose inputs fully determine their outputs (X10); near-duplicate agent roles differing by one parameter; per-role model or effort unset or mismatched, or prose used to control thinking depth (X13).

## claude
Claude orchestrators: Opus 5 and Fable delegate readily. Flag delegation encouraged for small tasks, subagents used to verify the lead's own work, a lead told to idle on every subagent, and missing time-budget signals (C05). Sonnet structured-JSON judges at low or medium effort without a think-first line, and xhigh or max with no evidence, are X13 findings.

## openai
GPT-6 Astra delegates less than many harnesses expect. An orchestrator that relies on parallel subagents must say when and how much to delegate (O05). Configs: high or max effort carried over from GPT-5.x, `none`/`minimal` effort on models that don't support it, a custom agent with a model but no effort, and roles mismatched to tier (GPT-6.1 Sol for demanding, ambiguous work; Luna for narrow, high-volume work) (O08). In multi-agent harnesses whose messages humans read, a missing legibility line is a low-impact finding (O09).
