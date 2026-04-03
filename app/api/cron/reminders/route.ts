import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

webpush.setVapidDetails(
  process.env.VAPID_MAILTO!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unbefugter Zugriff." }, { status: 401 });
  }

  // Überfällige Tasks finden (noch nicht erinnert)
  const today = new Date().toISOString().split("T")[0];
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, user_id, title, due_date")
    .eq("status", "open")
    .is("reminded_at", null)
    .lte("due_date", today);

  if (!tasks || tasks.length === 0) {
    return Response.json({ sent: 0 });
  }

  let sent = 0;
  const userIds = [...new Set(tasks.map((t) => t.user_id))];

  for (const userId of userIds) {
    const userTasks = tasks.filter((t) => t.user_id === userId);
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", userId);

    if (!subs || subs.length === 0) continue;

    const title = userTasks.length === 1
      ? userTasks[0].title
      : `${userTasks.length} Angelegenheiten warten`;

    const body = userTasks.length === 1
      ? "Grinshaw erinnert Sie mit der ihm eigenen Zurückhaltung."
      : "Grinshaw hat die Hoffnung noch nicht aufgegeben.";

    for (const { subscription } of subs) {
      try {
        await webpush.sendNotification(subscription, JSON.stringify({ title, body }));
        sent++;
      } catch {
        // Abgelaufene Subscription entfernen
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("subscription", subscription);
      }
    }

    // reminded_at setzen
    const ids = userTasks.map((t) => t.id);
    await supabase
      .from("tasks")
      .update({ reminded_at: new Date().toISOString() })
      .in("id", ids);
  }

  return Response.json({ sent });
}
