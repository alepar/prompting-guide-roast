---
key: autonomy-and-stops
title: Completion, stopping and autonomy
scope: group
families: any
---
Digest entries: X12, X16, C02, O06; house:degrade-dont-stop; keep list K4.
Hunt in orchestrator and main-thread text: no definition of done or success criteria; open-ended asks with no stopping point; no statement of which stops are wanted (blocked on the user, a protected resource, a risky or irreversible action); text that invites ending a turn with a summary announcing the next step, an offer to continue, a non-blocking decision list, or a "good place to report" pause during unattended phases; treating a text-only end of turn or a subagent's report as proof the task is done; the turn-ending rule stated in several places, or only far down a long file.
Also report the inverse: autonomy lines so broad they would suppress a needed confirmation on a risky or destructive action (K4), or autonomy additions placed in a human-in-the-loop flow.

## claude
Claude readers: compare with the Opus 5.5 unattended-run paragraph (named early-stop kinds plus the wanted stops) and the Fable 5.1 autonomy nudge. Hunt C02 too: update suppressors, token or context countdowns, "wrap up as context fills" pressure, and the absence of a note that compaction exists. Sonnet at low or medium effort checks in early: is effort set, or a keep-working line present?

## openai
GPT-6 Astra readers: Astra is more tentative than GPT-5.6 Sol about how far to take a task and asks more questions. In autonomous harnesses, flag the absence of a bias-to-action statement (infer intent, treat "can you..." as a request to act, persist to completion, ask for approval only on a concrete, reviewable result) (O06). Approval gates and stop-for-review requirements belong to the openai-decision-boundaries lane.
