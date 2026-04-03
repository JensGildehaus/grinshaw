import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

function getSystemPrompt(
  openTasks: { id: string; title: string; topic: string | null }[],
  preferences: { key: string; value: string | null }[]
) {
  const now = new Date();
  const today = now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const time = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  let prompt = BASE_PROMPT + `\n\nHEUTIGES DATUM: ${today}, ${time} Uhr. Relative Zeitangaben wie „nächste Woche", „Anfang Mai" oder „übermorgen" immer relativ zu diesem Datum berechnen.`;

  if (preferences.length > 0) {
    const prefList = preferences.map((p) => `- ${p.key}: ${p.value}`).join("\n");
    prompt += `\n\nBEKANNTE PRÄFERENZEN DES NUTZERS (still berücksichtigen, nie explizit erwähnen):\n${prefList}`;
  }

  if (openTasks.length > 0) {
    const taskList = openTasks
      .map((t) => `- ID: ${t.id} | ${t.topic ?? "Sonstiges"}: ${t.title}`)
      .join("\n");
    prompt += `\n\nOFFENE ANGELEGENHEITEN (für complete_task verwenden):\n${taskList}`;
  }

  return prompt;
}

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
    const { messages }: { messages: Message[] } = await request.json();

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

    // Offene Tasks + Präferenzen laden
    let openTasks: { id: string; title: string; topic: string | null }[] = [];
    let preferences: { key: string; value: string | null }[] = [];
    if (user) {
      const [tasksRes, prefsRes] = await Promise.all([
        supabase.from("tasks").select("id, title, topic").eq("user_id", user.id).eq("status", "open"),
        supabase.from("user_preferences").select("key, value").eq("user_id", user.id),
      ]);
      openTasks = tasksRes.data ?? [];
      preferences = prefsRes.data ?? [];
    }

    const systemPrompt = getSystemPrompt(openTasks, preferences);

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    // Tool Use verarbeiten
    if (user && response.stop_reason === "tool_use") {
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;

        if (block.name === "save_task") {
          const input = block.input as {
            title: string;
            topic: string;
            priority: string;
            source_quote: string;
            due_date?: string;
          };
          await supabase.from("tasks").insert({
            user_id: user.id,
            title: input.title,
            topic: input.topic,
            priority: input.priority,
            source_quote: input.source_quote,
            due_date: input.due_date || null,
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
      }

      const toolResults = response.content
        .filter((b) => b.type === "tool_use")
        .map((b) => ({
          type: "tool_result" as const,
          tool_use_id: (b as Anthropic.ToolUseBlock).id,
          content: "Erledigt.",
        }));

      const followUp = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        tools,
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
