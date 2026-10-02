// finalize.mjs — turn the roast engine's result into the report. Everything here is deterministic:
// quote verification against the files, scoring, ranking, top-N selection and markdown rendering.
// Invoked through ./finalize (bash wrapper). Exit codes: 0 ok, 2 bad input.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SKILL = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const USAGE = `usage: finalize --result <file> --out <report.md> [--json-out <file>] [--top <n>] [--date YYYY-MM-DD]

  --result     the workflow's output: the task output file named in the completion notification,
               a run record (*.json with a "result" key), or the bare result object
  --out        where to write the markdown report
  --json-out   also write the enriched findings (scores, quote checks) as JSON
  --top        number of top actions (default: the run's config, else 10)
  --date       report date (default: today)`
const die = (code, msg) => { process.stderr.write(`finalize: ${msg}\n`); process.exit(code) }

const opt = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--help' || a === '-h') { console.log(USAGE); process.exit(0) }
  if (!a.startsWith('--') || i + 1 >= argv.length) die(2, `bad argument '${a}'\n${USAGE}`)
  opt[a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i]
}
if (!opt.result || !opt.out) die(2, USAGE)
if (!existsSync(opt.result)) die(2, `result file not found: ${opt.result}`)

// ---- load
let raw = readFileSync(opt.result, 'utf8')
const brace = raw.indexOf('{')
if (brace > 0) raw = raw.slice(brace)
let doc
try { doc = JSON.parse(raw) } catch (e) { die(2, `result is not JSON: ${e.message}`) }
const R = doc?.engine === 'prompting-guide-roast' ? doc : doc?.result?.engine === 'prompting-guide-roast' ? doc.result : null
if (!R) die(2, 'no prompting-guide-roast result found (expected a top-level or "result" object with engine: "prompting-guide-roast")')
const topN = Number(opt.top ?? R.config?.topN ?? 10)
const date = opt.date ?? new Date().toISOString().slice(0, 10)

// ---- digest: id -> { title, url }
const digest = {}
const digestText = existsSync(join(SKILL, 'reference/guide-digest.md')) ? readFileSync(join(SKILL, 'reference/guide-digest.md'), 'utf8') : ''
for (const block of digestText.split(/^### /m).slice(1)) {
  const id = block.match(/^([XCO]\d{2})\s+(.*)$/m)
  if (!id) continue
  const line = block.match(/\*\*Sources:\*\*([^\n]*)/)?.[1] ?? ''
  const sources = [...line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map(m => ({ text: m[1], url: m[2] }))
  digest[id[1]] = { title: id[2].trim(), sources }
}

// ---- quote verification
const unitDir = Object.fromEntries((R.units ?? []).map(u => [u.unit, u.dir]))
const fileCache = {}
const readLines = p => (fileCache[p] ??= existsSync(p) ? readFileSync(p, 'utf8') : null)
const norm = s => String(s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()
function checkLocation(unit, loc) {
  const dir = unitDir[unit]
  const path = dir ? join(dir, loc.file ?? '') : null
  const text = path ? readLines(path) : null
  if (text === null) return { ...loc, check: 'no-file' }
  const q = String(loc.quote ?? '')
  if (!q.trim()) return { ...loc, check: 'missing' }
  let idx = text.indexOf(q), check = 'exact'
  if (idx < 0) {
    // Whitespace- and quote-normalized match; map back to a line via the first 40 normalized chars.
    const nq = norm(q)
    if (!norm(text).includes(nq)) return { ...loc, check: 'missing' }
    check = 'normalized'
    const lines = text.split('\n')
    const head = nq.slice(0, 40)
    // The last window that still contains the quote's head starts on the quote's first line.
    const hit = lines.findLastIndex((_, i) => norm(lines.slice(i, i + 8).join(' ')).includes(head))
    return { ...loc, check, lineStart: hit >= 0 ? hit + 1 : loc.lineStart }
  }
  const line = text.slice(0, idx).split('\n').length
  const span = q.split('\n').length - 1
  return { ...loc, check, lineStart: line, lineEnd: line + span, lineMoved: line !== loc.lineStart }
}

// ---- scoring (one place for the ranking math)
const IMPACT = { high: 3, medium: 2, low: 1 }
const EXPOSURE = { hot: 1.5, warm: 1, cold: 0.5 }
const CONF = { high: 1, medium: 0.8, low: 0.5 }
const round = x => Math.round(x * 100) / 100
const severityOf = s => (s >= 3 ? 'high' : s >= 1.5 ? 'medium' : 'low')
const findings = (R.findings ?? []).map(f => {
  const locations = (f.locations?.length ? f.locations : [{ file: f.file, lineStart: f.lineStart, lineEnd: f.lineEnd, quote: f.quote }]).map(l => checkLocation(f.unit, l))
  const verified = locations.some(l => l.check === 'exact' || l.check === 'normalized')
  const r = R.ratings?.[f.id] ?? R.ratings?.[String(f.id)]
  const impact = r?.impact ?? 'medium', exposure = r?.exposure ?? 'warm'
  const lanesBonus = Math.min(1.3, 1 + 0.1 * Math.max(0, (f.lanes?.length ?? 1) - 1))
  const score = round(IMPACT[impact] * EXPOSURE[exposure] * (CONF[f.confidence] ?? 0.8) * lanesBonus)
  const primary = locations.find(l => l.check === 'exact' || l.check === 'normalized') ?? locations[0]
  return { ...f, locations, primary, verified, impact, exposure, rated: !!r, rateRationale: r?.rationale ?? '', score, severity: severityOf(score) }
})
const byId = Object.fromEntries(findings.map(f => [f.id, f]))
const live = findings.filter(f => f.verified).sort((a, b) => b.score - a.score || a.id - b.id)
const unverified = findings.filter(f => !f.verified)

// Systemic patterns: keep valid ids of verified findings; a pattern needs two. Score = strongest
// member + half the rest, so breadth counts without letting many low findings swamp one high one.
const systemic = (R.systemic?.patterns ?? []).map(p => {
  const ids = [...new Set(p.findingIds ?? [])].filter(i => byId[i]?.verified)
  const scores = ids.map(i => byId[i].score).sort((a, b) => b - a)
  const score = scores.length ? round(scores[0] + 0.5 * scores.slice(1).reduce((s, x) => s + x, 0)) : 0
  return { ...p, ids, dropped: (p.findingIds ?? []).length - ids.length, score }
}).filter(p => p.ids.length >= 2).sort((a, b) => b.score - a.score)
const inSystemic = new Set(systemic.flatMap(p => p.ids))
const conflicts = (R.systemic?.conflicts ?? []).map(c => ({ ...c, ids: [...new Set(c.findingIds ?? [])].filter(i => byId[i]) })).filter(c => c.ids.length)

// Top actions: systemic patterns and stand-alone high/medium findings, by score.
const candidates = [
  ...systemic.map(p => ({ kind: 'systemic', score: p.score, title: p.pattern, action: p.recommendedFix, ids: p.ids, refs: p.guideRefs ?? [] })),
  ...live.filter(f => !inSystemic.has(f.id) && f.severity !== 'low').map(f => ({ kind: 'finding', score: f.score, title: f.pattern, action: f.recommendedAction, ids: [f.id], refs: f.guideRefs ?? [] })),
].sort((a, b) => b.score - a.score)
const top = candidates.slice(0, topN)

// ---- render
const tag = f => `F${f.id}`
const loc = f => `\`${f.primary.file}:${f.primary.lineStart}${f.primary.lineEnd && f.primary.lineEnd !== f.primary.lineStart ? '-' + f.primary.lineEnd : ''}\``
// Cite the source that matches the reader's vendor when the entry has one, else the entry's first.
const VENDOR = { claude: /anthropic\.com|claude\.com/, openai: /openai\.com|chatgpt\.com|github\.com\/openai/ }
const refLinks = (refs, models = []) => (refs ?? []).map(r => {
  const d = digest[r]
  const fams = models.map(m => R.catalog?.[m]?.family).filter(Boolean)
  const src = d?.sources?.find(x => fams.some(f => VENDOR[f]?.test(x.url))) ?? d?.sources?.[0]
  if (src) return `${r} ${d.title} ([${src.text}](${src.url}))`
  if (d) return `${r} ${d.title}`
  return r
}).join('; ') || '—'
const quoteBlock = q => String(q ?? '').split('\n').slice(0, 8).map(l => `> ${l}`).join('\n')
const fence = s => { const t = String(s); const n = Math.max(3, ...(t.match(/`+/g) ?? []).map(x => x.length + 1)); return '`'.repeat(n) + '\n' + t + '\n' + '`'.repeat(n) }
const cell = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const modelLabel = m => R.catalog?.[m]?.label ?? m
const count = sev => live.filter(f => f.severity === sev).length
const cov = R.coverage ?? {}

const out = []
out.push(`# Prompting-guide roast: ${R.label || R.target}`, '')
out.push(`${date} · target \`${R.target}\`${R.dryRun ? ' · **DRY RUN (stub agents; findings are canned)**' : ''}`, '')
out.push(`${cov.scouts ?? 0} scouts over ${cov.units ?? 0} unit(s) · ${cov.raw ?? 0} raw findings → ${findings.length} after dedupe · ${live.length} with verified quotes (${count('high')} high, ${count('medium')} medium, ${count('low')} low) · ${systemic.length} systemic patterns · ${conflicts.length} conflicts`, '')
const gaps = []
if (cov.deadScouts?.length) gaps.push(`${cov.deadScouts.length} scout(s) returned nothing: ${cov.deadScouts.join(', ')}`)
if (cov.dedupeDead?.length) gaps.push(`dedupe failed for ${cov.dedupeDead.join(', ')} (findings kept undeduplicated)`)
if (cov.mapDead?.length) gaps.push(`reader mapping failed for ${cov.mapDead.join(', ')} (files judged against the default model)`)
if (cov.unrated?.length) gaps.push(`${cov.unrated.length} finding(s) unrated (scored as medium impact, warm exposure)`)
if (cov.systemicDead) gaps.push('the systemic-pattern agent returned nothing')
if (cov.stubDeviations?.length) gaps.push(`DRY RUN FAILED: ${cov.stubDeviations.length} stub agent(s) did not return their canned JSON (${cov.stubDeviations.join(', ')}); check the run for side effects`)
if (unverified.length) gaps.push(`${unverified.length} finding(s) quote text not found in the file (listed at the end, not ranked)`)
if (gaps.length) out.push('**Coverage gaps:** ' + gaps.join('; ') + '.', '')

out.push('## Readers', '', '| Unit | File | Lines | Read by | Model |', '|---|---|---|---|---|')
for (const u of R.units ?? []) for (const f of u.files ?? []) out.push(`| ${cell(u.unit)} | \`${cell(f.rel)}\` | ${f.lines ?? ''} | ${cell(f.role)}${f.basis ? ` — ${cell(f.basis)}` : ''} | ${cell(modelLabel(f.model))} |`)
out.push('')

out.push(`## Top ${top.length} actions`, '')
if (!top.length) out.push('No high- or medium-severity findings.', '')
top.forEach((t, i) => {
  const files = [...new Set(t.ids.map(id => byId[id].primary.file))]
  out.push(`${i + 1}. **${t.title}** (${t.kind === 'systemic' ? `systemic, ${t.ids.length} findings` : byId[t.ids[0]].severity}; score ${t.score}) — ${t.action}`)
  out.push(`   Files: ${files.map(f => `\`${f}\``).join(', ')}. Findings: ${t.ids.map(id => tag(byId[id])).join(', ')}. Guide: ${refLinks(t.refs, t.ids.map(id => byId[id].targetModel))}.`)
})
out.push('')

if (systemic.length) {
  out.push('## Systemic patterns', '')
  for (const p of systemic) {
    out.push(`### ${p.pattern} (score ${p.score})`, '', p.summary, '')
    out.push(`- **Fix once:** ${p.recommendedFix}`)
    out.push(`- **Readers:** ${(p.targetModels ?? []).join(', ') || '—'}`)
    out.push(`- **Findings:** ${p.ids.map(i => `${tag(byId[i])} (${byId[i].primary.file}:${byId[i].primary.lineStart})`).join(', ')}`)
    out.push(`- **Guide:** ${refLinks(p.guideRefs, p.ids.map(i => byId[i].targetModel))}`, '')
  }
}

if (conflicts.length) {
  out.push('## Conflicts to decide', '')
  for (const c of conflicts) out.push(`- ${c.summary} (${c.ids.map(i => tag(byId[i])).join(', ')})`)
  out.push('')
}

const detail = f => {
  out.push(`### ${tag(f)} · ${f.severity} · ${f.pattern} — ${loc(f)}`, '')
  out.push(`Reader: ${modelLabel(f.targetModel)} · impact ${f.impact}, exposure ${f.exposure}, confidence ${f.confidence} · score ${f.score} · lanes: ${(f.lanes ?? []).join(', ')}${f.primary.check === 'normalized' ? ' · quote matched after whitespace normalization' : ''}`, '')
  out.push(quoteBlock(f.primary.quote), '')
  const others = [...new Map(f.locations.filter(l => l.file !== f.primary.file || l.lineStart !== f.primary.lineStart)
    .map(l => [`${l.file}:${l.lineStart}`, l])).values()]
  if (others.length) out.push(`Also at: ${others.map(l => `\`${l.file}:${l.lineStart}\`${l.check === 'missing' ? ' (quote not found)' : ''}`).join(', ')}`, '')
  out.push(`- **Why:** ${f.whyHarmful}`)
  out.push(`- **Action (${f.action}):** ${f.recommendedAction}`)
  if (f.alternativeActions?.length) out.push(`- **Other scouts proposed:** ${f.alternativeActions.join(' / ')}`)
  if (f.actionConflict) out.push(`- **Scouts disagree on the action** (${f.actionConflict.join(' vs ')}); decide before editing.`)
  out.push(`- **Guide:** ${refLinks(f.guideRefs, [f.targetModel])}${f.guidePassage ? ` — “${f.guidePassage}”` : ''}`)
  if (f.rateRationale) out.push(`- **Rating:** ${f.rateRationale}`)
  if (f.suggestedRewrite) out.push('', `Suggested ${f.action === 'move' ? 'destination' : 'text'}:`, '', fence(f.suggestedRewrite))
  out.push('')
}
for (const sev of ['high', 'medium']) {
  const list = live.filter(f => f.severity === sev)
  if (!list.length) continue
  out.push(`## ${sev[0].toUpperCase() + sev.slice(1)}-severity findings (${list.length})`, '')
  list.forEach(detail)
}
const low = live.filter(f => f.severity === 'low')
if (low.length) {
  out.push(`## Low-severity findings (${low.length})`, '', '| ID | Location | Pattern | Reader | Action |', '|---|---|---|---|---|')
  for (const f of low) out.push(`| ${tag(f)} | ${loc(f)} | ${cell(f.pattern)} | ${cell(f.targetModel)} | ${cell(f.recommendedAction)} |`)
  out.push('')
}
if (unverified.length) {
  out.push(`## Unverified quotes (${unverified.length})`, '', 'The quoted text was not found in the file, so these are not ranked. Check them by hand or discard them.', '')
  out.push('| ID | Claimed location | Pattern | Action |', '|---|---|---|---|')
  for (const f of unverified) out.push(`| ${tag(f)} | \`${cell(f.primary.file)}:${f.primary.lineStart}\` (${f.primary.check}) | ${cell(f.pattern)} | ${cell(f.recommendedAction)} |`)
  out.push('')
}
out.push('## Coverage', '')
out.push(`Scoring: impact (high 3, medium 2, low 1) × exposure (hot 1.5, warm 1, cold 0.5) × confidence (high 1, medium 0.8, low 0.5) × lanes bonus (+10% per extra lane, max +30%). Severity: high ≥ 3, medium ≥ 1.5.`, '')
for (const u of R.units ?? []) {
  const c = u.coverage ?? {}
  out.push(`- **${u.unit}:** ${c.scouts} scouts (${c.deadScouts?.length ?? 0} dead), ${c.raw} raw → ${c.deduped} deduped${c.orphans ? `, ${c.orphans} left ungrouped by dedupe` : ''}.`)
  for (const cl of u.clean ?? []) if (cl.n === 0 && cl.cleanNotes) out.push(`  - clean · ${cl.lane} @ ${cl.group}: ${cell(cl.cleanNotes)}`)
}
out.push('')

writeFileSync(resolve(opt.out), out.join('\n'))
if (opt.jsonOut) writeFileSync(resolve(opt.jsonOut), JSON.stringify({ label: R.label, target: R.target, date, dryRun: R.dryRun, coverage: cov, top, systemic, conflicts, findings: [...live, ...unverified] }, null, 1))
console.log(JSON.stringify({
  report: resolve(opt.out), findings: findings.length, verified: live.length, unverified: unverified.length,
  severity: { high: count('high'), medium: count('medium'), low: count('low') }, systemic: systemic.length, conflicts: conflicts.length, top: top.length,
  gaps,
}, null, 1))
