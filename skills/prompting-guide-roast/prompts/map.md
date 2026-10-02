Decide which runtime role reads each file of the agent skill (or prompt set) at {{UNIT_DIR}}. Another stage audits each file against the prompting guidance for the model that reads it, so a wrong reader means the file is judged against the wrong guide.

Roles the caller defined (role → model):
{{ROLES}}

Files (paths relative to the unit root):
{{FILES}}

Entrypoints: {{ENTRYPOINTS}}

Read the entrypoints and grep for each file's name to see how it is used: loaded by the main agent that invoked the skill, pasted into a subagent dispatch, sent to a specific model in a workflow config, or only read by maintainers. Assign each file the role whose model reads it most at runtime. A file the main agent reads (SKILL.md, references it loads) belongs to the role that runs the skill; a template dispatched to a subagent belongs to that subagent's role. When nothing in the files says who reads one, choose the role that runs the skill and say so in `basis`.

Return one entry per file, using the paths exactly as listed, with a one-line `basis` naming the evidence (for example "SKILL.md step 3 dispatches it to the implementer").
