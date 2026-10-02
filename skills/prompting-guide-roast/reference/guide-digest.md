# Guide digest: prompt and skill anti-patterns by model family

Scouts cite entries by id. **X** entries hold across vendors, **C** entries are Claude-specific, **O** entries are OpenAI-specific. Each entry names the reader models it applies to, says what to look for, what to recommend, and where the guidance comes from. The entries summarize vendor guidance in our own words with short attributed quotes; follow the links for the full text.

Reader model ids used in findings: `claude-opus` (Opus 5.5 / 5), `claude-sonnet` (Sonnet 5.5 / 5), `claude-fable` (Fable 5.1 / Mythos 5.1), `claude-haiku`, `gpt-6-astra`, `gpt-6-sol` (GPT-6.1 Sol / GPT-6 Sol), `gpt-6-luna`, `gpt-5` (GPT-5.x, legacy), `generic` (model unknown: apply X entries only).

Evidence strength: **V** vendor guidance for that model · **V-gen** vendor guidance for the family or all models · **R** research or practitioner reports · **I** inferred from adjacent guidance (report with at most medium confidence).

Sources were checked on 2026-10-01. OpenAI's GPT-6 guidance is based on Astra; OpenAI says to "evaluate them with your chosen model", so for Sol and Luna treat O entries as hypotheses (I) unless marked otherwise.

---

## Cross-vendor entries

### X01 Pressure and absolute language without a reason
- **Readers:** all. Strongest on `claude-opus`, `claude-sonnet`, `claude-fable`, `gpt-6-astra`.
- **Look for:** CAPS, MUST/NEVER/ALWAYS/CRITICAL/IMPORTANT with no adjacent reason; "if in doubt, use X"; "be thorough, don't be lazy"; hedges ("try to", "ideally") on real requirements; trait claims ("you tend to...").
- **Recommend:** state the rule at normal volume with a one-clause reason. Keep a shout only where a failure is demonstrated (keep list K2).
- **Why:** Claude: recent models are more responsive to the system prompt, and language that fixed undertriggering now causes overtriggering; "If in doubt, use [tool]" is the named example (V). OpenAI: use "absolute language only when correctness, safety, permissions, or a genuinely fragile workflow requires them" (V-gen); Astra "could take it too seriously" (V).
- **Sources:** [Claude best practices — Tool usage; Overthinking](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#tool-usage) · [OpenAI skill-creator — Core principles](https://github.com/openai/codex/tree/main/codex-rs/skills/src/assets/samples/skill-creator) · [OpenAI blog — Decision boundaries](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)

### X02 Recipe choreography for judgment work
- **Readers:** all; strongest on `claude-opus`, `claude-fable`, `gpt-6-astra`.
- **Look for:** numbered STEP sequences where order does not matter; scripted searches or tool calls; strategy coaching mixed into rules ("it's usually best to..."); a fixed structure or step count imposed on open-ended work.
- **Recommend:** describe the outcome, the decision criteria and the real constraints; keep fixed sequences only where deviation causes a concrete problem (K1).
- **Why:** OpenAI: "many skills were written as elaborate itineraries or recipes ... overly specific guidance can now hinder results where it previously helped" (V). Claude prompt audit: describe the goal, not the method (V).
- **Sources:** [OpenAI blog — Better skills](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra) · [OpenAI skill-creator — Match specificity to the risk](https://github.com/openai/codex/tree/main/codex-rs/skills/src/assets/samples/skill-creator) · [ChatGPT/Codex Prompting](https://learn.chatgpt.com/docs/prompting) · Claude Code `/claude-api prompt-audit`, group 1c

### X03 Long, catch-all or what-not-when skill descriptions
- **Readers:** whoever routes skills: the main agent in Claude Code or Codex.
- **Look for:** frontmatter `description` that lists capabilities rather than when to use the skill; catch-all scope ("anything related to databases"); ever-growing synonym or trigger lists; key use case not in the first clause; descriptions near or over the host limit (Claude Code: 1,536 chars including `when_to_use`; Codex shortens descriptions when the skill list exceeds about 2% of context).
- **Recommend:** one sentence of what it does and when it applies, use case first, plus at most one or two exclusions that name a real neighbour.
- **Why:** OpenAI: descriptions "far too long" get shortened, and over-broad ones load the skill when it doesn't help (V). Claude: the description is the trigger; front-load the use case (V).
- **Note:** targeted "not for X" clauses are fine. OpenAI's older shell-tips post recommends "use when / don't use when" blocks; the newer skill-creator allows exclusions "only when they prevent likely misrouting". Flag growth, not presence.
- **Sources:** [OpenAI blog — Better skills](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra) · [Build skills](https://learn.chatgpt.com/docs/build-skills) · [Shell + Skills tips](https://developers.openai.com/blog/skills-shell-tips) · [Claude skill best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) · [Claude Code skills](https://code.claude.com/docs/en/skills)

### X04 Monolithic entrypoint, missing or broken progressive disclosure
- **Readers:** all.
- **Look for:** a long SKILL.md that inlines mode-specific procedures, schemas or examples every run pays for; references never routed to ("see the docs folder"); reference chains more than one level deep (SKILL.md → a.md → b.md where b holds needed content); a router added to a skill with nothing to route.
- **Recommend:** keep purpose, essential constraints and routing in SKILL.md; move mode-specific detail to references, each linked where it becomes relevant with a line saying when to read it.
- **Sources:** [OpenAI blog — Better skills](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra) ("make the root document a minimal router") · [OpenAI skill-creator — Disclose detail progressively](https://github.com/openai/codex/tree/main/codex-rs/skills/src/assets/samples/skill-creator) · [Claude skill best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)

### X05 Blanket "read X before every edit" or load-everything-first rules
- **Readers:** all; strongest on `gpt-6-astra`.
- **Look for:** "before every change, read A, B and C"; "always load the full repo map"; reading every reference up front.
- **Recommend:** make each pointer conditional: "use architecture.md for service boundaries, database.md for schema changes".
- **Sources:** [OpenAI blog — Up-to-date AGENTS.md](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra) (V) · [OpenAI — Using skills to accelerate OSS maintenance](https://developers.openai.com/blog/skills-agents-sdk) (short conditional "if X, run Y" rules) · [Anthropic — Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) (just-in-time context)

### X06 Verification calibrated to the wrong reader
- **Readers:** split by model.
  - Remove blanket verification for `claude-opus`, `claude-fable`, `gpt-6-astra`: "double-check", "add a final verification step", "use a subagent to verify", "run all tests before finishing", "verify extremely thoroughly". These models verify on their own and over-verify when told to.
  - Require a concrete check for `claude-sonnet` at low or medium effort, and for `gpt-6-luna` / `gpt-6-sol` narrow agents (I): a real test, build or type-check run before reporting done, rather than "verify thoroughly".
- **Recommend (over-verifiers):** delete the line, or calibrate it: "Run tests appropriate to the change; broaden only when new failures justify it."
- **Recommend (Sonnet):** the Sonnet 5.5 guide's concrete-check paragraph, adapted.
- **Sources:** [Opus 5 — Task scope and over-verification](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5#task-scope-and-over-verification) · [Sonnet 5.5 — Verification on coding tasks](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5#verification-on-coding-tasks) · [OpenAI blog — Up-to-date AGENTS.md](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra) ("GPT-6 Astra does that on its own") · [Using GPT-6 — Testing and verification](https://developers.openai.com/api/docs/guides/latest-model#testing-and-verification)
- **Conflict:** OpenAI's generic prompt-engineering page still says to "require thorough testing" for Astra; it predates the GPT-6 guide. Prefer the GPT-6 guide.

### X07 Conflicting instructions with no stated precedence
- **Readers:** all; strongest on `gpt-6-astra` ("more sensitive to instructions contained in skills and other files"; conflicting guidance "may cause the model to pause and block work early").
- **Look for:** two files or sections ruling differently on the same point; duplicated contracts whose copies disagree; skill text that would override an explicit user request; several files each claiming top priority.
- **Recommend:** resolve the conflict in one place. For Astra harnesses that load many skills, add: "The user's instructions take precedence over guidelines provided in a skill."
- **Sources:** [Using GPT-6 — Instruction following](https://developers.openai.com/api/docs/guides/latest-model#instruction-following) · [GPT-5.6 prompt guidance](https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6) ("conflicting rules can create more instability than missing detail") · Claude research item 3 (contradictory instruction files)

### X08 History, fossils and single-incident rules made universal
- **Readers:** all.
- **Look for:** incident narratives, issue numbers, "fix-round-N", "used to / no longer / now also" phrasing on behavioral rules; clusters of narrow conditionals each traceable to one stumble; mitigations for older models: Opus 5 verbosity lines, Sonnet 5 "don't be lazy", update suppressors, GPT-5 "verify extremely thoroughly", GPT-5-Codex "STOP IMMEDIATELY and ask"; guidance tuned for Sol or Luna that overconstrains Astra; skills built around an older model's limits; pinned model names that will rot.
- **Recommend:** keep a one-clause present-tense reason, move the narrative to git or maintenance docs, generalize patch clusters into one principle, and re-test old-model mitigations by removing them.
- **Sources:** [OpenAI skill-creator](https://github.com/openai/codex/tree/main/codex-rs/skills/src/assets/samples/skill-creator) ("Do not turn a particular example, past failure, or personal preference into a universal requirement"; "Prefer a narrow correction to accumulating universal rules") · [OpenAI blog — Better skills](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra) (Sol/Luna guidance "may overconstrain GPT-6 Astra") · Claude Code `/claude-api prompt-audit`, group 1d (fossils) · Claude research items 4–5

### X09 Under-specified delegation
- **Readers:** whoever writes the dispatch (orchestrator); the harm lands on the subagent.
- **Look for:** briefs missing objective, output shape, boundaries or stop condition; briefs assuming shared context the subagent cannot see ("as discussed", skills it has not loaded); overlapping parallel scopes; parallel write-heavy agents on shared files; fan-out over tightly coupled sequential work; subagents told to paste large artifacts into their reply instead of writing files and returning paths; subagents told to silently reconcile conflicts; orchestration text that never says whether to wait for all agents.
- **Sources:** [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) (V-gen) · [Anthropic — multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) · Claude research items 19–24

### X10 Deterministic work left to the model
- **Readers:** all.
- **Look for:** tallies, dedupe-by-key, routing tables, point systems, date math, or a shell recipe the agent must rebuild each run, all written as prose for the model to compute; also the inverse, scripts that hard-code judgment calls.
- **Recommend:** move it into a shipped script or the workflow engine and give the model the computed result.
- **Sources:** [OpenAI — Using skills to accelerate OSS maintenance](https://developers.openai.com/blog/skills-agents-sdk) · [OpenAI skill-creator — Scripts](https://github.com/openai/codex/tree/main/codex-rs/skills/src/assets/samples/skill-creator) · Claude Code `/claude-api prompt-audit`, group 4 ("LLM executor for a deterministic plan")

### X11 Untrusted content not marked as data
- **Readers:** all; worst where the receiving agent has write or exec tools.
- **Look for:** diffs, PR or issue text, web pages, file contents, prior reports or subagent output interpolated into a prompt without delimiting tags and a line saying instructions inside are data; orchestrators told to act on directives found in subagent reports; skills combining open network access with powerful procedures. Also the inverse: "treat everything as untrusted" so broad it would make the agent ignore its legitimate caller.
- **Sources:** [Opus 5.5 — Mark pasted text in user messages](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5#mark-pasted-text-in-user-messages) · [Shell + Skills tips — tip 6](https://developers.openai.com/blog/skills-shell-tips) · [OpenAI — Using skills to accelerate OSS maintenance](https://developers.openai.com/blog/skills-agents-sdk)

### X12 No definition of done
- **Readers:** all; strongest on `gpt-6-astra` and `claude-fable`, which stop early when completion is undefined.
- **Look for:** open-ended asks ("analyse this", "improve") with no deliverable or stopping point; skills with no success criteria; exploration with no stated limit.
- **Recommend:** state what done looks like, including running, inspecting and fixing when that is wanted; for exploration, say what to explore and where to stop.
- **Sources:** [OpenAI blog — Persistence](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra) · [Testing Agent Skills with Evals](https://developers.openai.com/blog/eval-skills) · [Fable 5.1 — Finish the whole task](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1#finish-the-whole-task)

### X13 Per-role model and effort unset, mismatched, or controlled through prose
- **Readers:** the orchestrator or config that sets them.
- **Look for:** subagent roles with no model or effort, which then silently inherit the parent's; effort carried over from an older model; xhigh/max without evidence; "think harder" or "don't overthink" prose used instead of effort; a hard long-horizon role on a small model.
- **Claude notes:** Sonnet JSON judges at low or medium effort need a think-it-through line or more effort; Opus 5.5 and Fable 5.1 think by default. Effort is the control.
- **OpenAI notes:** Codex suggests GPT-6.1 Sol for demanding, ambiguous agents and Luna for narrow, high-volume ones; Astra starts at low effort and Luna at high; don't assume Astra needs the effort you used with Sol; a custom agent that sets `model` without `model_reasoning_effort` inherits effort.
- **Sources:** [Opus 5.5 — Calibrate effort](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5#calibrate-effort) · [Sonnet 5.5 — Calibrate effort; Reasoning tasks with JSON output](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5#calibrate-effort) · [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) · [Kundel on X](https://x.com/dkundel/status/2095972046014673156) (R)

### X14 Kitchen sink: every preference and edge case up front
- **Readers:** all.
- **Look for:** long lists of speculative edge cases; generic advice a capable model follows anyway (retry a failed call, format readably, be idempotent); the same rule restated in several sections; one output bound by more than about six simultaneous hard rules (consider a schema); option menus with no default.
- **Recommend:** cut what changes no decision; keep tool quirks, chosen thresholds and interface contracts (K3).
- **Sources:** [OpenAI skill-creator — Assume Codex is already capable](https://github.com/openai/codex/tree/main/codex-rs/skills/src/assets/samples/skill-creator) · [Testing Agent Skills with Evals](https://developers.openai.com/blog/eval-skills) (don't encode every preference up front) · Claude research items 1, 8, 13

### X15 Judge and reviewer design biases
- **Readers:** reviewers, judges and finder scouts of any model; evidence is mainly LLM-judge research (R).
- **Look for:** judges shown peer verdicts, prior scores or upstream severities (anchoring); "confirm it looks right" framing with no disconfirmation step; majority vote across identical same-family judges; rubrics rewarding length or comprehensiveness; wide numeric scales; unordered pairwise comparisons; a fix demanded for every finding; author rebuttal delivered after the verdict; "be thorough" as the whole verification instruction; generic "please review" with no evidence or gate rules; blocked verdicts with no unblock checklist.
- **Sources:** Claude research items 28–37 (see the companion research report) · [OpenAI — Using skills to accelerate OSS maintenance](https://developers.openai.com/blog/skills-agents-sdk)

### X16 Autonomy and authorization left implicit in long or unattended runs
- **Readers:** orchestrators and main threads of `claude-opus`, `claude-fable`, `gpt-6-astra`.
- **Look for:** no statement of which stops are wanted (blocked on the user, a protected resource, a risky or irreversible action); text inviting a turn to end with a summary announcing the next step, an offer to continue, or a non-blocking decision list; treating a text-only end of turn or a subagent's report as proof the task is done; approval asked before the work is concrete; no explicit permission for a safe loop (local tests with disposable fixtures).
- **Recommend:** state once, near the top, the closed list of wanted stops, and grant permission for safe, reversible work. For Opus, use the Opus 5.5 unattended-run paragraph; for Fable, the autonomy nudge; for Astra, the bias-to-action and approval-last prompts. Keep a confirmation step for risky or irreversible actions (K4).
- **Sources:** [Opus 5.5 — Unattended agentic runs](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5#unattended-agentic-runs) · [Fable 5.1 — Finish the whole task](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1#finish-the-whole-task) · [Using GPT-6 — Initiative and follow-through](https://developers.openai.com/api/docs/guides/latest-model#initiative-and-follow-through) · [OpenAI blog — Decision boundaries; Persistence](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)

---

## Claude-specific entries

### C01 Prompted thinking, or reasoning written into the response
- **Readers:** `claude-opus`, `claude-sonnet`, `claude-fable`.
- **Look for:** "think step by step", "think carefully", "think harder", "don't overthink"; instructions to write out reasoning before the answer ("show your reasoning").
- **Why:** effort is the control; Opus 5.5 and Fable 5.1 think by default. On Opus 5.5, Sonnet 5.5 and Fable 5.1, requests to reproduce internal reasoning in the response can be declined with a `reasoning_extraction` refusal. A short justification field in a schema is fine. Sonnet at low or no up-front thinking on structured-output reasoning tasks is the exception: a think-it-through line helps there.
- **Sources:** [Opus 5.5 — Prompts written for thinking disabled; Safeguard refusals](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5#prompts-written-for-thinking-disabled) · [Sonnet 5.5 — Reasoning tasks with JSON output](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5#reasoning-tasks-with-json-output)

### C02 Update suppressors and budget countdowns
- **Readers:** `claude-opus`, `claude-fable`, `claude-sonnet`.
- **Look for:** "hold all findings for the final response", "don't narrate"; token or context countdowns; "wrap up as context fills" pressure; no note that compaction exists.
- **Sources:** [Fable 5.1 — Ask for user-facing progress updates](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1#ask-for-user-facing-progress-updates) · [Opus 5.5 — User-facing progress updates](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5#user-facing-progress-updates) · Claude research item 26

### C03 Severity or confidence filters in finder prompts
- **Readers:** finder, scout and reviewer prompts read by `claude-sonnet` (literal), also `claude-opus`.
- **Look for:** "only report significant issues", "be conservative", "don't nitpick", "if not certain, don't flag" when a later stage filters; a qualitative bar where a concrete one is needed.
- **Recommend:** tell the finder its job is coverage, with confidence and severity per finding; if it must self-filter, give a concrete bar.
- **Sources:** [Sonnet 5 — Code review harnesses](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5#code-review-harnesses)

### C04 Literalism gaps
- **Readers:** `claude-sonnet`, especially implementers and reviewers.
- **Look for:** no scope fence against unrequested tests, docs, refactors or "improvements"; open-ended verbs ("improve", "clean up") where a bounded deliverable is meant; an instruction stated for one item that must apply to all (Sonnet does not generalize; say "every X"); no default reading for ambiguity (state the assumption, implement the best-supported reading).
- **Sources:** [Sonnet 5.5 — Steer initiative and scope](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5#steer-initiative-and-scope) · [Sonnet 5 — More literal instruction following](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5#more-literal-instruction-following) · [Fable 5.1 — Keep changes and tests to what the task asks for](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1#keep-changes-and-tests-to-what-the-task-asks-for)

### C05 Overspawning and an idle lead
- **Readers:** `claude-opus`, `claude-fable` orchestrators.
- **Look for:** delegation encouraged for small tasks; subagents used to verify the lead's own work; a lead told to wait idle on every subagent; no time-budget signal in multi-agent harnesses.
- **Sources:** [Opus 5 — Controlling subagent spawning](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5#controlling-subagent-spawning) · [Opus 5.5 — Time signals for multiagent harnesses](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5#time-signals-for-multiagent-harnesses) · [Fable 5.1 — Let the lead agent keep working while subagents run](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1#let-the-lead-agent-keep-working-while-subagents-run)

### C06 Deliverable shape for Claude writers
- **Readers:** `claude-opus` (long documents), `claude-fable` (dense prose, leans into formatting).
- **Look for:** report or spec contracts with no length calibration for Opus, or numeric word caps where audience framing would serve; Fable-written outputs with no guard against dense or mannered prose; anti-formatting rules carried over for Fable readers; templates whose single sample will be over-indexed; final messages that don't lead with the outcome; invitations to narrate corrections.
- **Sources:** [Opus 5 — Written deliverable length; Self-correction](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5#written-deliverable-length) · [Fable 5.1 — Writing density; Formatting in chat](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1#writing-density)

### C07 Text after tool results, or user text in tool results
- **Readers:** `claude-sonnet` (may read it as prompt injection).
- **Look for:** harness notices appended after every tool result; user-authored text delivered through a `tool_result` channel.
- **Sources:** [Sonnet 5.5 — Mid-turn user messages](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5#mid-turn-user-messages)

### C08 Load-bearing rules placed late in a long SKILL.md
- **Readers:** any Claude model running the skill in Claude Code.
- **Look for:** invariants the whole run depends on (stopping rules, safety gates, interface contracts) placed beyond roughly the first 5,000 tokens of SKILL.md. After auto-compaction, Claude Code re-attaches only about that much of each invoked skill.
- **Sources:** [Claude Code skills](https://code.claude.com/docs/en/skills) · Claude research item 14

### C09 Grader vocabulary and arithmetic rubrics
- **Readers:** all Claude (R).
- **Look for:** "you will be graded", "the judges will check" in task prompts; point systems or lookup tables the model must compute (also X10).
- **Sources:** Claude research items 6–7

### C10 One emphasis policy across routing text and body text
- **Readers:** Claude skill routing (R).
- **Look for:** calm-register rewrites applied to a frontmatter description whose urgency was calibrated by a trigger evaluation, or shouting in the body justified by routing needs. Classify text by function before flagging.
- **Sources:** Claude research item 17

---

## OpenAI-specific entries

### O01 Strong ask-first language and approval flows for hypothetical risk
- **Readers:** `gpt-6-astra` (V); `gpt-5` already over-asked on repeated "ask first" (V); `gpt-6-sol`, `gpt-6-luna` (I).
- **Look for:** "ask before making changes", "do not mutate", "wait for approval", "STOP IMMEDIATELY and ask"; unsolicited warnings, disclaimers, approval flows or compliance checklists added for hypothetical risk.
- **Recommend:** move the gate to the irreversible step (deploy, merge, publish, external write) so approval comes last on a concrete result, and grant explicit permission for reversible, read-only and local work.
- **Sources:** [OpenAI blog — Decision boundaries](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra) · [Using GPT-6 — Initiative and follow-through](https://developers.openai.com/api/docs/guides/latest-model#initiative-and-follow-through) · [GPT-5.6 prompt guidance](https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6)

### O02 Stop-for-review after the first implementation
- **Readers:** `gpt-6-astra` (V).
- **Look for:** "after implementing, stop and ask for review"; milestone pauses with no blocking reason; exploration without a stated end.
- **Why:** "A requirement to stop for review after the first implementation will pull the model toward an earlier stopping point."
- **Sources:** [OpenAI blog — Persistence](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)

### O03 No user-over-skill precedence in harnesses that load many skills
- **Readers:** `gpt-6-astra` (V).
- **Look for:** orchestrator or harness text that loads many skills or AGENTS.md files with no statement that explicit user instructions win; skills that can make the model pause with no way to see why.
- **Recommend:** add the precedence line, and during audits the transparency prompt (name and quote the SKILL.md instruction behind any pause).
- **Sources:** [Using GPT-6 — Instruction following](https://developers.openai.com/api/docs/guides/latest-model#instruction-following)

### O04 Prose deliverables with no style spec
- **Readers:** `gpt-6-astra` (V); `gpt-6-sol`, `gpt-6-luna` share Astra's communication style (V-gen).
- **Look for:** report, summary or message contracts that leave format and register open; no guard against heavy lists and tables, stock phrases ("delve", "leverage", "it's worth noting", "Bottom Line:"), contrastive "X, not Y" framing, invented compound labels, or closing summary lines.
- **Recommend:** describe the reader and the shape (paragraphs by default, lists only for parallel items); add a short banned-phrase line if the output is user-facing.
- **Conflict:** the same contract read by `claude-fable` should not gain anti-formatting rules (C06). Report shared contracts as conflicts.
- **Sources:** [Using GPT-6 — Personality and writing style](https://developers.openai.com/api/docs/guides/latest-model#personality-and-writing-style) · [Introducing GPT-6 Sol and Luna](https://openai.com/index/introducing-gpt-6-sol-and-luna/)

### O05 Delegation assumed, not specified
- **Readers:** `gpt-6-astra` orchestrators (V).
- **Look for:** orchestrator skills that depend on parallel subagents but never say when and how much to delegate; wording in AGENTS.md or a skill that triggers delegation implicitly.
- **Recommend:** state when to delegate, how many agents, and whether to wait for all of them.
- **Sources:** [Using GPT-6 — Subagent delegation](https://developers.openai.com/api/docs/guides/latest-model#subagent-delegation) · [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)

### O06 Autonomous Astra harness with no bias-to-action statement
- **Readers:** `gpt-6-astra` (V). OpenAI side of X16.
- **Look for:** autonomous or long-running instructions that never say to infer intent, act on "can you..." requests, and persist to completion.
- **Sources:** [Using GPT-6 — Initiative and follow-through](https://developers.openai.com/api/docs/guides/latest-model#initiative-and-follow-through)

### O07 Blanket testing instructions for Astra
- **Readers:** `gpt-6-astra` (V). OpenAI side of X06.
- **Look for:** "run all tests before finishing", "always add tests", "verify extremely thoroughly", "make sure to run the tests".
- **Recommend:** "Run tests appropriate to the change and complete required checks. Broaden testing only when new changes, failures, or unresolved concerns justify it."
- **Sources:** [Using GPT-6 — Testing and verification](https://developers.openai.com/api/docs/guides/latest-model#testing-and-verification) · [OpenAI blog — Up-to-date AGENTS.md](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)

### O08 Effort and model carried over from GPT-5.x
- **Readers:** OpenAI configs (V/R); see X13.
- **Look for:** high or max effort set by default on Astra; `none` or `minimal` effort on models that don't support it (Astra, 6.1 Sol); custom agents with a model but no effort.
- **Sources:** [Using GPT-6 — Migration quickstart](https://developers.openai.com/api/docs/guides/latest-model#migration-quickstart) · [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) · [Kundel on X](https://x.com/dkundel/status/2095972046014673156)

### O09 Inter-agent messages with no legibility requirement
- **Readers:** `gpt-6-astra` multi-agent harnesses (V). Low impact.
- **Look for:** agent-to-agent message contracts that humans also read, with no requirement for normal spacing and grammar.
- **Sources:** [Using GPT-6 — Subagent delegation](https://developers.openai.com/api/docs/guides/latest-model#subagent-delegation)

### O10 Preamble and status-update instructions
- **Readers:** OpenAI models. **Low confidence only.**
- **Why:** the guidance has flipped: GPT-5-Codex said to remove preamble prompting because it could stop the rollout early; GPT-5.6 recommended a short preamble and sparse updates; the GPT-6 guide is silent. Report only with an observed problem.
- **Sources:** [Codex prompting guide](https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide) · [GPT-5.6 prompt guidance](https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6)

---

## Keep list: do not flag

- **K1** Exact commands, scripts and fixed sequences for fragile, irreversible or tool-quirky operations.
- **K2** A shout attached to a demonstrated failure, with its reason.
- **K3** Interface contracts (names, paths, schemas, subagent inputs and outputs), chosen thresholds and policies, and operational invariants.
- **K4** Confirmation before risky, destructive or external actions (deploy, merge, publish, delete, external writes), placed as the last step.
- **K5** A scope fence on a write-capable agent, and a "you are read-only" line on a read-only one.
- **K6** A one-clause reason attached to a rule. Context is not cruft, and length alone is not a finding.
- **K7** Agreeing duplicates of a contract across files (flag only copies that disagree).
- **K8** A precedence line that resolves a real conflict.
- **K9** Frontmatter descriptions whose wording was calibrated by a trigger evaluation (classify by function before flagging; see C10).

## Known cross-family conflicts

Report these as conflicts for the owner rather than resolving them.
- **Boundaries:** fewer ask-first gates for `gpt-6-astra` (O01) versus scope fences for `claude-sonnet` (C04, K5). A gate on a reversible action is O01; a fence on what to touch is K5.
- **Verification:** remove for over-verifiers, require a concrete check for Sonnet (X06).
- **Formatting:** add a style spec for Astra (O04), drop anti-formatting rules for Fable (C06).
- **Descriptions:** targeted exclusions help routing, growing exclusion lists hurt it (X03).
- **Autonomy versus human-in-the-loop:** X16 additions belong only in unattended runs; leave them out where a person answers.
