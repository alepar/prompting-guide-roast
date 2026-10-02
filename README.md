# prompting-guide-roast

A Claude Code skill that roasts agent skills, AGENTS.md / CLAUDE.md files and prompt templates against current vendor prompting guidance. It judges each file against the model that actually reads it at runtime, Claude (Opus, Sonnet, Fable, Haiku) or OpenAI GPT-6 (Astra, Sol, Luna), and reports recommended edits:

- a short list of **top actions**;
- **systemic patterns** to fix once across files;
- **conflicts** where the guidance for different readers pulls in opposite directions;
- every **finding** with its verified quote, the reader model it harms, a concrete action (often with replacement text), a severity, and the guide passage it rests on.

## How it works

```
prepare (node)     target files → units (one per SKILL.md dir) → scout groups; lanes, prompts, models → run.js
Workflow (engine)  map readers → lane scouts per group → dedupe per unit (id groups, merged in code)
                   → rate impact/exposure in chunks + cluster systemic patterns
finalize (node)    verify every quote against the files → score → rank → top-N → markdown report
```

- **Model-aware lanes.** Eleven scout lanes (`skills/prompting-guide-roast/lanes/`). Most lanes apply to every reader, with Claude- and OpenAI-specific notes added only when that family reads the files. Two lanes are family-only: Claude literalism and scope, and OpenAI decision boundaries. With roles (`--models orchestrator=opus,implementer=sonnet`), a map agent decides which role reads each file.
- **No judge panel.** Findings are deduplicated and rated, not adjudicated. Quotes are machine-checked, and a finding whose quote is not in the file is listed separately and never ranked.
- **Deterministic work in code.** Dedupe returns id groups and the engine assembles merged findings. Ranking math, caps, top-N and rendering all live in `scripts/finalize.mjs`.
- **Guide digest.** `reference/guide-digest.md` summarizes the guidance as cited entries: X cross-vendor, C Claude, O OpenAI. It includes a keep list of text that should not be flagged and the known cross-family conflicts. It summarizes and links to the vendor docs rather than copying them.

## Install (Claude Code)

As a plugin:

```
/plugin marketplace add alepar/prompting-guide-roast
/plugin install prompting-guide-roast@prompting-guide-roast
```

Or as a plain skill: copy or symlink `skills/prompting-guide-roast` into `~/.claude/skills/` (personal) or `<repo>/.claude/skills/` (project).

Requirements: Claude Code with the Workflow tool, and node 22 or later for the `prepare` and `finalize` scripts.

## Use

Ask Claude Code to roast a skill, for example: "roast `skills/my-skill` with the prompting-guide-roast skill; the orchestrator runs on opus, the implementer prompt goes to sonnet". The skill runs:

```bash
bash skills/prompting-guide-roast/scripts/prepare \
  --target path/to/skill --models orchestrator=opus,implementer=sonnet --out-dir /tmp/pgr-my-skill
# Workflow({ scriptPath: "/tmp/pgr-my-skill/run.js" })
bash skills/prompting-guide-roast/scripts/finalize \
  --result <workflow output file> --out my-skill-roast.md --json-out /tmp/pgr-my-skill/findings.json
```

`prepare --help` lists every option: single `--model`, `--file-model` pins, lane selection, house rules, group size, per-site agent models and effort, and `--dry-run`.

## Test

- `node tests/mock-engine.mjs` runs the engine under node with stub agents and checks reader mapping, lane selection by family, dedupe assembly with orphan and out-of-range ids, dead scouts and dead dedupe, dryRun stubs and stub-deviation detection, quote verification, scoring and report sections.
- `prepare --dry-run` followed by the Workflow runs the real pipeline with haiku stubs returning canned JSON. Every stub answer is compared with its canned JSON, and finalize reports any deviation as `DRY RUN FAILED`. A stub that deviates did something other than answer, so check the working tree after such a run.

## Sources

The digest draws on Anthropic's model prompting guides (Opus 5.5, Opus 5, Sonnet 5.5, Sonnet 5, Fable 5.1), its prompting best practices, the Claude Code skills docs and `/claude-api prompt-audit`. On the OpenAI side it draws on the GPT-6 model guide, "Rethinking skills and prompts for GPT-6 Astra", the Codex skill-creator skill, and the Codex skills, AGENTS.md and subagents docs. Each entry links to its sources; the research behind the merged list was done on 2026-09-29 (Claude) and 2026-10-01 (OpenAI). Vendor guidance changes with each model release, so re-check the digest when new models ship.

## License

MIT. The guide digest summarizes and links to vendor documentation; it does not reproduce it.
