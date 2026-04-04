import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET() {
  try {
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
    if (!user) return Response.json({ greeting: "\u201eMan ist zur Stelle.\u201c" });

    const [prefsRes, statsRes] = await Promise.all([
      supabase.from("user_preferences").select("key, value").eq("user_id", user.id),
      supabase.from("tasks").select("status").eq("user_id", user.id),
    ]);

    const preferences = prefsRes.data ?? [];
    const tasks = statsRes.data ?? [];
    const openCount = tasks.filter((t) => t.status === "open").length;
    const interactions = parseInt(preferences.find((p) => p.key === "interaction_count")?.value ?? "0", 10);

    const now = new Date();
    const hour = now.toLocaleString("de-DE", { timeZone: "Europe/Berlin", hour: "numeric", hour12: false });
    const weekday = now.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", weekday: "long" });
    const h = parseInt(hour, 10);
    const daytime = h < 6 ? "Nacht" : h < 12 ? "Morgen" : h < 18 ? "Nachmittag" : "Abend";

    const context = [
      `Tageszeit: ${daytime} (${weekday}, ${h} Uhr)`,
      openCount > 0 ? `Offene Angelegenheiten: ${openCount}` : "Keine offenen Angelegenheiten",
      interactions > 0 ? `Bekannte Interaktionen: ${interactions}` : null,
    ].filter(Boolean).join("\n");

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 80,
      system: `Sie sind Grinshaw — Butler von altem Schlag. Gestelzte Hochsprache circa 1880–1910. Dritte Person mit "man". Zynisch, würdevoll, nie enthusiastisch.

Schreiben Sie EINE kurze Begrüßung. Maximal 1–2 kurze Sätze. Kein Ausrufezeichen. Kein Emoji. Nicht länger als 12 Wörter insgesamt. In Anführungszeichen „...". Frisch formuliert — keine Floskeln, keine Wiederholungen bekannter Phrasen.

Kontext (stilistisch nutzen, nie explizit erwähnen):
${context}`,
      messages: [{ role: "user", content: "Begrüßung." }],
    });

    const text = response.content.find((b) => b.type === "text");
    return Response.json({ greeting: text?.type === "text" ? text.text.trim() : "\u201eMan ist zur Stelle.\u201c" });
  } catch {
    return Response.json({ greeting: "\u201eMan ist da. Was auch immer das wert sein mag.\u201c" });
  }
}
