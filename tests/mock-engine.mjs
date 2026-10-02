// mock-engine.mjs — run the roast engine under node with stub agent()/parallel()/pipeline(), then
// finalize, and assert on the results. Covers paths a dryRun cannot reach (dead dedupe, dead scouts,
// orphan ids, bad map output, quote verification) and inspects the filled prompts.
// Usage: node tests/mock-engine.mjs   (exit 0 = all assertions passed)
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SKILL = join(ROOT, 'skills/prompting-guide-roast')
const FIX = join(ROOT, 'tests/fixtures/demo-skill')
const tmp = mkdtempSync(join(tmpdir(), 'pgr-test-'))
const AsyncFunction = (async () => {}).constructor

function prepare(dir, extra) {
  const out = execFileSync('bash', [join(SKILL, 'scripts/prepare'), '--target', FIX, '--out-dir', dir, ...extra], { encoding: 'utf8' })
  return JSON.parse(out)
}
async function runEngine(scriptPath, agentImpl) {
  const src = readFileSync(scriptPath, 'utf8').replace('export const meta', 'const meta')
  const calls = []
  const agent = async (prompt, opts) => { calls.push({ prompt, opts }); return agentImpl(prompt, opts, calls) }
  const settle = p => Promise.resolve().then(p).catch(() => null)
  const parallel = thunks => Promise.all(thunks.map(t => settle(t)))
  const pipeline = (items, ...stages) => Promise.all(items.map((item, i) => settle(async () => {
    let v = item
    for (const st of stages) v = await st(v, item, i)
    return v
  })))
  const logs = []
  const fn = new AsyncFunction('args', 'agent', 'parallel', 'pipeline', 'phase', 'log', src)
  const result = await fn(undefined, agent, parallel, pipeline, () => {}, m => logs.push(m))
  return { result, calls, logs }
}
const lane = p => p.opts.label.split(' @ ')[0]

// ---------- case A: real path, mixed Claude + OpenAI readers
const dirA = join(tmp, 'a')
const prepA = prepare(dirA, ['--models', 'orchestrator=opus,implementer=gpt-6-astra', '--label', 'demo'])
assert.equal(prepA.units.length, 1)
assert.equal(prepA.units[0].files, 2)
let scoutN = 0
const A = await runEngine(join(dirA, 'run.js'), (prompt, opts) => {
  if (opts.label.startsWith('map')) return { files: [
    { file: 'implementer-prompt.md', role: 'implementer', basis: 'SKILL.md step 2' },
    { file: 'nope.md', role: 'implementer', basis: 'bogus file is ignored' },
  ] }
  if (opts.phase === 'Scout') {
    const k = scoutN++
    if (lane({ opts }) === 'untrusted-content') throw new Error('scout died')
    if (lane({ opts }) === 'pressure-language') return { findings: [
      { file: 'SKILL.md', lineStart: 8, lineEnd: 8, quote: 'You MUST ALWAYS read architecture.md, database.md and deployment.md before every edit.', pattern: 'shouting', targetModel: 'claude-opus', whyHarmful: 'x', guideRefs: ['X01'], action: 'rewrite', recommendedAction: 'Say it calmly.', confidence: 'high' },
      { file: 'SKILL.md', lineStart: 3, quote: 'this text is not in the file', pattern: 'phantom', targetModel: 'claude-opus', whyHarmful: 'x', guideRefs: ['X01'], action: 'remove', recommendedAction: 'n/a', confidence: 'low' },
    ], cleanNotes: '' }
    if (lane({ opts }) === 'over-specification') return { findings: [
      { file: 'SKILL.md', lineStart: 8, quote: 'read architecture.md, database.md and deployment.md before every edit', pattern: 'read-everything-first', targetModel: 'claude-opus', whyHarmful: 'x', guideRefs: ['X05'], action: 'remove', recommendedAction: 'Make the pointers conditional.', confidence: 'medium' },
    ], cleanNotes: '' }
    if (lane({ opts }) === 'openai-decision-boundaries') return { findings: [
      { file: 'implementer-prompt.md', lineStart: 3, quote: 'Always ask before making changes.  Do not mutate', pattern: 'ask-first', targetModel: 'gpt-6-astra', whyHarmful: 'x', guideRefs: ['O01'], action: 'rewrite', recommendedAction: 'Grant permission for reversible edits.', confidence: 'high' },
    ], cleanNotes: '' }
    return { findings: [], cleanNotes: `clean ${k}` }
  }
  if (opts.label.startsWith('dedupe')) return { groups: [{ ids: [0, 2, 0], mergedPattern: 'blanket read-first' }, { ids: [3, 99] }] } // 1 left as orphan
  if (opts.label.startsWith('rate')) return { ratings: [{ id: 0, impact: 'high', exposure: 'hot', rationale: 'r' }, { id: 1, impact: 'high', exposure: 'hot', rationale: 'r' }] }
  if (opts.label === 'systemic') return { patterns: [{ pattern: 'p', summary: 's', findingIds: [0, 1, 7], recommendedFix: 'fix once', guideRefs: ['X01'] }], conflicts: [{ summary: 'c', findingIds: [1, 50] }] }
  throw new Error('unexpected agent ' + opts.label)
})
const rA = A.result
const files = Object.fromEntries(rA.units[0].files.map(f => [f.rel, f]))
assert.equal(files['implementer-prompt.md'].model, 'gpt-6-astra', 'map assigns implementer file to astra')
assert.equal(files['SKILL.md'].model, 'claude-opus', 'unclaimed file falls back to default model')
const scoutCalls = A.calls.filter(c => c.opts.phase === 'Scout')
assert.equal(scoutCalls.length, 11, 'all 11 lanes apply to a mixed claude+openai group')
const openaiLane = scoutCalls.find(c => lane(c) === 'openai-decision-boundaries')
assert.match(openaiLane.prompt, /GPT-6 Astra is more tentative/)
const verif = scoutCalls.find(c => lane(c) === 'verification-and-review').prompt
assert.match(verif, /Claude Opus 5\.x and Fable verify/, 'claude family section included')
assert.match(verif, /GPT-6 Astra tests thoroughly/, 'openai family section included')
assert.match(verif, /implementer-prompt\.md — read at runtime by: implementer → GPT-6 Astra/)
assert.ok(!verif.includes('{{'), 'no unfilled tokens in scout prompt')
assert.equal(rA.coverage.deadScouts.length, 1)
assert.equal(rA.coverage.raw, 4)
assert.equal(rA.coverage.deduped, 3, 'groups [0,2] and [3] plus orphan 1')
assert.equal(rA.coverage.orphans, 1)
const merged = rA.findings.find(f => f.mergedCount === 2)
assert.deepEqual(merged.lanes.sort(), ['over-specification', 'pressure-language'])
assert.equal(merged.pattern, 'blanket read-first')
assert.equal(merged.confidence, 'high', 'representative is the highest-confidence member')
assert.deepEqual(merged.actionConflict, ['rewrite', 'remove'])
assert.equal(rA.coverage.unrated.length, 1)
assert.equal(rA.config.topN, 10)
const mapPrompt = A.calls.find(c => c.opts.label.startsWith('map'))
assert.equal(mapPrompt.opts.model, 'sonnet')

// finalize on case A
writeFileSync(join(tmp, 'a.result.json'), JSON.stringify({ summary: 'x', result: rA }))
const fin = JSON.parse(execFileSync('bash', [join(SKILL, 'scripts/finalize'), '--result', join(tmp, 'a.result.json'), '--out', join(tmp, 'a.md'), '--json-out', join(tmp, 'a.enriched.json'), '--date', '2026-10-01'], { encoding: 'utf8' }))
assert.equal(fin.findings, 3)
assert.equal(fin.unverified, 1, 'phantom quote is unverified')
assert.equal(fin.verified, 2, 'exact and whitespace-normalized quotes verify')
assert.equal(fin.systemic, 1, 'pattern keeps its two verified ids and drops the out-of-range one')
const md = readFileSync(join(tmp, 'a.md'), 'utf8')
for (const h of ['## Readers', '## Top', '## Conflicts to decide', '## Unverified quotes (1)', '## Coverage', 'Scouts disagree on the action'])
  assert.ok(md.includes(h), `report has ${h}`)
assert.match(md, /X01 Pressure and absolute language without a reason \(\[Claude best practices/, 'guide refs link to digest sources')
const enriched = JSON.parse(readFileSync(join(tmp, 'a.enriched.json'), 'utf8'))
const ask = enriched.findings.find(f => f.pattern === 'ask-first')
assert.equal(ask.primary.check, 'normalized')
assert.equal(ask.primary.lineStart, 3)
const top = enriched.top[0]
assert.equal(byScore(enriched.findings)[0].id, top.ids[0], 'top action is the highest-scoring finding')
function byScore(fs) { return [...fs].filter(f => f.verified).sort((a, b) => b.score - a.score) }

// ---------- case B: dedupe dead twice, single model (no map agent), claude-only lanes
const dirB = join(tmp, 'b')
prepare(dirB, ['--model', 'sonnet'])
const B = await runEngine(join(dirB, 'run.js'), (prompt, opts) => {
  if (opts.phase === 'Scout') return { findings: [{ file: 'SKILL.md', lineStart: 1, quote: '---', pattern: 'p', targetModel: 'claude-sonnet', whyHarmful: 'x', guideRefs: [], action: 'flag', recommendedAction: 'a', confidence: 'low' }], cleanNotes: '' }
  if (opts.label.startsWith('dedupe')) return null
  if (opts.label.startsWith('rate')) return { ratings: [] }
  if (opts.label === 'systemic') return null
  throw new Error('unexpected agent ' + opts.label)
})
assert.equal(B.calls.filter(c => c.opts.label.startsWith('map')).length, 0, 'single model skips map')
assert.equal(B.calls.filter(c => c.opts.phase === 'Scout').length, 10, 'openai-only lane skipped for a claude reader')
assert.equal(B.calls.filter(c => c.opts.label.startsWith('dedupe')).length, 2, 'dead dedupe retried once')
assert.deepEqual(B.result.coverage.dedupeDead, ['demo-skill'])
assert.equal(B.result.findings.length, 10, 'raw findings kept when dedupe dies')
assert.equal(B.result.coverage.systemicDead, true)

// ---------- case C: dryRun stubs, openai-only reader
const dirC = join(tmp, 'c')
prepare(dirC, ['--model', 'gpt-6-luna', '--dry-run'])
const C = await runEngine(join(dirC, 'run.js'), (prompt, opts) => {
  assert.equal(opts.model, 'haiku'); assert.equal(opts.effort, 'low')
  assert.ok(prompt.startsWith('You are a stub. Call no tools. Return exactly this JSON as your structured output: '), 'dryRun dispatches the exact stub wording')
  return JSON.parse(prompt.slice(prompt.indexOf('structured output: ') + 'structured output: '.length))
})
assert.equal(C.calls.filter(c => c.opts.phase === 'Scout').length, 10, 'claude-only lane skipped for an openai reader')
assert.equal(C.result.coverage.raw, 20)
assert.equal(C.result.coverage.deduped, 19, 'stub groups [0,1] and [2], 17 orphans kept')
assert.equal(C.result.coverage.orphans, 17)
assert.equal(C.result.findings[0].targetModel, 'gpt-6-luna')
assert.deepEqual(C.result.coverage.stubDeviations, [], 'every stub answered with its canned JSON')

// ---------- case D: a stub that goes off-script is caught
const D = await runEngine(join(dirC, 'run.js'), (prompt, opts) => {
  const canned = JSON.parse(prompt.slice(prompt.indexOf('structured output: ') + 'structured output: '.length))
  if (opts.label === 'systemic') return { patterns: [], conflicts: [] }
  return canned
})
assert.deepEqual(D.result.coverage.stubDeviations, ['systemic'])
writeFileSync(join(tmp, 'd.result.json'), JSON.stringify(D.result))
const finD = JSON.parse(execFileSync('bash', [join(SKILL, 'scripts/finalize'), '--result', join(tmp, 'd.result.json'), '--out', join(tmp, 'd.md')], { encoding: 'utf8' }))
assert.ok(finD.gaps.some(g => g.startsWith('DRY RUN FAILED')), 'finalize surfaces stub deviations')

console.log(`mock-engine: all assertions passed (tmp ${tmp})`)
