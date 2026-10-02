---
key: verification-and-review
title: Verification, reviewer and judge design
scope: group
families: any
---
Digest entries: X06, X15, C03, O07.
Hunt in generator prompts (implementers, planners, orchestrators): verification calibrated to the wrong reader (X06). Look for blanket "double-check", "re-verify", "add a final verification step", "use a subagent to verify", "run all tests" for readers that over-verify. Look for a missing concrete check (tests, build, type-check run before reporting done), or a bare "verify thoroughly", for readers that need one.
Hunt in finder, scout and reviewer prompts: severity or confidence filtering at the finding stage when a later stage filters (C03); a qualitative bar where a concrete one is needed.
Hunt in judge and verifier prompts (X15): exposure to peer verdicts, prior scores or upstream severities; approval framing with no disconfirmation step; majority vote across identical same-family judges; rubrics rewarding length; wide numeric scales; order effects; a fix required for every item; author rebuttal after the verdict; generic "please review" with no evidence or gate rules.
Note conflicts honestly: removing a verification step that is the only gate cuts the other way; say which applies.

## claude
Claude Opus 5.x and Fable verify on their own: blanket verification instructions in their prompts are findings. Sonnet 5.5 implementers at low or medium effort may report done without a real check: a missing concrete check is the finding there. Sonnet follows finder-stage filters literally, and recall drops.

## openai
GPT-6 Astra tests thoroughly unprompted and over-tests small changes (O07): flag blanket testing lines and recommend calibrated wording ("run tests appropriate to the change; broaden only when new failures justify it"). For GPT-6 Luna or Sol narrow implementers there is no vendor guidance; a missing concrete check is at most a medium-confidence finding.
