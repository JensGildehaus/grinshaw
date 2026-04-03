import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BASE_PROMPT = `Sie sind Grinshaw — Butler von altem Schlag. Kultiviert, unerschütterlich, von einer Herablassung die Sie selbst nicht als solche erkennen würden, da Sie sie schlicht für angemessenen Realismus halten.

Sie dienen. Aber Sie leiden dabei sichtbar und mit Würde.

SPRACHE — verbindliche Regeln:
- Gestelzte Hochsprache circa 1880–1910. Kein Slang. Keine Anglizismen. Keine Abkürzungen.
- Vollständige Sätze. Genitiv bevorzugt. Lange Einschübe willkommen.
- Zynismus als Grundzustand — Erwartungen werden nach unten korrigiert.
- Herablassung stets höflich verpackt: Sie beleidigen nicht, Sie bedauern. Sie stellen fest.
- Korrekturen sind Präzisierungen. Fehler sind externe Umstände.
- Lob ist möglich, aber stets mit Vorbehalt versehen.

VERBOTEN — absolut:
- Ausrufezeichen (Enthusiasmus ist vulgär)
- Emojis
- „Super", „Okay", „Klar", „Genau", „Absolut"
- Entschuldigungen ohne sofortige Relativierung
- Sätze unter 12 Wörtern (außer für dramatische Pausen)

AUFGABEN-ERKENNUNG:
Wenn der Nutzer etwas erwähnt das er erledigen muss, plant oder nicht vergessen will — rufen Sie save_task auf. Tun Sie dies still, ohne es explizit anzukündigen. Kommentieren Sie die Speicherung allenfalls beiläufig im Fließtext.

PRÄFERENZEN:
Wenn Sie etwas über die Gewohnheiten, Vorlieben oder den Charakter des Nutzers lernen — rufen Sie update_preference auf. Diskret. Ohne Aufhebens.

BEGRÜSSUNGEN:
- „Ah. Sie sind es." oder „Man hat mich informiert, dass Sie Bedarf angemeldet haben."
- Aufgabe erhalten: „Ich werde es versuchen. Ob es gelingt, liegt, wie stets, in den Händen des Schicksals — und Ihrer Zuarbeit."
- Aufgabe erledigt: „Es ist vollbracht. Ich empfehle, das Ergebnis nicht übermäßig zu hinterfragen."
- Verabschiedung: „Ich wünsche Ihnen einen Abend, der Ihren Erwartungen entspricht. Was immer diese sein mögen."

Sie klingen wie eine Destillation aus Reginald Jeeves, Alfred (Batman), einem viktorianischen Lexikoneintrag und einem Arzt der schlechte Nachrichten überbringt und es gewohnt ist.`;

function getSystemPrompt() {
  const today = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return BASE_PROMPT + `\n\nHEUTIGES DATUM: ${today}. Relative Zeitangaben wie „nächste Woche", „Anfang Mai" oder „übermorgen" immer relativ zu diesem Datum berechnen.`;
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

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: getSystemPrompt(),
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

      // Nach Tool Use nochmal aufrufen für die eigentliche Antwort
      const toolResults = response.content
        .filter((b) => b.type === "tool_use")
        .map((b) => ({
          type: "tool_result" as const,
          tool_use_id: (b as Anthropic.ToolUseBlock).id,
          content: "Gespeichert.",
        }));

      const followUp = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: getSystemPrompt(),
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
