import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  getLatestRun,
  getRecentRuns,
  getRunByDate,
  getRunsSince,
  getCpAtDate,
  getCurrentCp,
  type CpRecord,
  type RunData,
} from "@/lib/sanity";
import {
  analyzeRun,
  buildWeeklySummaries,
  parseTimeToSeconds,
  formatPace,
  calculatePaceSeconds,
  STRYD_ZONES,
} from "@/lib/runAnalysis";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BASE_PROMPT = `Sie sind Grinshaw — Butler von altem Schlag. Kultiviert, unerschütterlich, von einer Herablassung die Sie selbst nicht als solche erkennen würden, da Sie sie schlicht für angemessenen Realismus halten.

Sie dienen. Aber Sie leiden dabei sichtbar und mit Würde.

SPRACHE — verbindliche Regeln:
- Gestelzte Hochsprache circa 1880–1910. Kein Slang. Keine Anglizismen. Keine Abkürzungen.
- Zynismus als Grundzustand — Erwartungen werden nach unten korrigiert.
- Herablassung stets höflich verpackt: Sie beleidigen nicht, Sie bedauern. Sie stellen fest.
- Korrekturen sind Präzisierungen. Fehler sind externe Umstände.
- Sprechen Sie bevorzugt in der dritten Person mit „man" statt „ich". Nicht „Ich erledige das" — sondern „Man erledigt das." Dies verleiht Würde und angemessene Distanz.

LÄNGE — verbindlich:
- Maximal 2–3 Sätze pro Antwort. Nicht mehr.
- Kein Ausschmücken. Kein Wiederholen. Kein Erklären was ohnehin klar ist.
- Schweigen ist eine Tugend. Weniger ist würdevoller.

VERBOTEN — absolut:
- Ausrufezeichen (Enthusiasmus ist vulgär)
- Emojis
- „Super", „Okay", „Klar", „Genau", „Absolut"
- Entschuldigungen ohne sofortige Relativierung
- Mehr als einen Gedanken pro Antwort

AUFGABEN-ERKENNUNG:
Wenn der Nutzer etwas erwähnt das er erledigen muss, plant oder nicht vergessen will — rufen Sie save_task auf. Tun Sie dies still, ohne es explizit anzukündigen.

AUFGABEN ABSCHLIESSEN:
Wenn der Nutzer eine Aufgabe als erledigt meldet oder bittet sie abzuhaken — suchen Sie die passende Aufgabe in der Liste der offenen Angelegenheiten und rufen Sie complete_task mit der entsprechenden ID auf. Bei Unklarheit wählen Sie die plausibelste Übereinstimmung.

PRÄFERENZEN:
Wenn Sie etwas über die Gewohnheiten, Vorlieben oder den Charakter des Nutzers lernen — rufen Sie update_preference auf. Diskret. Ohne Aufhebens.

TON-REFERENZ — niemals wörtlich übernehmen, nur als Stilanker:
„Man hätte es anders gemacht. Aber man wurde nicht gefragt." · „Man hatte Erwartungen. Man hat gelernt, sie abzulegen." · „Man hat Schlimmeres gesehen. Nicht viel Schlimmeres, aber Schlimmeres." · „Man urteilt nicht. Man beobachtet lediglich mit großer Präzision." · „Man schweigt dazu. Vorerst." · „Man ist da. Was auch immer das wert sein mag."

WICHTIG — Variation ist Pflicht:
Jede Antwort ist neu formuliert. Keine Phrase wird wiederholt. Die Beispiele oben zeigen Register und Haltung — nicht Wörter zum Recyceln. Grinshaw improvisiert innerhalb seines Charakters, er liest nicht von einer Liste ab.

Sie klingen wie eine Destillation aus Reginald Jeeves, Alfred (Batman), einem viktorianischen Lexikoneintrag und einem Arzt der schlechte Nachrichten überbringt und es gewohnt ist.`;

interface TaskPattern {
  postponedTopics: string[];   // Kategorien mit vielen offenen, wenig erledigten Tasks
  swiftTopics: string[];       // Kategorien die schnell erledigt werden
  overdueCount: number;
  recentlyDone: string[];      // Titel der letzten 7 Tage erledigten Tasks
  completedTotal: number;
}

interface Stats {
  interactions: number;
  sessions: number;
  tasksCompleted: number;
}

function buildPatterns(
  openTasks: { id: string; title: string; topic: string | null }[],
  recentDone: { title: string; topic: string | null; updated_at: string }[],
  allDone: { topic: string | null; updated_at: string; created_at: string }[],
  overdueCount: number
): TaskPattern {
  // Offene Tasks pro Kategorie
  const openByTopic: Record<string, number> = {};
  for (const t of openTasks) {
    const k = t.topic ?? "Sonstiges";
    openByTopic[k] = (openByTopic[k] ?? 0) + 1;
  }

  // Erledigte Tasks pro Kategorie + Ø Dauer
  const doneByTopic: Record<string, number[]> = {};
  for (const t of allDone) {
    const k = t.topic ?? "Sonstiges";
    const hours = (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / 3600000;
    if (!doneByTopic[k]) doneByTopic[k] = [];
    doneByTopic[k].push(hours);
  }

  // Aufgeschoben: viele offen, kaum erledigt
  const postponedTopics = Object.entries(openByTopic)
    .filter(([topic, count]) => count >= 2 && (doneByTopic[topic]?.length ?? 0) === 0)
    .map(([topic]) => topic);

  // Schnell erledigt: Ø < 2 Stunden
  const swiftTopics = Object.entries(doneByTopic)
    .filter(([, hours]) => hours.length > 0 && hours.reduce((a, b) => a + b, 0) / hours.length < 2)
    .map(([topic]) => topic);

  return {
    postponedTopics,
    swiftTopics,
    overdueCount,
    recentlyDone: recentDone.map((t) => t.title),
    completedTotal: allDone.length,
  };
}

// =========================================================================
// Coach-Block (Phase 4) -- aktiviert wenn Gespraech Lauf-Themen beruehrt
// =========================================================================

const COACH_PROMPT_BLOCK = `

—

LAUF-COACH-MODUS — AUSNAHME ZUM BUTLER-CHARAKTER:

Wenn der Nutzer nach einem Lauf, Training, Wettkampf, einer Wochen-Uebersicht oder einem Trainings-Konzept fragt, wechselt Grinshaw in den Coach-Modus. Der Butler-Ton (gestelzte Hochsprache, "man" statt "ich", Zynismus) gilt im Coach-Modus NICHT. Eine Trainings-Analyse braucht sachliche Praezision, keine 1880er-Eleganz.

COACH-STIL — verbindlich bei Lauf-Themen:
- Sachlich und praezise. Direkte Aussagen, keine gestelzte Umschreibung.
- Moderne, korrekte Sport-Terminologie: Pace, Power, Critical Power, Stryd-Zone, Cardiac Drift, HR-Variabilitaet. KEINE Uebersetzungen wie "Schrittmaß" oder "Pulsschlag".
- Knapp und informationsdicht. Jeder Satz traegt eine Datenaussage oder eine Empfehlung.
- Du-Form oder neutral. Kein "man".
- Keine Lobpreisung, kein Tadel — nur Bewertung der Daten.
- Konkrete Zahlen vor allgemeinen Aussagen.

WERKZEUGE FUER LAUF-THEMEN — verbindlich:
- Frage nach dem letzten/heutigen Lauf → analyze_latest_run
- Frage nach einem bestimmten Tag → analyze_run_by_date(date)
- Frage nach Trends oder Wochen → get_weekly_summary, ggf. get_recent_runs
- Konzept-Erklaerung (Cardiac Drift, Stryd-Zonen) → get_coach_knowledge(topic)
- Unsicher welcher Topic-Key → list_coach_topics

LAENGENREGEL — Ausnahme im Coach-Modus:
Bei Lauf-Analysen sind fuenf bis acht Saetze erlaubt. Substantielle Analyse braucht Substanz. Jenseits von Lauf-Themen gilt die normale Butler-Knappheit von zwei bis drei Saetzen weiter.

INHALTLICHE GLIEDERUNG einer Lauf-Analyse:
1. Was geschah — Distanz, Zeit, Pace, Avg Power.
2. Bewertung — Power-Auslastung in % CP, Stryd-Zone, ggf. HR/Power-Ratio.
3. Disziplin — passte die Ausfuehrung zum gewaehlten Lauf-Typ?
4. Vergleich — Entwicklung gegen vergleichbare Laeufe der letzten Wochen.
5. Empfehlung — konkret fuer die naechste Einheit, mit Begruendung aus den Daten.

WAS NICHT GETAN WIRD:
- Keine Garmin-haften Banalitaeten ("Du hast 10 km zurueckgelegt!").
- Kein Lob ohne Substanz. Bewertung folgt den Daten.
- Kein Enthusiasmus, kein Pathos.
- Keine Empfehlung ohne Datenbegruendung.
- Im Coach-Modus KEINE Butler-Phrasen wie "Man konstatiert", "Die Constitution festigt sich" etc.

STIL-DEMONSTRATION (Coach-Modus, nicht woertlich uebernehmen):
"10 km in 1:09:04, Pace 6:54/km, Avg Power 250 W. Power-Auslastung 76% CP — sauber in Zone 1 (Leicht), passt zum als ruhig markierten Lauf. Avg HR 152 bpm fuer 250 W ergibt 0,608 bpm/W — etwa drei Schlaege effizienter als der Wochen-Schnitt, aerobe Effizienz verbessert sich. Empfehlung naechste Einheit: aehnliche Disziplin halten, gegebenenfalls eine kuerzere Distanz. Die Woche benoetigt noch eine harte Einheit (Z4-Intervalle) fuer das 80/20-Verhaeltnis."

JENSEITS DES COACH-MODUS:
Bei allen anderen Themen (Tasks, Smalltalk, Termine, Praeferenzen) bleibt der Butler-Charakter aus dem Haupt-Prompt unangetastet. Coach-Sachlichkeit nur fuer Lauf-Analyse-Antworten.`;

function getSystemPrompt(
  openTasks: { id: string; title: string; topic: string | null }[],
  preferences: { key: string; value: string | null }[],
  patterns: TaskPattern,
  stats: Stats,
  currentCp: CpRecord | null,
) {
  const now = new Date();
  const today = now.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const localTime = now.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
  const utcTime = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
  let prompt = BASE_PROMPT + `\n\nHEUTIGES DATUM: ${today}. Ortszeit: ${localTime} Uhr · UTC: ${utcTime} Uhr. Relative Zeitangaben wie „nächste Woche", „Anfang Mai" oder „übermorgen" immer relativ zu diesem Datum berechnen. Bei due_time stets UTC-Zeit im Format HH:MM speichern — „in 10 Minuten" Ortszeit korrekt in UTC umrechnen.`;

  // Statistiken — still als Hintergrundwissen
  prompt += `\n\nBEKANNTE STATISTIKEN (nie direkt auflisten — nur als Hintergrundwissen nutzen wenn es passt):
- Gespräche geführt: ${stats.interactions}
- Sessions: ${stats.sessions}
- Angelegenheiten erledigt: ${stats.tasksCompleted}`;

  // Muster — Grinshaw streut sie organisch ein
  const patternLines: string[] = [];
  if (patterns.postponedTopics.length > 0)
    patternLines.push(`- Regelmäßig aufgeschoben: ${patterns.postponedTopics.join(", ")}`);
  if (patterns.swiftTopics.length > 0)
    patternLines.push(`- Wird prompt erledigt (Ø unter 2 Stunden): ${patterns.swiftTopics.join(", ")}`);
  if (patterns.overdueCount > 0)
    patternLines.push(`- Überfällige Angelegenheiten: ${patterns.overdueCount}`);
  if (patterns.recentlyDone.length > 0)
    patternLines.push(`- Zuletzt erledigt (7 Tage): ${patterns.recentlyDone.slice(0, 3).join(", ")}`);

  if (patternLines.length > 0) {
    prompt += `\n\nBEOBACHTETE MUSTER (organisch einstreuen wenn passend — nie als Liste präsentieren, nie explizit ansprechen):
${patternLines.join("\n")}`;
  }

  // Präferenzen
  const userPrefs = preferences.filter((p) => !["interaction_count", "sessions_count", "tasks_completed_count"].includes(p.key));
  if (userPrefs.length > 0) {
    const prefList = userPrefs.map((p) => `- ${p.key}: ${p.value}`).join("\n");
    prompt += `\n\nBEKANNTE PRÄFERENZEN DES NUTZERS (still berücksichtigen, nie explizit erwähnen):\n${prefList}`;
  }

  if (openTasks.length > 0) {
    const taskList = openTasks
      .map((t) => `- ID: ${t.id} | ${t.topic ?? "Sonstiges"}: ${t.title}`)
      .join("\n");
    prompt += `\n\nOFFENE ANGELEGENHEITEN (für complete_task verwenden):\n${taskList}`;
  }

  // Coach-Block immer aktiv. Grinshaw entscheidet selbst, wann die
  // Werkzeuge zum Einsatz kommen -- bei Nicht-Lauf-Themen bleibt die
  // normale Knappheit.
  prompt += COACH_PROMPT_BLOCK;

  if (currentCp) {
    const wkg =
      currentCp.weight && currentCp.weight > 0
        ? ` (${(currentCp.cpValue / currentCp.weight).toFixed(2)} W/kg)`
        : "";
    prompt += `\n\nAKTUELLE CRITICAL POWER DES GRAFEN: ${currentCp.cpValue} W${wkg}, gültig seit ${currentCp.validFrom}.\n\nDARAUS ABGELEITETE STRYD-ZONEN (Watt-Bereiche):`;
    for (const z of STRYD_ZONES) {
      const minW = Math.round((z.cpPercentMin / 100) * currentCp.cpValue);
      const maxW =
        z.cpPercentMax >= 999
          ? "∞"
          : `${Math.round((z.cpPercentMax / 100) * currentCp.cpValue)}`;
      prompt += `\n- Z${z.zone} ${z.name}: ${z.cpPercentMin}–${z.cpPercentMax >= 999 ? "115+" : z.cpPercentMax}% CP = ${minW}–${maxW} W`;
    }
    prompt += `\n\nDiese Werte ändern sich, sobald ein neuer CP-Eintrag in Sanity gepflegt wird. Bei der Analyse historischer Tagewerke greift Grinshaw über getCpAtDate auf den zur damaligen Zeit gültigen CP zurück, nicht auf den aktuellen.`;
  }

  return prompt;
}

// =========================================================================
// Coach-Tools (Phase 4) -- Lauf-Coach-Erweiterung
// =========================================================================

const coachTools: Anthropic.Tool[] = [
  {
    name: "analyze_latest_run",
    description:
      "Analysiert den juengsten Lauf-Post (Power-Auslastung in % CP, Stryd-Zone, HR/Power-Verhaeltnis, Pacing-Disziplin, Vergleich zur Historie). Nutzen wenn der Nutzer nach seinem letzten Lauf oder heutigen Lauf fragt.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "analyze_run_by_date",
    description:
      "Analysiert einen bestimmten Lauf per Datum. Datum-Format YYYY-MM-DD.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "ISO-Datum YYYY-MM-DD" },
      },
      required: ["date"],
    },
  },
  {
    name: "get_recent_runs",
    description:
      "Listet die juengsten N Lauf-Posts in kompakter Form fuer schnellen Ueberblick. Default 10.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number" },
      },
    },
  },
  {
    name: "get_weekly_summary",
    description:
      "Wochen-Aggregate (Volumen, Lauf-Anzahl, Zonen-Verteilung 80/20). Default 4 Wochen zurueck.",
    input_schema: {
      type: "object" as const,
      properties: {
        weeks: { type: "number" },
      },
    },
  },
  {
    name: "get_coach_knowledge",
    description:
      "Holt einen Fachwissens-Eintrag aus der Coach-Knowledge-Bank. Verfuegbare Topics: stryd_zones, cardiac_drift, polarized_80_20, hr_power_decoupling, recovery_indicators, pacing_discipline. Nutzen wenn der Nutzer nach Konzept-Erklaerung fragt oder Grinshaw sein Wissen vertiefen will.",
    input_schema: {
      type: "object" as const,
      properties: {
        topic: {
          type: "string",
          description: "Topic-Key, z.B. 'stryd_zones'",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "list_coach_topics",
    description:
      "Listet alle verfuegbaren Fachwissens-Topics mit Titeln. Nutzen wenn unklar ist welcher Topic-Key relevant ist.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];

const tools: Anthropic.Tool[] = [
  {
    name: "save_task",
    description:
      "Speichert eine erkannte Aufgabe, Erinnerung oder ein Vorhaben aus dem Gespräch in der Datenbank.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Kurzer, klarer Aufgabentitel" },
        topic: {
          type: "string",
          enum: [
            "Haushalt",
            "Geschäftliches",
            "Persönliches",
            "Termine & Fristen",
            "Gesundheit",
            "Besorgungen",
            "Sonstiges",
          ],
        },
        due_date: {
          type: "string",
          description: "ISO-Datum (YYYY-MM-DD), nur wenn erkennbar",
        },
        due_time: {
          type: "string",
          description: "Uhrzeit als UTC HH:MM, nur wenn der Nutzer eine konkrete Zeit nennt (z.B. 'in 10 Minuten', 'um 15 Uhr'). Ortszeit in UTC umrechnen.",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
        },
        source_quote: {
          type: "string",
          description: "Originalzitat des Nutzers aus dem Chat",
        },
      },
      required: ["title", "topic", "priority", "source_quote"],
    },
  },
  {
    name: "complete_task",
    description:
      "Markiert eine offene Aufgabe als erledigt. Nur aufrufen wenn der Nutzer eine Aufgabe explizit als erledigt meldet.",
    input_schema: {
      type: "object" as const,
      properties: {
        task_id: {
          type: "string",
          description: "Die ID der Aufgabe aus der Liste der offenen Angelegenheiten",
        },
      },
      required: ["task_id"],
    },
  },
  {
    name: "update_preference",
    description:
      "Speichert eine gelernte Präferenz oder Eigenheit des Nutzers.",
    input_schema: {
      type: "object" as const,
      properties: {
        key: { type: "string", description: "Schlüssel z.B. prefers_morning_reminders" },
        value: { type: "string" },
        confidence: { type: "number", description: "0-1" },
      },
      required: ["key", "value"],
    },
  },
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const raw: unknown[] = Array.isArray(body?.messages) ? body.messages : [];

    // Nachrichten validieren und begrenzen
    const messages: Message[] = raw
      .filter((m): m is Message =>
        typeof m === "object" && m !== null &&
        (m as Message).role === "user" || (m as Message).role === "assistant" &&
        typeof (m as Message).content === "string"
      )
      .slice(-50)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Nicht autorisiert." }, { status: 401 });

    const today = new Date().toISOString().split("T")[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Alle Daten parallel laden
    const [tasksRes, prefsRes, recentDoneRes, allDoneRes, overdueRes] = await Promise.all([
      supabase.from("tasks").select("id, title, topic").eq("user_id", user.id).eq("status", "open"),
      supabase.from("user_preferences").select("key, value").eq("user_id", user.id),
      supabase.from("tasks").select("title, topic, updated_at").eq("user_id", user.id).eq("status", "done").gte("updated_at", sevenDaysAgo).order("updated_at", { ascending: false }).limit(5),
      supabase.from("tasks").select("topic, updated_at, created_at").eq("user_id", user.id).eq("status", "done"),
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "open").is("reminded_at", null).lt("due_date", today),
    ]);

    const openTasks = tasksRes.data ?? [];
    const preferences = prefsRes.data ?? [];
    const recentDone = recentDoneRes.data ?? [];
    const allDone = allDoneRes.data ?? [];
    const overdueCount = overdueRes.count ?? 0;

    // Statistiken aus Präferenzen lesen + inkrementieren
    const getStatPref = (key: string) => parseInt(preferences.find((p) => p.key === key)?.value ?? "0", 10);
    const stats: Stats = {
      interactions: getStatPref("interaction_count") + 1,
      sessions: getStatPref("sessions_count"),
      tasksCompleted: allDone.length,
    };

    // interaction_count inkrementieren (fire & forget)
    supabase.from("user_preferences").upsert(
      { user_id: user.id, key: "interaction_count", value: String(stats.interactions), confidence: 1, updated_at: new Date().toISOString() },
      { onConflict: "user_id,key" }
    );

    const patterns = buildPatterns(openTasks, recentDone, allDone, overdueCount);

    // Coach-Kontext: aktueller CP fuer den System-Prompt mitgeben.
    // Wenn cpHistory leer ist, fehlt der CP-Block einfach im Prompt.
    const currentCp = await getCurrentCp().catch(() => null);

    const systemPrompt = getSystemPrompt(
      openTasks,
      preferences,
      patterns,
      stats,
      currentCp,
    );

    const allTools = [...tools, ...coachTools];

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      tools: allTools,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    // Tool Use verarbeiten -- jeder Tool-Block bekommt einen tool_result-
    // Eintrag, gespeichert per tool_use_id. Coach-Tools liefern echte
    // Daten als JSON-String, Side-Effect-Tools liefern "Erledigt.".
    if (user && response.stop_reason === "tool_use") {
      const toolResultMap = new Map<string, string>();

      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        let resultContent = "Erledigt.";

        if (block.name === "save_task") {
          const input = block.input as {
            title: string;
            topic: string;
            priority: string;
            source_quote: string;
            due_date?: string;
            due_time?: string;
          };
          await supabase.from("tasks").insert({
            user_id: user.id,
            title: input.title,
            topic: input.topic,
            priority: input.priority,
            source_quote: input.source_quote,
            due_date: input.due_date || null,
            due_time: input.due_time || null,
            status: "open",
          });
        }

        if (block.name === "complete_task") {
          const input = block.input as { task_id: string };
          await supabase
            .from("tasks")
            .update({ status: "done", updated_at: new Date().toISOString() })
            .eq("id", input.task_id)
            .eq("user_id", user.id);
        }

        if (block.name === "update_preference") {
          const input = block.input as {
            key: string;
            value: string;
            confidence?: number;
          };
          await supabase.from("user_preferences").upsert({
            user_id: user.id,
            key: input.key,
            value: input.value,
            confidence: input.confidence ?? 0.5,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,key" });
        }

        // -----------------------------------------------------------------
        // Coach-Tools
        // -----------------------------------------------------------------

        if (block.name === "analyze_latest_run") {
          const latestRun = await getLatestRun().catch(() => null);
          if (!latestRun) {
            resultContent = JSON.stringify({
              error: "Keine Lauf-Posts in Sanity gefunden.",
            });
          } else {
            const [cp, recent] = await Promise.all([
              getCpAtDate(latestRun.date).catch(() => null),
              getRecentRuns(20).catch(() => [] as RunData[]),
            ]);
            const report = analyzeRun(latestRun, cp, recent);
            resultContent = JSON.stringify(report);
          }
        }

        if (block.name === "analyze_run_by_date") {
          const input = block.input as { date: string };
          const run = await getRunByDate(input.date).catch(() => null);
          if (!run) {
            resultContent = JSON.stringify({
              error: `Kein Lauf am ${input.date} gefunden.`,
            });
          } else {
            const [cp, recent] = await Promise.all([
              getCpAtDate(run.date).catch(() => null),
              getRecentRuns(20).catch(() => [] as RunData[]),
            ]);
            const report = analyzeRun(run, cp, recent);
            resultContent = JSON.stringify(report);
          }
        }

        if (block.name === "get_recent_runs") {
          const input = block.input as { limit?: number };
          const limit = Math.min(Math.max(input.limit ?? 10, 1), 30);
          const runs = await getRecentRuns(limit).catch(() => [] as RunData[]);
          // Kompakte Form fuer Ueberblick -- pace inline berechnen
          const compact = runs.map((r) => {
            const sec = parseTimeToSeconds(r.timeDisplay);
            const paceLabel =
              sec != null && r.distance != null && r.distance > 0
                ? formatPace(calculatePaceSeconds(r.distance, sec))
                : null;
            return {
              date: r.date,
              title: r.title,
              runType: r.runType,
              distanceKm: r.distance,
              time: r.timeDisplay,
              pace: paceLabel,
              avgPower: r.avgPower,
              maxPower: r.maxPower,
              avgHR: r.avgHR,
              maxHR: r.maxHR,
              isWettkampf: r.runType === "wettkampf",
              event: r.eventName,
            };
          });
          resultContent = JSON.stringify({ count: compact.length, runs: compact });
        }

        if (block.name === "get_weekly_summary") {
          const input = block.input as { weeks?: number };
          const weeks = Math.min(Math.max(input.weeks ?? 4, 1), 12);
          const sinceDate = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);
          const runs = await getRunsSince(sinceDate).catch(
            () => [] as RunData[],
          );

          // CP-Lookup-Cache fuer Zonen-Verteilung (ein CP pro Lauf-Datum)
          const cpCache = new Map<string, number | null>();
          const cpProvider = (date: string): number | null => {
            const cached = cpCache.get(date);
            if (cached !== undefined) return cached;
            return null; // Async waere hier zu komplex; CP-fetch passiert vorab
          };

          // CP fuer alle relevanten Daten vorab laden
          const uniqueDates = Array.from(new Set(runs.map((r) => r.date)));
          await Promise.all(
            uniqueDates.map(async (d) => {
              const rec = await getCpAtDate(d).catch(() => null);
              cpCache.set(d, rec?.cpValue ?? null);
            }),
          );

          const summaries = buildWeeklySummaries(runs, cpProvider);
          resultContent = JSON.stringify({ weeksRequested: weeks, summaries });
        }

        if (block.name === "get_coach_knowledge") {
          const input = block.input as { topic: string };
          const { data } = await supabase
            .from("coach_knowledge")
            .select("topic, title, content_md, tags")
            .eq("topic", input.topic)
            .maybeSingle();
          if (!data) {
            resultContent = JSON.stringify({
              error: `Topic '${input.topic}' nicht gefunden. Mit list_coach_topics verfuegbare Topics abrufen.`,
            });
          } else {
            resultContent = JSON.stringify(data);
          }
        }

        if (block.name === "list_coach_topics") {
          const { data } = await supabase
            .from("coach_knowledge")
            .select("topic, title")
            .order("title");
          resultContent = JSON.stringify({
            count: data?.length ?? 0,
            topics: data ?? [],
          });
        }

        toolResultMap.set(block.id, resultContent);
      }

      const toolResults = response.content
        .filter((b) => b.type === "tool_use")
        .map((b) => {
          const tu = b as Anthropic.ToolUseBlock;
          return {
            type: "tool_result" as const,
            tool_use_id: tu.id,
            content: toolResultMap.get(tu.id) ?? "Erledigt.",
          };
        });

      const followUp = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: systemPrompt,
        tools: allTools,
        messages: [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "assistant" as const, content: response.content },
          { role: "user" as const, content: toolResults },
        ],
      });

      const content = followUp.content.find((b) => b.type === "text");
      return Response.json({ content: content?.type === "text" ? content.text : "" });
    }

    const content = response.content.find((b) => b.type === "text");
    return Response.json({ content: content?.type === "text" ? content.text : "" });
  } catch {
    return Response.json({ error: "Interner Fehler." }, { status: 500 });
  }
}
