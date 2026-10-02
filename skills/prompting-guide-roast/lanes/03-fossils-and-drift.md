---
key: fossils-and-drift
title: Fossils, history and model drift
scope: group
families: any
---
Digest entries: X08; house:no-history.
Hunt: incident narratives, past tense, issue or PR numbers, "fix-round-N", "measured: ... on one run", and "used to / no longer / now also / instead of the old flow" phrasing attached to behavioral rules (migration-relative phrasing implies alternatives that no longer exist); patch accretion, meaning clusters of narrow conditionals each traceable to one incident where a general principle would serve; rules that encode one session's stumble as universal; pinned model names or version claims that will rot; paths, commands or flags the files reference but the unit no longer defines (check with Read and Grep; do not run commands).
Distinguish: a short "why" clause that motivates a rule is good context (K6); a narrative of how the rule came to exist is history. Recorded baselines inside clearly marked maintenance sections are out of scope unless the executing agent must read them.

## claude
Mitigations written for older Claude models: Opus 5 verbosity, over-verification or scope lines kept for Opus 5.5; Sonnet 5 "don't be lazy" or tool-triggering pushes; thinking-disabled workarounds; update suppressors ("hold findings for the final response"); anti-formatting rules aimed at Fable readers.

## openai
Mitigations written for GPT-5.x that GPT-6 Astra reverses: "verify your changes extremely thoroughly", "always run the full test suite", "STOP IMMEDIATELY and ask", "maximize context gathering before acting", persistence pushes tuned to Sol's long runs. Guidance tuned for GPT-6 Sol or Luna that overconstrains Astra when Astra also reads the file. Skills built around something an older model could not do: recommend re-testing the task without the skill.
