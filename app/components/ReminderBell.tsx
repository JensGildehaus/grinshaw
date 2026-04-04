"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

interface ReminderTask {
  id: string;
  title: string;
  due_date: string;
  due_time: string;
}

function formatDueTime(date: string, time: string): string {
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const d = date.split("T")[0];
  // Convert UTC time to local
  const [h, m] = time.split(":").map(Number);
  const dt = new Date();
  dt.setUTCHours(h, m, 0, 0);
  const localTime = dt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  if (d === today) return `Heute, ${localTime} Uhr`;
  if (d === tomorrow) return `Morgen, ${localTime} Uhr`;
  return `${new Date(date).toLocaleDateString("de-DE", { day: "numeric", month: "short" })}, ${localTime} Uhr`;
}

export function ReminderBell() {
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<ReminderTask[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const threeDays = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];
      const { data } = await supabase
        .from("tasks")
        .select("id, title, due_date, due_time")
        .eq("user_id", user.id)
        .eq("status", "open")
        .not("due_time", "is", null)
        .lte("due_date", threeDays)
        .order("due_date", { ascending: true })
        .order("due_time", { ascending: true });
      setTasks(data ?? []);
    }
    load();
  }, []);

  // Schließen bei Klick außerhalb
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const count = tasks.length;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Erinnerungen"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "0",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "28px",
          height: "28px",
        }}
      >
        {/* Glocken-SVG */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--g-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && (
          <span style={{
            position: "absolute",
            top: "-2px",
            right: "-2px",
            background: "var(--g-gold)",
            color: "var(--g-bg)",
            fontSize: "0.55rem",
            fontWeight: 700,
            width: "14px",
            height: "14px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "inherit",
          }}>
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 0.75rem)",
          right: 0,
          width: "280px",
          background: "#1f3526",
          border: "1px solid var(--g-border)",
          zIndex: 100,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          <p style={{
            fontSize: "0.6rem",
            color: "var(--g-gold)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontFamily: "var(--font-playfair), Georgia, serif",
            padding: "0.75rem 1rem 0.5rem",
            margin: 0,
            borderBottom: "1px solid var(--g-border)",
          }}>
            Erinnerungen
          </p>

          {tasks.length === 0 ? (
            <p style={{
              fontSize: "0.78rem",
              color: "var(--g-muted)",
              fontStyle: "italic",
              padding: "0.85rem 1rem",
              margin: 0,
            }}>
              Keine ausstehenden Erinnerungen. Man gönnt sich einen Moment der Stille.
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {tasks.map((t) => (
                <li key={t.id} style={{
                  padding: "0.65rem 1rem",
                  borderBottom: "1px solid var(--g-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.2rem",
                }}>
                  <span style={{ fontSize: "0.82rem", color: "var(--g-text)", lineHeight: 1.4 }}>
                    {t.title}
                  </span>
                  <span style={{ fontSize: "0.65rem", color: "var(--g-gold)", opacity: 0.75 }}>
                    {formatDueTime(t.due_date, t.due_time)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
