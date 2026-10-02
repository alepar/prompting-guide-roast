---
key: claude-scope-and-literalism
title: Scope fences and literal reading (Claude)
scope: group
families: claude
---
Digest entries: C04, X12; house:fences; keep list K5.
Hunt in text read by Claude implementers, reviewers and fixers, Sonnet above all: no scope fence against unrequested tests, docs, refactors or "improvements"; open-ended verbs ("improve", "clean up", "polish") where a bounded deliverable is meant; an instruction stated for one item that must apply to all (Sonnet does not generalize, so it needs an explicit "every X"); no default reading for ambiguity (state the assumption, implement the best-supported reading, rather than stopping to ask in an unattended run); read-only agents not told they are read-only.
For Opus and Fable readers: Opus 5 can widen a narrow task, and Fable keeps changes and tests to the task only when asked. Flag a narrow task with no scope statement.
Also report the inverse: fences so tight they forbid work the task needs.
