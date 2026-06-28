import { createClient } from '@sanity/client'

/**
 * Sanity-Client fuer Lese-Zugriff auf das jensgildehaus.de-Lauf-Tagebuch.
 *
 * Bewusst als Code-Konstante (Jens-Entscheidung 2026-06-25), nicht als
 * Env-Var: das Public-Dataset ist anonym lesbar, kein Token-Setup
 * noetig. Wenn die Werte je wechseln (z.B. neue Domain, neuer Sanity-
 * Account), Aenderung hier im Code.
 *
 * Genutzt von Grinshaws Coach-Logik:
 *   - get_recent_runs(limit)
 *   - get_run_by_date(date)
 *   - get_cp_at_date(date)
 *   - analyze_latest_run() / analyze_run_by_date(date)
 *   - get_weekly_summary(weeks)
 */

const PROJECT_ID = '8wwrj8n8'
const DATASET = 'production'
const API_VERSION = '2026-03-12'

export const sanityClient = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  useCdn: true, // Public Read, CDN ist schnell genug + aktuell genug fuer Coach-Analyse
})

/**
 * Schmaler Lauf-Post-Datensatz fuer Coach-Analyse. Enthaelt nur die
 * Felder die fuer Power-, Pace- und HR-Bewertung gebraucht werden.
 * Bewusst keine images/body -- spart Bandbreite + Tokens.
 */
export interface RunData {
  _id: string
  title: string
  slug: string
  date: string                      // YYYY-MM-DD
  runType: 'wettkampf' | 'ruhig' | 'tempo' | 'intervall'
  distanceCategory:
    | '1km'
    | '1mi'
    | '5k'
    | '10k'
    | 'hm'
    | 'marathon'
    | 'sonstiges'
  distance: number | null           // km
  officialDistance: number | null   // km, nur bei Wettkampf
  timeDisplay: string                // 'HH:MM:SS' oder 'MM:SS'
  avgHR: number | null              // bpm
  maxHR: number | null              // bpm
  avgPower: number | null           // W
  maxPower: number | null           // W
  eventName: string | null
  teaser: string | null
}

/**
 * GROQ-Query: Felder die Coach-Analyse braucht. Genutzt als Fragment
 * in den Lookups unten.
 */
const RUN_FIELDS = /* groq */ `
  _id,
  title,
  "slug": slug.current,
  date,
  runType,
  distanceCategory,
  distance,
  officialDistance,
  timeDisplay,
  avgHR,
  maxHR,
  avgPower,
  maxPower,
  eventName,
  teaser
`

/**
 * Holt die juengsten N Lauf-Posts. Sortiert nach Datum absteigend.
 * Default 10 -- reicht fuer Wochen-Trend + Vergleichs-Kontext.
 */
export async function getRecentRuns(limit = 10): Promise<RunData[]> {
  return sanityClient.fetch<RunData[]>(
    /* groq */ `
      *[_type == "runPost" && defined(date) && defined(distance)]
        | order(date desc)[0...$limit] {
        ${RUN_FIELDS}
      }
    `,
    { limit },
  )
}

/**
 * Holt einen bestimmten Lauf-Post per Datum (YYYY-MM-DD).
 * Falls mehrere am gleichen Tag: der zuerst gefundene.
 */
export async function getRunByDate(date: string): Promise<RunData | null> {
  return sanityClient.fetch<RunData | null>(
    /* groq */ `
      *[_type == "runPost" && date == $date][0] {
        ${RUN_FIELDS}
      }
    `,
    { date },
  )
}

/**
 * Holt den juengsten Lauf-Post -- haeufigster Coach-Use-Case
 * ("Wie war der heutige / mein letzter Lauf?").
 */
export async function getLatestRun(): Promise<RunData | null> {
  return sanityClient.fetch<RunData | null>(
    /* groq */ `
      *[_type == "runPost" && defined(date) && defined(distance)]
        | order(date desc)[0] {
        ${RUN_FIELDS}
      }
    `,
  )
}

/**
 * Holt alle Lauf-Posts ab einem Startdatum (inklusiv). Sortiert
 * aufsteigend. Genutzt fuer Wochen-/Monats-Aggregate.
 */
export async function getRunsSince(date: string): Promise<RunData[]> {
  return sanityClient.fetch<RunData[]>(
    /* groq */ `
      *[_type == "runPost" && date >= $date && defined(distance)]
        | order(date asc) {
        ${RUN_FIELDS}
      }
    `,
    { date },
  )
}

/**
 * Critical Power Verlauf — holt den juengsten Eintrag mit
 * validFrom <= dem gefragten Datum. Heisst: historisch korrekt --
 * ein Lauf vom 15.03.2026 bekommt den damaligen CP, nicht den aktuellen.
 *
 * Returns null wenn fuer das Datum noch kein cpHistory-Eintrag existiert
 * (z.B. fuer alte Posts vor dem ersten CP-Test).
 */
export interface CpRecord {
  cpValue: number
  validFrom: string
  weight?: number
  note?: string
}

export async function getCpAtDate(date: string): Promise<CpRecord | null> {
  return sanityClient.fetch<CpRecord | null>(
    /* groq */ `
      *[_type == "cpHistory" && validFrom <= $date]
        | order(validFrom desc)[0] {
        cpValue,
        validFrom,
        weight,
        note
      }
    `,
    { date },
  )
}

/**
 * Aktueller (juengster) CP-Eintrag. Genutzt fuer Default-Kontext im
 * System-Prompt -- Grinshaw kennt damit immer Jens-aktuellen CP.
 */
export async function getCurrentCp(): Promise<CpRecord | null> {
  return sanityClient.fetch<CpRecord | null>(
    /* groq */ `
      *[_type == "cpHistory"] | order(validFrom desc)[0] {
        cpValue,
        validFrom,
        weight,
        note
      }
    `,
  )
}
