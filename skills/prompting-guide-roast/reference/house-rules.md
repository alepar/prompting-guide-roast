These are the default house rules: a style for runtime prompt text that the report's recommendations follow. Replace them with `--house-rules <file>`, or drop them with `--house-rules none`.

- house:altitude — Cut what a capable agent works out on its own (retry a failed call, format output readably, be idempotent). Keep external-tool quirks where the agent's priors are wrong, chosen policies and thresholds, and interface contracts (names, locations, subagent inputs and outputs). Fix prose by deleting or restating it once, not by adding more prose.
- house:no-history — Files an agent reads at runtime carry execution content only. Incident narratives, issue numbers, "fix-round-N" labels and one-run measurements belong in git or maintenance docs. A one-clause present-tense reason is fine.
- house:calm-register — Write "Use X when..." at normal volume. Keep a shout only where a failure is demonstrated.
- house:fences — Give write-capable agents a scope fence, and tell read-only agents they are read-only.
- house:code-for-determinism — Anything whose output is fully determined by structured inputs (tallies, routing, caps, dedupe-by-key, graph walks) runs in code: a shipped script or the workflow engine. The model gets the computed values and keeps only the judgment.
- house:degrade-dont-stop — Autonomous runs prefer a workaround, then accepting partial coverage and saying so, over halting. Pre-flight checks with a human present are the exception.
