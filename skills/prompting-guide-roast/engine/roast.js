export const meta = {
  name: 'prompting-guide-roast',
  description: 'Roast skill/prompt files against Claude and OpenAI prompting guidance: map readers -> lane scouts -> dedupe -> rate + systemic',
  phases: [
    { title: 'Map', detail: 'decide which runtime model reads each file' },
    { title: 'Scout', detail: 'one scout per (lane x file group) where the lane applies to the readers' },
    { title: 'Dedupe', detail: 'group duplicate findings per unit; the engine merges members' },
    { title: 'Rank', detail: 'rate impact/exposure in chunks; cluster systemic patterns' },
  ],
}

// `scripts/prepare` writes a copy of this file with the run's args embedded on the next line, so the
// orchestrator launches it by scriptPath without transcribing the args. Explicit `args` win.
const EMBEDDED_ARGS = null // @@EMBEDDED_ARGS@@

const A = (() => {
  const a = args ?? EMBEDDED_ARGS
  return typeof a === 'string' ? JSON.parse(a) : a
})()
if (!A || !A.units || !A.lanes || !A.prompts) {
  throw new Error('prompting-guide-roast: args must carry {units, lanes, prompts, models} (build them with scripts/prepare) — got ' + JSON.stringify(A).slice(0, 200))
}
const { units, lanes, prompts, models, refs = {}, config = {}, dryRun = false } = A
const MODELS = models.catalog // canonical id -> { family, label }
const SITE_MODEL = { map: 'sonnet', dedupe: undefined, rate: undefined, systemic: undefined, scout: undefined }
const SITE_EFFORT = { map: 'low', dedupe: 'medium', rate: 'medium' }
const opts = (site, label, phase, schema) => {
  const o = { label, phase, schema }
  const m = dryRun ? 'haiku' : (config.agentModels?.[site] ?? SITE_MODEL[site])
  const e = dryRun ? 'low' : (config.effort?.[site] ?? SITE_EFFORT[site])
  if (m) o.model = m
  if (e) o.effort = e
  return o
}

// Single pass over all tokens, so a substituted value that quotes a later token stays literal (this
// skill roasts prompt files, which may contain `{{...}}`). Function replacement keeps `$&` literal.
const fill = (template, vars) => {
  const keys = Object.keys(vars)
  if (!keys.length) return template
  const re = new RegExp(keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g')
  return template.replace(re, t => String(vars[t] ?? ''))
}
// The stub wording is exact: it is the phrasing validated with haiku stubs. Any preface or rewording
// risks a stub reading the canned JSON as a task and working the repo instead of answering.
const stubJson = (site, vars = {}) => fill(prompts.stubs?.[site] ?? '{}', vars)
const stub = (site, vars) => `You are a stub. Call no tools. Return exactly this JSON as your structured output: ${stubJson(site, vars)}`
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x)
// Every agent call goes through ask(). On a dryRun it also checks the stub answered with its canned
// JSON; a deviation means a stub did something else, and the run reports it as a coverage gap.
const stubDeviations = []
async function ask(real, site, vars, o) {
  const r = await agent(dryRun ? stub(site, vars) : real, o)
  if (dryRun && r && canon(r) !== canon(JSON.parse(stubJson(site, vars)))) stubDeviations.push(o.label)
  return r
}
const uniq = xs => [...new Set(xs.filter(x => x !== undefined && x !== null && x !== ''))]
const CONF = { high: 3, medium: 2, low: 1 }

// ---------------------------------------------------------------- schemas
const modelIds = Object.keys(MODELS)
const roleNames = Object.keys(models.roles ?? {})
const MAP_SCHEMA = { type: 'object', properties: { files: { type: 'array', items: { type: 'object', properties: {
  file: { type: 'string' }, role: roleNames.length ? { enum: roleNames } : { type: 'string' }, basis: { type: 'string' } },
  required: ['file', 'role', 'basis'] } } }, required: ['files'] }
const FINDING_PROPS = {
  file: { type: 'string', description: 'path exactly as listed under "Files under review"' },
  lineStart: { type: 'integer' },
  lineEnd: { type: 'integer' },
  quote: { type: 'string', description: 'exact verbatim text from the file, <=400 chars; machine-checked' },
  pattern: { type: 'string', description: 'short name of the anti-pattern' },
  targetModel: { enum: [...modelIds, 'mixed'] },
  whyHarmful: { type: 'string', description: '1-3 sentences tying the text to the reader model\'s documented behavior' },
  guideRefs: { type: 'array', items: { type: 'string' }, description: 'guide-digest entry ids (e.g. C07, O03) and/or house:<rule>' },
  guidePassage: { type: 'string', description: 'the guide sentence the finding rests on, quoted or closely paraphrased from the digest entry' },
  action: { enum: ['remove', 'rewrite', 'move', 'add', 'flag'] },
  recommendedAction: { type: 'string', description: 'one concrete imperative sentence a maintainer can apply' },
  suggestedRewrite: { type: 'string', description: 'replacement text for rewrite/add, destination for move, empty otherwise' },
  confidence: { enum: ['high', 'medium', 'low'] },
}
const SCOUT_SCHEMA = { type: 'object', properties: {
  findings: { type: 'array', items: { type: 'object', properties: FINDING_PROPS,
    required: ['file', 'lineStart', 'quote', 'pattern', 'targetModel', 'whyHarmful', 'guideRefs', 'action', 'recommendedAction', 'confidence'] } },
  cleanNotes: { type: 'string', description: 'one or two sentences on what you checked and found clean' },
}, required: ['findings', 'cleanNotes'] }
// Dedupe returns groups of raw-finding ids, never rewritten findings: the engine assembles each merged
// finding from its members, so no quote, location or rewrite is lost in transcription.
const GROUPS_SCHEMA = { type: 'object', properties: { groups: { type: 'array', items: { type: 'object', properties: {
  ids: { type: 'array', items: { type: 'integer' } }, mergedPattern: { type: 'string' } }, required: ['ids'] } } }, required: ['groups'] }
const RATE_SCHEMA = { type: 'object', properties: { ratings: { type: 'array', items: { type: 'object', properties: {
  id: { type: 'integer' }, impact: { enum: ['high', 'medium', 'low'] }, exposure: { enum: ['hot', 'warm', 'cold'] },
  rationale: { type: 'string' } }, required: ['id', 'impact', 'exposure', 'rationale'] } } }, required: ['ratings'] }
const SYSTEMIC_SCHEMA = { type: 'object', properties: {
  patterns: { type: 'array', items: { type: 'object', properties: {
    pattern: { type: 'string' }, summary: { type: 'string' }, targetModels: { type: 'array', items: { type: 'string' } },
    findingIds: { type: 'array', items: { type: 'integer' } }, recommendedFix: { type: 'string' },
    guideRefs: { type: 'array', items: { type: 'string' } } },
    required: ['pattern', 'summary', 'findingIds', 'recommendedFix'] } },
  conflicts: { type: 'array', items: { type: 'object', properties: {
    summary: { type: 'string' }, findingIds: { type: 'array', items: { type: 'integer' } } }, required: ['summary', 'findingIds'] } },
}, required: ['patterns', 'conflicts'] }

// ---------------------------------------------------------------- per-unit pieces
const label = m => MODELS[m]?.label ?? m
const familyOf = m => MODELS[m]?.family ?? 'generic'
const fileLine = (f, modelOf) => {
  const range = f.range ? `, lines ${f.range[0]}-${f.range[1]} ONLY (Read with offset/limit)` : ''
  const m = modelOf(f.rel)
  return `- ${f.rel}${range} — read at runtime by: ${f.role ?? 'unknown role'} → ${label(m)}`
}

function laneApplies(lane, modelSet) {
  if (lane.models?.length) return modelSet.some(m => lane.models.includes(m))
  if (!lane.families?.length || lane.families.includes('any')) return true
  return modelSet.some(m => lane.families.includes(familyOf(m)))
}
function laneBrief(lane, modelSet) {
  const fams = uniq(modelSet.map(familyOf))
  const extra = Object.entries(lane.byFamily ?? {}).filter(([fam]) => fams.includes(fam)).map(([, text]) => text)
  return [lane.brief, ...extra].join('\n\n')
}

function scoutPrompt(lane, unit, files, modelOf) {
  const modelSet = uniq(files.map(f => modelOf(f.rel)))
  return fill(prompts.scout, {
    '{{UNIT_DIR}}': unit.dir,
    '{{LANE_KEY}}': lane.key,
    '{{LANE_TITLE}}': lane.title,
    '{{LANE_BRIEF}}': laneBrief(lane, modelSet),
    '{{SCOPE_NOTE}}': lane.scope === 'unit' ? `This lane covers the whole unit: every file listed below, read together.` : `Other scouts cover the unit's other files.`,
    '{{FILES}}': files.map(f => fileLine(f, modelOf)).join('\n'),
    '{{READER_MODELS}}': modelSet.map(m => `${m} (${label(m)})`).join(', '),
    '{{DIGEST_PATH}}': refs.digestPath,
    '{{HOUSE_RULES}}': refs.houseRules ? refs.houseRules : 'No house rules supplied for this run.',
    '{{EXTRA_REFS}}': refs.guidesDir ? `Full vendor guides are also available locally in ${refs.guidesDir}; read a section when a digest entry is too thin to decide.` : '',
  })
}

function mergeGroup(g, raw) {
  const members = g.ids.map(i => raw[i])
  const rep = [...members].sort((a, b) => (CONF[b.confidence] ?? 0) - (CONF[a.confidence] ?? 0))[0]
  const actions = uniq(members.map(m => m.action))
  const merged = {
    ...rep,
    pattern: g.mergedPattern || rep.pattern,
    lanes: uniq(members.map(m => m.lane)),
    guideRefs: uniq(members.flatMap(m => m.guideRefs ?? [])),
    locations: members.map(m => ({ file: m.file, lineStart: m.lineStart, lineEnd: m.lineEnd ?? m.lineStart, quote: m.quote })),
    mergedCount: members.length,
  }
  delete merged.lane
  const others = uniq(members.filter(m => m !== rep && m.recommendedAction !== rep.recommendedAction).map(m => m.recommendedAction))
  if (others.length) merged.alternativeActions = others.slice(0, 3)
  // A merge whose members disagree on remove vs keep-and-change is surfaced, never silently resolved.
  if (actions.length > 1 && actions.includes('remove')) merged.actionConflict = actions
  return merged
}

async function runUnit(unit) {
  // Map: who reads each file at runtime. Explicit file models and single-role runs skip the agent.
  const assigned = {}
  for (const f of unit.files) if (f.model) assigned[f.rel] = { model: f.model, role: f.role ?? 'assigned' }
  const unmapped = unit.files.filter(f => !assigned[f.rel])
  let mapDead = false
  if (unmapped.length && roleNames.length > 1) {
    const p = fill(prompts.map, {
      '{{UNIT_DIR}}': unit.dir,
      '{{ROLES}}': roleNames.map(r => `- ${r} → ${label(models.roles[r])}`).join('\n'),
      '{{FILES}}': unit.files.map(f => `- ${f.rel} (${f.lines} lines)`).join('\n'),
      '{{ENTRYPOINTS}}': (unit.entrypoints ?? []).join(', ') || 'none found; infer from file names and contents',
    })
    const r = await ask(p, 'map', { '{{FIRST_FILE}}': unmapped[0].rel, '{{FIRST_ROLE}}': roleNames[0] },
      opts('map', `map ${unit.key}`, 'Map', MAP_SCHEMA))
    mapDead = !r
    for (const e of r?.files ?? []) {
      const f = unmapped.find(x => x.rel === e.file)
      if (f && models.roles[e.role]) assigned[f.rel] = { model: models.roles[e.role], role: e.role, basis: e.basis }
    }
  }
  for (const f of unit.files) if (!assigned[f.rel]) assigned[f.rel] = { model: models.default, role: roleNames.length === 1 ? roleNames[0] : 'default' }
  const modelOf = rel => assigned[rel]?.model ?? models.default
  const withRole = f => ({ ...f, role: assigned[f.rel]?.role })

  // Scout: every applicable (lane x group) for group lanes, one scout per unit lane.
  const jobs = []
  for (const lane of lanes) {
    const targets = lane.scope === 'unit' ? [{ key: unit.key, files: unit.files }] : unit.groups
    for (const g of targets) {
      const files = (g.files ?? []).map(withRole)
      if (!files.length) continue
      const modelSet = uniq(files.map(f => modelOf(f.rel)))
      if (!laneApplies(lane, modelSet)) continue
      jobs.push({ lane, gkey: g.key, files })
    }
  }
  const results = await parallel(jobs.map(j => () => {
    const real = dryRun ? '' : scoutPrompt(j.lane, unit, j.files, modelOf)
    return ask(real, 'scout', { '{{FILE}}': j.files[0].rel, '{{MODEL}}': modelOf(j.files[0].rel), '{{LANE}}': j.lane.key },
      opts('scout', `${j.lane.key} @ ${j.gkey}`, 'Scout', SCOUT_SCHEMA))
  }))
  const deadScouts = jobs.filter((_, i) => !results[i]).map(j => `${j.lane.key} @ ${j.gkey}`)
  const raw = results.flatMap((r, i) => (r?.findings ?? []).map(f => ({ ...f, lane: jobs[i].lane.key, unit: unit.key })))
  const clean = results.map((r, i) => r && { lane: jobs[i].lane.key, group: jobs[i].gkey, n: r.findings?.length ?? 0, cleanNotes: r.cleanNotes }).filter(Boolean)
  log(`${unit.key}: ${jobs.length - deadScouts.length}/${jobs.length} scouts returned · ${raw.length} raw findings`)

  // Dedupe: one agent per unit returns id groups; re-dispatched once on a dead response.
  let deduped = [], dedupeDead = false, orphans = 0
  if (raw.length) {
    const p = fill(prompts.dedupe, { '{{FINDINGS_JSON}}': JSON.stringify(raw.map((f, id) => ({ id, ...f }))) })
    const once = () => ask(p, 'dedupe', {}, opts('dedupe', `dedupe ${unit.key}`, 'Dedupe', GROUPS_SCHEMA))
    const dd = (await once()) ?? (await once())
    dedupeDead = !dd?.groups?.length
    const claimed = new Set(), groups = []
    for (const g of dd?.groups ?? []) {
      const ids = [...new Set(g.ids)].filter(i => Number.isInteger(i) && i >= 0 && i < raw.length && !claimed.has(i))
      ids.forEach(i => claimed.add(i))
      if (ids.length) groups.push({ ...g, ids })
    }
    // A raw finding no group claimed is kept as its own finding, so a merge slip never drops one.
    const left = raw.map((_, i) => i).filter(i => !claimed.has(i))
    orphans = dedupeDead ? 0 : left.length
    if (orphans) log(`${unit.key}: dedupe left ${orphans} finding(s) ungrouped; kept individually`)
    left.forEach(i => groups.push({ ids: [i] }))
    deduped = groups.map(g => mergeGroup(g, raw))
    log(`${unit.key}: ${raw.length} -> ${deduped.length} after dedupe${dedupeDead ? ' (dedupe dead: raw kept)' : ''}`)
  }
  return {
    unit: unit.key,
    dir: unit.dir,
    files: unit.files.map(f => ({ rel: f.rel, lines: f.lines, ...assigned[f.rel] })),
    findings: deduped,
    clean,
    coverage: { scouts: jobs.length, deadScouts, raw: raw.length, deduped: deduped.length, dedupeDead, orphans, mapDead },
  }
}

// ---------------------------------------------------------------- run
const perUnit = (await pipeline(units, unit => runUnit(unit))).map((r, i) => r ?? {
  unit: units[i].key, files: [], findings: [], clean: [],
  coverage: { scouts: 0, deadScouts: ['(whole unit failed)'], raw: 0, deduped: 0, dedupeDead: false, orphans: 0, mapDead: false, unitDead: true },
})
const findings = perUnit.flatMap(u => u.findings).map((f, id) => ({ id, ...f }))

phase('Rank')
const compact = f => ({ id: f.id, unit: f.unit, file: f.file, line: f.lineStart, pattern: f.pattern, targetModel: f.targetModel,
  lanes: f.lanes, confidence: f.confidence, quote: String(f.quote ?? '').slice(0, 160), action: f.recommendedAction })
const chunkSize = config.rateChunk ?? 60
const chunks = []
for (let i = 0; i < findings.length; i += chunkSize) chunks.push(findings.slice(i, i + chunkSize))
const exposureNotes = perUnit.map(u => `${u.unit}: ` + u.files.map(f => `${f.rel} → ${f.role ?? '?'} (${f.model})`).join('; ')).join('\n')
const [ratingParts, systemic] = findings.length ? await Promise.all([
  parallel(chunks.map((c, k) => () => ask(
    fill(prompts.rate, { '{{FINDINGS_JSON}}': JSON.stringify(c), '{{READERS}}': exposureNotes, '{{DIGEST_PATH}}': refs.digestPath }), 'rate', {},
    opts('rate', `rate ${k + 1}/${chunks.length}`, 'Rank', RATE_SCHEMA)))),
  ask(fill(prompts.systemic, { '{{FINDINGS_JSON}}': JSON.stringify(findings.map(compact)), '{{DIGEST_PATH}}': refs.digestPath }), 'systemic', {},
    opts('systemic', 'systemic', 'Rank', SYSTEMIC_SCHEMA)),
]) : [[], null]
const ratings = {}
for (const part of ratingParts ?? []) for (const r of part?.ratings ?? []) if (Number.isInteger(r.id) && r.id >= 0 && r.id < findings.length && !ratings[r.id]) ratings[r.id] = r
const unrated = findings.filter(f => !ratings[f.id]).map(f => f.id)
if (stubDeviations.length) log(`dryRun: ${stubDeviations.length} stub(s) did not return their canned JSON: ${stubDeviations.join(', ')}`)
if (unrated.length) log(`rank: ${unrated.length} finding(s) unrated; finalize rates them medium/warm`)
if (findings.length && !systemic) log('rank: systemic agent returned nothing; report will have no systemic section')

return {
  engine: 'prompting-guide-roast',
  dryRun,
  label: A.label ?? '',
  target: A.target ?? '',
  catalog: MODELS,
  config: { topN: config.topN ?? 10 },
  units: perUnit.map((u, i) => ({ unit: u.unit, dir: units[i].dir, files: u.files, coverage: u.coverage, clean: u.clean })),
  findings,
  ratings,
  systemic: systemic ?? null,
  coverage: {
    units: perUnit.length,
    scouts: perUnit.reduce((s, u) => s + u.coverage.scouts, 0),
    deadScouts: perUnit.flatMap(u => u.coverage.deadScouts.map(d => `${u.unit}: ${d}`)),
    raw: perUnit.reduce((s, u) => s + u.coverage.raw, 0),
    deduped: findings.length,
    dedupeDead: perUnit.filter(u => u.coverage.dedupeDead).map(u => u.unit),
    mapDead: perUnit.filter(u => u.coverage.mapDead).map(u => u.unit),
    orphans: perUnit.reduce((s, u) => s + u.coverage.orphans, 0),
    rateChunks: chunks.length,
    rateChunksDead: (ratingParts ?? []).filter(p => !p).length,
    unrated,
    systemicDead: findings.length > 0 && !systemic,
    stubDeviations,
  },
}
