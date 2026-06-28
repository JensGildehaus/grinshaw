// Generator: erzeugt aus den lib/coach-knowledge/*.md-Dateien ein
// kombiniertes SQL-File mit CREATE TABLE + INSERTs.
//
// Aufruf:   node tools/build-coach-knowledge-sql.mjs
// Output:   lib/migration-phase4-coach-full.sql

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const MD_DIR = path.join(ROOT, 'lib', 'coach-knowledge')
const OUTPUT = path.join(ROOT, 'lib', 'migration-phase4-coach-full.sql')

const SCHEMA_SQL = fs.readFileSync(
  path.join(ROOT, 'lib', 'migration-phase4-coach.sql'),
  'utf8',
)

// Alle MDs außer README einlesen
const files = fs
  .readdirSync(MD_DIR)
  .filter((f) => f.endsWith('.md') && f !== 'README.md')
  .sort()

const tagsByTopic = {
  stryd_zones: ['power', 'zones'],
  cardiac_drift: ['hr', 'physiology'],
  polarized_80_20: ['methodology', 'volume'],
  hr_power_decoupling: ['hr', 'power', 'efficiency'],
  recovery_indicators: ['recovery', 'overtraining'],
  pacing_discipline: ['pace', 'discipline'],
}

const inserts = []
for (const file of files) {
  const topic = file.replace(/\.md$/, '')
  const raw = fs.readFileSync(path.join(MD_DIR, file), 'utf8').trim()

  // Erste Zeile als Titel (ohne fuehrendes '# ')
  const lines = raw.split('\n')
  const titleLine = lines.find((l) => l.startsWith('# '))
  if (!titleLine) {
    console.error(`Warnung: ${file} hat keinen # Titel`)
    continue
  }
  const title = titleLine.slice(2).trim()
  // Content ist alles ab Titel-Zeile (Titel selbst inklusiv -- so kann
  // die DB-Antwort fuer Grinshaw stand-alone formatiert sein)
  const content = raw

  const tags = tagsByTopic[topic] ?? []
  const tagsLiteral =
    tags.length === 0
      ? `'{}'`
      : `ARRAY[${tags.map((t) => `'${t}'`).join(', ')}]`

  // Dollar-quoted-Strings: kein Escaping noetig.
  // Eindeutiger Tag pro Eintrag, damit ein interner $$ im Content nicht
  // den Block beendet.
  const tag = `ck_${topic}`
  inserts.push(
    `insert into coach_knowledge (topic, title, content_md, tags) values\n` +
      `  ('${topic}', $${tag}$${title}$${tag}$, $${tag}$${content}$${tag}$, ${tagsLiteral})\n` +
      `on conflict (topic) do update set\n` +
      `  title = excluded.title,\n` +
      `  content_md = excluded.content_md,\n` +
      `  tags = excluded.tags;`,
  )
}

const output = `-- ============================================================================
-- Grinshaw Phase 4 Coach: All-in-One Migration
--
-- Diese Datei vereint:
--   1. CREATE TABLE coach_knowledge + Trigger (aus migration-phase4-coach.sql)
--   2. Initial-Befuellung mit 6 Wissens-Eintraegen (Markdown-Quellen unter
--      lib/coach-knowledge/)
--
-- Im Supabase-Dashboard ausfuehren: SQL Editor -> Inhalt einfuegen -> Run.
-- Idempotent: re-runs aktualisieren bestehende Eintraege (on conflict).
--
-- Generiert von tools/build-coach-knowledge-sql.mjs -- nicht manuell editieren.
-- Aenderungen erfolgen in den .md-Dateien, dann Script neu laufen lassen.
-- ============================================================================

${SCHEMA_SQL}

-- ============================================================================
-- Initial-Befuellung: 6 Wissens-Eintraege
-- ============================================================================

${inserts.join('\n\n')}
`

fs.writeFileSync(OUTPUT, output, 'utf8')
console.log(`Geschrieben: ${OUTPUT}`)
console.log(`Eintraege: ${files.length}`)
