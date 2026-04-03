import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Subscription-Objekt validieren — nur erlaubte Felder
    if (!body?.endpoint || typeof body.endpoint !== "string" || !body.endpoint.startsWith("https://")) {
      return Response.json({ error: "Ungültige Subscription." }, { status: 400 });
    }
    const subscription = body;

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

    // Alte Subscriptions des Users ersetzen
    await supabase.from("push_subscriptions").delete().eq("user_id", user.id);
    await supabase.from("push_subscriptions").insert({
      user_id: user.id,
      subscription,
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Interner Fehler." }, { status: 500 });
  }
}
