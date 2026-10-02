---
name: prompting-guide-roast
description: Use when auditing an agent skill, AGENTS.md/CLAUDE.md, or a set of prompt files against current Claude and OpenAI (GPT-6) prompting guidance, to get a ranked report of recommended edits. Not for reviewing code or for writing a new skill.
---

# prompting-guide-roast

Roasts prompt files against the prompting guidance for the model that reads each file at runtime: Claude Opus, Sonnet, Fable and Haiku, and OpenAI GPT-6 Astra, Sol and Luna. A Workflow fans out lane scouts over the files, merges duplicate findings, rates them, and clusters systemic patterns. Scripts then verify every quote against the files and render a report: top actions, systemic patterns, cross-family conflicts, and findings with a concrete action and the guide passage behind each.

Invoking this skill is the user's request to run its Workflow.

## Inputs to settle with the user

- **Target:** a skill directory, a file, or a glob. Every `SKILL.md` below a directory starts its own unit; other files join their target's unit.
- **Who reads what at runtime:** either one model (`--model sonnet`) or models per role (`--models orchestrator=opus,implementer=sonnet,reviewer=gpt-6-luna`). With roles, a map agent reads the skill to decide which role reads each file. Pin known files with `--file-model 'reviewer-*.md=sonnet'`. Ask when the intended runtime model is not evident from the files or the conversation; the whole report depends on it.
- **Options (optional):** `--lanes` / `--skip-lanes`, `--house-rules <file|none>`, `--top <n>`, `--guides-dir <dir>`, `--label <text>`. `bash scripts/prepare --help` lists everything.

## Run

1. Build the run in a scratch directory:
   `bash <skill-dir>/scripts/prepare --target <path> --models <...> --out-dir <scratch>/pgr-<label>`
   It prints the units, groups, lanes, and an upper bound on agents. Tell the user that bound before launching a large run.
2. Launch: `Workflow({ scriptPath: "<out-dir>/run.js" })`. The args are embedded in the script, so pass no `args`.
3. When the completion notification arrives, take its `output-file` path:
   `bash <skill-dir>/scripts/finalize --result <output-file> --out <report path> --json-out <out-dir>/findings.json`
   Write the report wherever the user wants it; the scratch directory is the default.
4. Give the user the report path and a short summary: the top actions, coverage gaps from finalize's `gaps` output, and any conflicts to decide. Point out findings marked "unverified quotes"; finalize could not find their text in the files.

If a script prints `NODE_UNAVAILABLE:`, tell the user that node 22+ is required.

## Dry run

`prepare --dry-run` swaps every agent for a haiku stub returning canned JSON. Use it after editing the engine, lanes or prompts to check the pipeline topology and the finalize path cheaply. A dry-run report is labelled as one and its findings are fake. Each stub's answer is checked against its canned JSON; if finalize reports `DRY RUN FAILED`, a stub did something other than answer, so check the working tree for changes it made. `node tests/mock-engine.mjs` in the repo covers failure paths without any agents.

## What is where

- `engine/roast.js`: the Workflow script (map → scout → dedupe → rate + systemic). Deterministic merging happens here; ranking math lives in `scripts/finalize.mjs`.
- `lanes/*.md`: one scout lane per file. Frontmatter sets `scope` (`group` or `unit`) and `families` (`any`, `claude`, `openai`); `## claude` / `## openai` sections are added only when that family reads the files.
- `prompts/*.md`: the scout, map, dedupe, rate and systemic templates.
- `reference/guide-digest.md`: the guidance entries (X cross-vendor, C Claude, O OpenAI) that findings cite, with source links, the keep list and known conflicts. `reference/house-rules.md`: default house style. `reference/models.json`: model ids and aliases.
