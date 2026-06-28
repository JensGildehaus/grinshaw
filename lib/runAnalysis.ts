import type { RunData, CpRecord } from './sanity'

/**
 * Run-Analyse-Lib: Server-side Berechnungen fuer Grinshaws Coach-Rolle.
 *
 * Alle Funktionen sind reine Datentransformer ohne IO -- Input sind die
 * Sanity-Daten (siehe lib/sanity.ts), Output sind strukturierte Metriken
 * im typsicheren AnalysisReport-Format.
 *
 * Grinshaw selbst formuliert das Ergebnis dann in seinem
 * 1880-1910er-Vokabular. Die Lib liefert die Fakten, nicht den Ton.
 */

// =========================================================================
// Stryd-Power-Zonen
// =========================================================================

export type StrydZone = 1 | 2 | 3 | 4 | 5

export interface StrydZoneInfo {
  zone: StrydZone
  name: string
  cpPercentMin: number  // inklusiv
  cpPercentMax: number  // exklusiv (115%+ als Z5 ist unten gecappt)
}

export const STRYD_ZONES: ReadonlyArray<StrydZoneInfo> = [
  { zone: 1, name: 'Leicht',        cpPercentMin: 0,   cpPercentMax: 80  },
  { zone: 2, name: 'Moderat',       cpPercentMin: 80,  cpPercentMax: 90  },
  { zone: 3, name: 'Schwelle',      cpPercentMin: 90,  cpPercentMax: 100 },
  { zone: 4, name: 'Intervall',     cpPercentMin: 100, cpPercentMax: 115 },
  { zone: 5, name: 'Wiederholung',  cpPercentMin: 115, cpPercentMax: 999 },
]

/**
 * Klassifiziert eine Power-Auslastung in % CP in die Stryd-Zone.
 */
export function classifyZone(cpPercent: number): StrydZoneInfo {
  for (const z of STRYD_ZONES) {
    if (cpPercent >= z.cpPercentMin && cpPercent < z.cpPercentMax) {
      return z
    }
  }
  return STRYD_ZONES[STRYD_ZONES.length - 1] // 115%+
}

// =========================================================================
// Time + Pace
// =========================================================================

/**
 * Parsed timeDisplay-String ("HH:MM:SS" oder "MM:SS") in Sekunden.
 * Returns null bei Parse-Fehler.
 */
export function parseTimeToSeconds(timeDisplay: string): number | null {
  const parts = timeDisplay.split(':').map((p) => parseInt(p, 10))
  if (parts.some(isNaN)) return null
  if (parts.length === 3) {
    const [h, m, s] = parts
    return h * 3600 + m * 60 + s
  }
  if (parts.length === 2) {
    const [m, s] = parts
    return m * 60 + s
  }
  return null
}

/**
 * Berechnet Pace in Sekunden pro Kilometer.
 */
export function calculatePaceSeconds(
  distanceKm: number,
  timeSeconds: number,
): number {
  if (distanceKm <= 0) return 0
  return timeSeconds / distanceKm
}

/**
 * Formatiert Pace-Sekunden als "M:SS/km"-String.
 */
export function formatPace(paceSeconds: number): string {
  const m = Math.floor(paceSeconds / 60)
  const s = Math.round(paceSeconds % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

// =========================================================================
// Power-Metriken
// =========================================================================

export interface PowerMetrics {
  cpPercent: number | null      // % von CP
  zone: StrydZoneInfo | null
  variability: number | null    // maxPower / avgPower
  variabilityLabel: string      // "gleichmaessig" / "leicht variabel" / "stark variabel"
}

export function calculatePowerMetrics(
  run: RunData,
  cp: number | null,
): PowerMetrics {
  if (run.avgPower == null || run.avgPower <= 0) {
    return {
      cpPercent: null,
      zone: null,
      variability: null,
      variabilityLabel: 'keine Power-Daten',
    }
  }

  let cpPercent: number | null = null
  let zone: StrydZoneInfo | null = null
  if (cp && cp > 0) {
    cpPercent = (run.avgPower / cp) * 100
    zone = classifyZone(cpPercent)
  }

  let variability: number | null = null
  let variabilityLabel = 'keine Variability-Daten'
  if (run.maxPower != null && run.maxPower > 0) {
    variability = run.maxPower / run.avgPower
    if (variability < 1.2) variabilityLabel = 'gleichmaessig'
    else if (variability < 1.5) variabilityLabel = 'leicht variabel'
    else variabilityLabel = 'stark variabel'
  }

  return { cpPercent, zone, variability, variabilityLabel }
}

// =========================================================================
// HR-Power-Decoupling-Verhaeltnis
// =========================================================================

/**
 * HR-pro-Watt-Verhaeltnis: niedrigerer Wert = effizienter.
 * Returns null wenn HR oder Power fehlen.
 */
export function calculateHrPowerRatio(run: RunData): number | null {
  if (
    run.avgHR == null || run.avgHR <= 0 ||
    run.avgPower == null || run.avgPower <= 0
  ) {
    return null
  }
  return run.avgHR / run.avgPower
}

// =========================================================================
// Vergleich zur Historie
// =========================================================================

export interface HistoryComparison {
  runsCompared: number
  avgPaceWeekSeconds: number | null
  avgPowerWeek: number | null
  avgHrWeek: number | null
  avgHrPowerRatio: number | null
  paceDeltaPercent: number | null     // negativ = heutiger Lauf war schneller
  powerDeltaPercent: number | null    // positiv = mehr Leistung als Schnitt
  hrPowerRatioDelta: number | null    // positiv = ineffizienter geworden
}

/**
 * Vergleicht den aktuellen Lauf mit anderen Laeufen aehnlicher
 * Distanz-Kategorie aus den letzten ~30 Tagen.
 */
export function compareToHistory(
  current: RunData,
  recentRuns: ReadonlyArray<RunData>,
): HistoryComparison {
  // Aehnliche Laeufe filtern: gleiche Distanz-Kategorie, ohne den aktuellen
  const similar = recentRuns.filter(
    (r) =>
      r._id !== current._id &&
      r.distanceCategory === current.distanceCategory &&
      r.distance != null &&
      r.distance > 0,
  )

  if (similar.length === 0) {
    return {
      runsCompared: 0,
      avgPaceWeekSeconds: null,
      avgPowerWeek: null,
      avgHrWeek: null,
      avgHrPowerRatio: null,
      paceDeltaPercent: null,
      powerDeltaPercent: null,
      hrPowerRatioDelta: null,
    }
  }

  // Wochen-Schnitte berechnen
  const paces: number[] = []
  const powers: number[] = []
  const hrs: number[] = []
  const ratios: number[] = []

  for (const r of similar) {
    const sec = parseTimeToSeconds(r.timeDisplay)
    if (sec != null && r.distance != null && r.distance > 0) {
      paces.push(calculatePaceSeconds(r.distance, sec))
    }
    if (r.avgPower != null && r.avgPower > 0) powers.push(r.avgPower)
    if (r.avgHR != null && r.avgHR > 0) hrs.push(r.avgHR)
    const ratio = calculateHrPowerRatio(r)
    if (ratio != null) ratios.push(ratio)
  }

  const mean = (arr: number[]) =>
    arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length

  const avgPaceWeekSeconds = mean(paces)
  const avgPowerWeek = mean(powers)
  const avgHrWeek = mean(hrs)
  const avgHrPowerRatio = mean(ratios)

  // Delta-Berechnungen fuer den aktuellen Lauf
  const currentSec = parseTimeToSeconds(current.timeDisplay)
  const currentPace =
    currentSec != null && current.distance != null && current.distance > 0
      ? calculatePaceSeconds(current.distance, currentSec)
      : null
  const currentRatio = calculateHrPowerRatio(current)

  const paceDeltaPercent =
    currentPace != null && avgPaceWeekSeconds != null && avgPaceWeekSeconds > 0
      ? ((currentPace - avgPaceWeekSeconds) / avgPaceWeekSeconds) * 100
      : null

  const powerDeltaPercent =
    current.avgPower != null && avgPowerWeek != null && avgPowerWeek > 0
      ? ((current.avgPower - avgPowerWeek) / avgPowerWeek) * 100
      : null

  const hrPowerRatioDelta =
    currentRatio != null && avgHrPowerRatio != null
      ? currentRatio - avgHrPowerRatio
      : null

  return {
    runsCompared: similar.length,
    avgPaceWeekSeconds,
    avgPowerWeek,
    avgHrWeek,
    avgHrPowerRatio,
    paceDeltaPercent,
    powerDeltaPercent,
    hrPowerRatioDelta,
  }
}

// =========================================================================
// "Zu schnell"-Heuristik
// =========================================================================

export interface PacingVerdict {
  /** "discipline_kept" | "mild_drift" | "warning" | "clear_overpacing" | "not_applicable" */
  verdict:
    | 'discipline_kept'
    | 'mild_drift'
    | 'warning'
    | 'clear_overpacing'
    | 'not_applicable'
  reason: string
}

/**
 * Beurteilt Pacing-Disziplin fuer ruhig-markierte Laeufe basierend auf
 * Pace-Delta + Power-Auslastung. Wettkaempfe und Tempolaeufe sind
 * "not_applicable" -- dort ist hartes Tempo erwartet.
 */
export function judgePacing(
  run: RunData,
  history: HistoryComparison,
  power: PowerMetrics,
): PacingVerdict {
  if (run.runType !== 'ruhig') {
    return {
      verdict: 'not_applicable',
      reason: `Lauf-Typ "${run.runType}" -- Pacing-Disziplin nicht relevant`,
    }
  }

  // Power-Auslastung dominiert wenn vorhanden -- praeziser als Pace
  if (power.cpPercent != null) {
    if (power.cpPercent >= 90) {
      return {
        verdict: 'clear_overpacing',
        reason: `Power-Auslastung ${power.cpPercent.toFixed(0)}% CP -- Bereich Schwelle, definitiv kein ruhiger Lauf`,
      }
    }
    if (power.cpPercent >= 85) {
      return {
        verdict: 'warning',
        reason: `Power-Auslastung ${power.cpPercent.toFixed(0)}% CP -- oberer Bereich Moderat, fuer ruhig markiert zu hart`,
      }
    }
    if (power.cpPercent >= 80) {
      return {
        verdict: 'mild_drift',
        reason: `Power-Auslastung ${power.cpPercent.toFixed(0)}% CP -- unterer Bereich Moderat statt Leicht`,
      }
    }
    return {
      verdict: 'discipline_kept',
      reason: `Power-Auslastung ${power.cpPercent.toFixed(0)}% CP -- sauber im Bereich Leicht`,
    }
  }

  // Fallback ohne CP: Pace-Delta-Heuristik
  if (history.paceDeltaPercent != null && history.runsCompared >= 2) {
    const delta = history.paceDeltaPercent  // negativ = schneller als Schnitt
    if (delta <= -10) {
      return {
        verdict: 'clear_overpacing',
        reason: `Pace ${Math.abs(delta).toFixed(1)}% schneller als Wochen-Schnitt`,
      }
    }
    if (delta <= -5) {
      return {
        verdict: 'warning',
        reason: `Pace ${Math.abs(delta).toFixed(1)}% schneller als Wochen-Schnitt`,
      }
    }
    if (delta <= -3) {
      return {
        verdict: 'mild_drift',
        reason: `Pace ${Math.abs(delta).toFixed(1)}% schneller als Wochen-Schnitt`,
      }
    }
    return {
      verdict: 'discipline_kept',
      reason: `Pace im Rahmen des Wochen-Schnitts (${delta.toFixed(1)}%)`,
    }
  }

  return {
    verdict: 'not_applicable',
    reason: 'Zu wenig Daten fuer Pacing-Bewertung',
  }
}

// =========================================================================
// Wochen-Volumen + 80/20-Verteilung
// =========================================================================

export interface WeeklySummary {
  weekStart: string                // ISO-Datum (Montag)
  runCount: number
  totalKm: number
  totalTimeSeconds: number
  z1z2Share: number | null         // 0-1, nur wenn Z-Daten verfuegbar
  z3Share: number | null
  z4z5Share: number | null
  polarizationVerdict: string      // "polarisiert" / "pyramidal" / "tempotrap" / "unklar"
}

/**
 * Aggregiert Laeufe nach ISO-Wochen.
 * Wenn cpProvider gegeben: berechnet Zonen-Verteilung pro Woche.
 */
export function buildWeeklySummaries(
  runs: ReadonlyArray<RunData>,
  cpProvider?: (date: string) => number | null,
): WeeklySummary[] {
  // Gruppieren nach Wochen-Start (Montag)
  const byWeek = new Map<string, RunData[]>()
  for (const r of runs) {
    const date = new Date(r.date)
    const day = date.getUTCDay() || 7 // Sonntag = 0 → 7
    const monday = new Date(date)
    monday.setUTCDate(date.getUTCDate() - (day - 1))
    const key = monday.toISOString().slice(0, 10)
    if (!byWeek.has(key)) byWeek.set(key, [])
    byWeek.get(key)!.push(r)
  }

  const summaries: WeeklySummary[] = []
  for (const [weekStart, weekRuns] of byWeek) {
    let totalKm = 0
    let totalTime = 0
    let z1z2Time = 0
    let z3Time = 0
    let z4z5Time = 0
    let zoneTimeKnown = 0

    for (const r of weekRuns) {
      const sec = parseTimeToSeconds(r.timeDisplay) ?? 0
      if (r.distance != null) totalKm += r.distance
      totalTime += sec

      if (cpProvider && sec > 0 && r.avgPower != null && r.avgPower > 0) {
        const cp = cpProvider(r.date)
        if (cp && cp > 0) {
          const cpPercent = (r.avgPower / cp) * 100
          const zone = classifyZone(cpPercent).zone
          if (zone === 1 || zone === 2) z1z2Time += sec
          else if (zone === 3) z3Time += sec
          else z4z5Time += sec
          zoneTimeKnown += sec
        }
      }
    }

    let z1z2Share: number | null = null
    let z3Share: number | null = null
    let z4z5Share: number | null = null
    let polarizationVerdict = 'unklar'

    if (zoneTimeKnown > 0) {
      z1z2Share = z1z2Time / zoneTimeKnown
      z3Share = z3Time / zoneTimeKnown
      z4z5Share = z4z5Time / zoneTimeKnown

      if (z3Share > 0.25) polarizationVerdict = 'tempotrap'
      else if (z1z2Share >= 0.75 && z4z5Share >= 0.1) polarizationVerdict = 'polarisiert'
      else if (z1z2Share >= 0.7 && z3Share >= 0.1) polarizationVerdict = 'pyramidal'
    }

    summaries.push({
      weekStart,
      runCount: weekRuns.length,
      totalKm,
      totalTimeSeconds: totalTime,
      z1z2Share,
      z3Share,
      z4z5Share,
      polarizationVerdict,
    })
  }

  // Neueste Woche zuerst
  summaries.sort((a, b) => b.weekStart.localeCompare(a.weekStart))
  return summaries
}

// =========================================================================
// Komplettanalyse eines Laufs
// =========================================================================

export interface AnalysisReport {
  run: RunData
  cp: CpRecord | null
  paceSecondsPerKm: number | null
  pace: string | null
  power: PowerMetrics
  hrPowerRatio: number | null
  history: HistoryComparison
  pacing: PacingVerdict
  hints: string[]
}

/**
 * Komplette Analyse eines Laufs. Saugt alle Berechnungen oben zusammen
 * und liefert einen strukturierten Report den Grinshaw in seinem
 * Vokabular formulieren kann.
 */
export function analyzeRun(
  run: RunData,
  cp: CpRecord | null,
  recentRuns: ReadonlyArray<RunData>,
): AnalysisReport {
  const timeSec = parseTimeToSeconds(run.timeDisplay)
  const paceSecondsPerKm =
    timeSec != null && run.distance != null && run.distance > 0
      ? calculatePaceSeconds(run.distance, timeSec)
      : null
  const pace = paceSecondsPerKm != null ? formatPace(paceSecondsPerKm) : null

  const power = calculatePowerMetrics(run, cp?.cpValue ?? null)
  const hrPowerRatio = calculateHrPowerRatio(run)
  const history = compareToHistory(run, recentRuns)
  const pacing = judgePacing(run, history, power)

  // Hints sammeln -- konkrete Beobachtungen fuer Grinshaw
  const hints: string[] = []

  if (history.hrPowerRatioDelta != null) {
    if (history.hrPowerRatioDelta > 0.02) {
      hints.push(
        'HR/Power-Verhaeltnis hoeher als im Wochen-Schnitt -- Effizienz aktuell reduziert',
      )
    } else if (history.hrPowerRatioDelta < -0.02) {
      hints.push(
        'HR/Power-Verhaeltnis besser als im Wochen-Schnitt -- gute aerobe Effizienz',
      )
    }
  }

  if (power.variability != null && power.variability > 1.4) {
    hints.push(
      `Power-Variability ${power.variability.toFixed(2)} -- ${power.variabilityLabel}, vermutlich Anstiege oder Endspurt`,
    )
  }

  if (run.runType === 'ruhig' && pacing.verdict !== 'discipline_kept') {
    hints.push(`Pacing-Bemerkung: ${pacing.reason}`)
  }

  if (run.maxHR != null && run.avgHR != null) {
    const hrSpan = run.maxHR - run.avgHR
    if (hrSpan > 25) {
      hints.push(
        `Max-Puls ${hrSpan} bpm ueber Schnitt -- Intervall-Charakter oder harter Endspurt`,
      )
    }
  }

  return {
    run,
    cp,
    paceSecondsPerKm,
    pace,
    power,
    hrPowerRatio,
    history,
    pacing,
    hints,
  }
}
