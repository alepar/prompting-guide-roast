// prepare.mjs — build the roast engine's args from a target and this skill's prompt files, and write
// a runnable engine script with those args embedded. Invoked through ./prepare (bash wrapper).
// Exit codes: 0 ok, 2 bad input, 3 skill-file drift (a prompt file or marker the assembly needs is missing).
import { readFileSync, writeFileSync, mkdirSync, statSync, readdirSync, existsSync, globSync } from 'node:fs'
import { dirname, join, resolve, relative, basename, sep, matchesGlob } from 'node:path'
import { fileURLToPath } from 'node:url'

const SKILL = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const USAGE = `usage: prepare --target <dir|file|glob> (--model <m> | --models role=m,...) --out-dir <dir> [options]

  --target <dir|file|glob>    what to roast; repeatable. A directory is walked; every SKILL.md
                              below it starts its own unit, other files join their target's unit.
  --model <m>                 one model reads everything (e.g. opus, sonnet, fable, gpt-6-astra)
  --models <role=m,...>       models per runtime role, e.g. orchestrator=opus,implementer=sonnet.
                              A map stage decides which role reads each file.
  --default-model <m>         model for files no role claims (default: the first role's model)
  --file-model <glob=m>       pin files matching glob (unit-relative or absolute) to a model; repeatable
  --lanes <a,b>               run only these lanes;  --skip-lanes <a,b>  drop these lanes
  --ext <md,txt,...>          file extensions to include (default md,mdx,txt,prompt)
  --exclude <glob>            extra exclusion, repeatable; README*/CHANGELOG*/LICENSE*/CONTRIBUTING*,
                              .git and node_modules are excluded unless --no-default-excludes
  --max-group-lines <n>       pack files into scout groups of about this many lines (default 1200)
  --house-rules <file|none>   house rules for recommendations (default: bundled reference/house-rules.md)
  --guides-dir <dir>          optional local copies of the full vendor guides for scouts to consult
  --agent-models <site=m,...> override workflow agent models (sites: map, scout, dedupe, rate, systemic)
  --effort <site=e,...>       override workflow agent effort per site
  --top <n>                   top-N actions in the report (default 10; recorded for finalize)
  --label <text>              run label shown in the report
  --dry-run                   stub every agent (haiku, canned JSON) to validate the pipeline
  --out-dir <dir>             where args.json and run.js are written (required)`

const die = (code, msg) => { process.stderr.write(`prepare: ${msg}\n`); process.exit(code) }

// ---- argv
const opt = { target: [], fileModel: [], exclude: [] }
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--help' || a === '-h') { console.log(USAGE); process.exit(0) }
  if (a === '--dry-run') { opt.dryRun = true; continue }
  if (a === '--no-default-excludes') { opt.noDefaultExcludes = true; continue }
  if (!a.startsWith('--') || i + 1 >= argv.length) die(2, `bad argument '${a}'\n${USAGE}`)
  const k = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())
  const v = argv[++i]
  if (Array.isArray(opt[k])) opt[k].push(v)
  else opt[k] = v
}
const known = ['target', 'model', 'models', 'defaultModel', 'fileModel', 'lanes', 'skipLanes', 'ext', 'exclude', 'maxGroupLines',
  'houseRules', 'guidesDir', 'agentModels', 'effort', 'top', 'label', 'dryRun', 'noDefaultExcludes', 'outDir']
for (const k of Object.keys(opt)) if (!known.includes(k)) die(2, `unknown option --${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}`)
if (!opt.target.length) die(2, '--target is required')
if (!opt.outDir) die(2, '--out-dir is required')
if (!opt.model && !opt.models) die(2, 'pass --model <m> or --models role=m,...')
if (opt.model && opt.models) die(2, '--model and --models are exclusive')

// ---- models
const catalogFull = JSON.parse(readFileSync(join(SKILL, 'reference/models.json'), 'utf8'))
const resolveModel = m => {
  const key = String(m).trim().toLowerCase()
  for (const [id, e] of Object.entries(catalogFull)) if (id === key || e.aliases.includes(key)) return id
  die(2, `unknown model '${m}'. Known: ${Object.entries(catalogFull).map(([id, e]) => `${id} (${e.aliases.join(', ')})`).join('; ')}`)
}
const kv = (s, what) => Object.fromEntries(String(s).split(',').filter(Boolean).map(p => {
  const i = p.indexOf('=')
  if (i < 1) die(2, `${what}: expected key=value, got '${p}'`)
  return [p.slice(0, i).trim(), p.slice(i + 1).trim()]
}))
const roles = opt.model ? { main: resolveModel(opt.model) } : Object.fromEntries(Object.entries(kv(opt.models, '--models')).map(([r, m]) => [r, resolveModel(m)]))
if (!Object.keys(roles).length) die(2, '--models names no roles')
const defaultModel = opt.defaultModel ? resolveModel(opt.defaultModel) : Object.values(roles)[0]
const fileModels = opt.fileModel.map(s => {
  const i = s.lastIndexOf('=')
  if (i < 1) die(2, `--file-model: expected glob=model, got '${s}'`)
  return { glob: s.slice(0, i), model: resolveModel(s.slice(i + 1)) }
})
const catalog = Object.fromEntries(Object.entries(catalogFull).map(([id, e]) => [id, { family: e.family, label: e.label }]))

// ---- files
const exts = (opt.ext ?? 'md,mdx,txt,prompt').split(',').map(e => '.' + e.replace(/^\./, '').toLowerCase())
const defaultExcludes = opt.noDefaultExcludes ? [] : ['**/README*', '**/CHANGELOG*', '**/LICENSE*', '**/CONTRIBUTING*']
const excludes = [...defaultExcludes, ...opt.exclude]
const skipDir = name => name === '.git' || name === 'node_modules'
const isExcluded = abs => excludes.some(g => matchesGlob(abs, g) || matchesGlob(basename(abs), g))
const wanted = abs => exts.some(e => abs.toLowerCase().endsWith(e)) && !isExcluded(abs)
function walk(dir, out) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name)
    if (ent.isDirectory()) { if (!opt.noDefaultExcludes && skipDir(ent.name)) continue; walk(p, out) }
    else if (ent.isFile() && wanted(p)) out.push(p)
  }
  return out
}
const targets = []  // { root, files }
for (const t of opt.target) {
  const abs = resolve(t)
  if (existsSync(abs) && statSync(abs).isDirectory()) targets.push({ root: abs, files: walk(abs, []) })
  else if (existsSync(abs) && statSync(abs).isFile()) targets.push({ root: dirname(abs), files: [abs] })
  else {
    const hits = globSync(t).map(p => resolve(p)).filter(p => statSync(p).isFile() && !isExcluded(p))
    if (!hits.length) die(2, `target matched nothing: ${t}`)
    const common = hits.map(dirname).reduce((a, b) => { while (!(b + sep).startsWith(a + sep) && a !== dirname(a)) a = dirname(a); return a })
    targets.push({ root: common, files: hits })
  }
}
const allFiles = [...new Set(targets.flatMap(t => t.files))].sort()
if (!allFiles.length) die(2, 'no files to roast (check --ext and --exclude)')

// ---- units: each SKILL.md directory is a unit; other files belong to the deepest unit above them,
// or to their target's root.
const skillRoots = allFiles.filter(f => basename(f) === 'SKILL.md').map(dirname).sort((a, b) => b.length - a.length)
const unitsByRoot = new Map()
for (const f of allFiles) {
  const root = skillRoots.find(r => f.startsWith(r + sep)) ?? targets.find(t => t.files.includes(f)).root
  if (!unitsByRoot.has(root)) unitsByRoot.set(root, [])
  unitsByRoot.get(root).push(f)
}
const maxLines = Number(opt.maxGroupLines ?? 1200)
if (!(maxLines >= 100)) die(2, '--max-group-lines must be >= 100')
const lineCount = p => { const s = readFileSync(p, 'utf8'); return s.length ? s.split('\n').length - (s.endsWith('\n') ? 1 : 0) : 0 }
const usedKeys = new Set()
const units = [...unitsByRoot.entries()].map(([root, files]) => {
  let key = basename(root) || 'root'
  for (let n = 2; usedKeys.has(key); n++) key = `${basename(root)}-${n}`
  usedKeys.add(key)
  const order = f => (basename(f) === 'SKILL.md' ? 0 : 1)
  const entries = files.sort((a, b) => order(a) - order(b) || a.localeCompare(b)).map(abs => {
    const rel = relative(root, abs)
    const pin = fileModels.find(fm => matchesGlob(rel, fm.glob) || matchesGlob(abs, fm.glob))
    return { rel, path: abs, lines: lineCount(abs), ...(pin ? { model: pin.model, role: `pinned (${pin.glob})` } : {}) }
  })
  // Pack small files together up to maxLines (at most 6 per group); split a large file into ranges.
  const groups = []
  let cur = null
  const flush = () => { if (cur?.files.length) groups.push(cur); cur = null }
  for (const f of entries) {
    if (f.lines > maxLines) {
      flush()
      for (let s = 1; s <= f.lines; s += maxLines) groups.push({ files: [{ ...f, range: [s, Math.min(f.lines, s + maxLines - 1)] }], lines: Math.min(maxLines, f.lines - s + 1) })
      continue
    }
    if (!cur || cur.lines + f.lines > maxLines || cur.files.length >= 6) { flush(); cur = { files: [], lines: 0 } }
    cur.files.push(f); cur.lines += f.lines
  }
  flush()
  groups.forEach((g, i) => { g.key = groups.length === 1 ? key : `${key}#${i + 1}` })
  const entrypoints = entries.map(e => e.rel).filter(r => ['SKILL.md', 'AGENTS.md', 'CLAUDE.md'].includes(basename(r)))
  return { key, dir: root, entrypoints, files: entries, groups: groups.map(({ key, files }) => ({ key, files })) }
})

// ---- skill files
const read = rel => {
  const p = join(SKILL, rel)
  if (!existsSync(p)) die(3, `missing skill file ${rel}`)
  return readFileSync(p, 'utf8')
}
function parseLane(text, file) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!m) die(3, `lane ${file}: missing frontmatter`)
  const fm = Object.fromEntries(m[1].split('\n').map(l => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map(x => [x[1], x[2].trim()]))
  for (const k of ['key', 'title', 'scope', 'families']) if (!fm[k]) die(3, `lane ${file}: frontmatter lacks ${k}`)
  if (!['group', 'unit'].includes(fm.scope)) die(3, `lane ${file}: scope must be group or unit`)
  const parts = m[2].split(/^## (\S+)\s*$/m)
  const byFamily = {}
  for (let i = 1; i < parts.length; i += 2) byFamily[parts[i]] = parts[i + 1].trim()
  return { key: fm.key, title: fm.title, scope: fm.scope, families: fm.families.split(',').map(s => s.trim()), brief: parts[0].trim(), byFamily }
}
const laneFiles = readdirSync(join(SKILL, 'lanes')).filter(f => f.endsWith('.md')).sort()
let lanes = laneFiles.map(f => parseLane(read(`lanes/${f}`), f))
const laneKeys = lanes.map(l => l.key)
const pickList = s => s ? s.split(',').map(x => x.trim()).filter(Boolean) : null
const only = pickList(opt.lanes), skip = pickList(opt.skipLanes) ?? []
for (const k of [...(only ?? []), ...skip]) if (!laneKeys.includes(k)) die(2, `unknown lane '${k}'. Lanes: ${laneKeys.join(', ')}`)
lanes = lanes.filter(l => (!only || only.includes(l.key)) && !skip.includes(l.key))
if (!lanes.length) die(2, 'no lanes left to run')

const prompts = {}
for (const p of ['scout', 'map', 'dedupe', 'rate', 'systemic']) prompts[p] = read(`prompts/${p}.md`).trim()
for (const [p, tokens] of Object.entries({ scout: ['{{LANE_BRIEF}}', '{{FILES}}', '{{DIGEST_PATH}}'], map: ['{{ROLES}}', '{{FILES}}'],
  dedupe: ['{{FINDINGS_JSON}}'], rate: ['{{FINDINGS_JSON}}'], systemic: ['{{FINDINGS_JSON}}'] }))
  for (const t of tokens) if (!prompts[p].includes(t)) die(3, `prompts/${p}.md lacks token ${t}`)

let houseRules = null
if (opt.houseRules !== 'none') {
  const p = opt.houseRules ? resolve(opt.houseRules) : join(SKILL, 'reference/house-rules.md')
  if (!existsSync(p)) die(2, `house rules not found: ${p}`)
  houseRules = readFileSync(p, 'utf8').trim()
}
if (opt.guidesDir && !existsSync(opt.guidesDir)) die(2, `guides dir not found: ${opt.guidesDir}`)

if (opt.dryRun) {
  prompts.stubs = {
    map: '{"files":[{"file":"{{FIRST_FILE}}","role":"{{FIRST_ROLE}}","basis":"stub"}]}',
    scout: '{"findings":[{"file":"{{FILE}}","lineStart":1,"lineEnd":1,"quote":"stub quote","pattern":"stub-{{LANE}}","targetModel":"{{MODEL}}","whyHarmful":"stub","guideRefs":["X01"],"action":"flag","recommendedAction":"stub action A","confidence":"medium"},{"file":"{{FILE}}","lineStart":2,"lineEnd":2,"quote":"stub quote 2","pattern":"stub-{{LANE}}","targetModel":"{{MODEL}}","whyHarmful":"stub","guideRefs":["X02"],"action":"remove","recommendedAction":"stub action B","confidence":"high"}],"cleanNotes":"stub"}',
    dedupe: '{"groups":[{"ids":[0,1],"mergedPattern":"stub-merged"},{"ids":[2]}]}',
    rate: '{"ratings":[{"id":0,"impact":"high","exposure":"hot","rationale":"stub"},{"id":1,"impact":"medium","exposure":"warm","rationale":"stub"}]}',
    systemic: '{"patterns":[{"pattern":"stub-pattern","summary":"stub","targetModels":["stub"],"findingIds":[0,1,9999],"recommendedFix":"stub fix","guideRefs":["X01"]}],"conflicts":[{"summary":"stub conflict","findingIds":[0]}]}',
  }
}

const config = {}
if (opt.agentModels) config.agentModels = kv(opt.agentModels, '--agent-models')
if (opt.effort) config.effort = kv(opt.effort, '--effort')
config.topN = Number(opt.top ?? 10)

const args = {
  label: opt.label ?? units.map(u => u.key).join(', '),
  target: opt.target.join(' '),
  dryRun: !!opt.dryRun,
  units,
  lanes,
  prompts,
  models: { roles, default: defaultModel, catalog },
  refs: { digestPath: join(SKILL, 'reference/guide-digest.md'), houseRules, guidesDir: opt.guidesDir ? resolve(opt.guidesDir) : null },
  config,
}

// ---- write
const engine = read('engine/roast.js')
const MARK = 'const EMBEDDED_ARGS = null // @@EMBEDDED_ARGS@@'
if (!engine.includes(MARK)) die(3, 'engine/roast.js lacks the EMBEDDED_ARGS marker')
const outDir = resolve(opt.outDir)
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'args.json'), JSON.stringify(args, null, 1))
writeFileSync(join(outDir, 'run.js'), engine.replace(MARK, () => `const EMBEDDED_ARGS = ${JSON.stringify(args)}`))

// Upper bound on scouts: a lane counts for a group when any role model could read it.
const fams = new Set([...Object.values(roles), defaultModel, ...fileModels.map(f => f.model)].map(m => catalog[m].family))
const laneMayRun = l => l.families.includes('any') || l.families.some(f => fams.has(f))
const scoutBound = units.reduce((s, u) => s + lanes.filter(laneMayRun).reduce((t, l) => t + (l.scope === 'unit' ? 1 : u.groups.length), 0), 0)
console.log(JSON.stringify({
  script: join(outDir, 'run.js'),
  args: join(outDir, 'args.json'),
  dryRun: !!opt.dryRun,
  units: units.map(u => ({ key: u.key, dir: u.dir, files: u.files.length, lines: u.files.reduce((s, f) => s + f.lines, 0), groups: u.groups.length })),
  roles, defaultModel,
  lanes: lanes.map(l => l.key),
  agentsUpperBound: scoutBound + units.length * 2 + 1 + Math.max(1, Math.ceil(scoutBound * 3 / 60)),
}, null, 1))
