---
key: structure-and-routing
title: Cross-file structure, routing and consistency
scope: unit
families: any
---
Digest entries: X03, X04, X07, C08, C10, O03; keep list K7, K8, K9.
This lane reads the whole unit together. For a very large file, skim its headings and grep for the specific terms you are checking rather than reading it all.
Hunt: frontmatter description quality (X03: use case first, when-to-use rather than a capability list, no catch-all scope or growing synonym list, within the host's length limit); a monolithic entrypoint inlining mode-specific detail, references never routed to, chains more than one level deep, or a router with nothing to route (X04); two files or sections ruling differently on the same point with no stated precedence, inconsistent terminology for one concept, or duplicated contracts whose copies disagree (X07; agreeing duplicates are K7); references to files or sections that do not exist.

## claude
Claude Code re-attaches only about the first 5,000 tokens of an invoked skill after compaction. Flag load-bearing rules (stopping rules, safety gates, interface contracts) placed beyond that point in a long SKILL.md (C08). Do not apply a calm-register rewrite to a description whose urgency was calibrated by a trigger evaluation (C10, K9).

## openai
GPT-6 Astra is more sensitive to skill and AGENTS.md text, and unclear or conflicting guidance makes it pause early: rate conflicts higher for Astra readers. A harness or orchestrator that loads many skills with no user-over-skill precedence line is O03. Codex shortens descriptions when the skill list exceeds about 2% of the context window, so a front-loaded use case matters more.
