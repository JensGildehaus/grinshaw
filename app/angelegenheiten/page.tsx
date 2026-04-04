"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { Task } from "@/lib/types";

const PRIORITY_LABEL: Record<string, string> = {
  high: "Dringend",
  medium: "Mittel",
  low: "Nachrangig",
};

const PRIORITY_COLOR: Record<string, string> = {
  high: "#c0392b",
  medium: "var(--g-gold)",
  low: "var(--g-muted)",
};

const STATUS_NEXT: Record<string, Task["status"]> = {
  open: "done",
  done: "open",
  snoozed: "open",
};


function groupByTopic(tasks: Task[]): Record<string, Task[]> {
  return tasks.reduce<Record<string, Task[]>>((acc, task) => {
    const key = task.topic ?? "Sonstiges";
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});
}

function formatDate(iso: string | null): { text: string; tone: "urgent" | "today" | "soon" | "normal" } | null {
  if (!iso) return null;
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { text: `Überfällig seit ${Math.abs(diff)} Tag${Math.abs(diff) !== 1 ? "en" : ""}. Man schweigt dazu.`, tone: "urgent" };
  if (diff === 0) return { text: "Heute. Man hat es zur Kenntnis genommen.", tone: "today" };
  if (diff === 1) return { text: "Morgen. Noch ist Zeit.", tone: "soon" };
  return { text: d.toLocaleDateString("de-DE", { day: "numeric", month: "long" }), tone: "normal" };
}

function buildComment(tasks: Task[]): string {
  const open = tasks.filter((t) => t.status === "open" || t.status === "snoozed");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdue = open.filter((t) => t.due_date && new Date(t.due_date) < today);
  const high = open.filter((t) => t.priority === "high");

  if (open.length === 0) return '\u201eKeine offenen Angelegenheiten. Man wei\u00df nicht, ob das beruhigend oder verd\u00e4chtig ist.\u201c';
  if (overdue.length > 0 && overdue.length === open.length) return `\u201e${open.length} Angelegenheit${open.length !== 1 ? "en" : ""}, alle \u00fcberf\u00e4llig. Man h\u00e4lt sich bedeckt.\u201c`;
  if (overdue.length > 0) return `\u201e${open.length} offen, ${overdue.length} davon \u00fcberf\u00e4llig. Man registriert das mit stiller Fassung.\u201c`;
  if (high.length > 0) return `\u201e${open.length} Angelegenheit${open.length !== 1 ? "en" : ""}, ${high.length} dringend. Man empfiehlt, die Reihenfolge zu \u00fcberdenken.\u201c`;
  return `\u201e${open.length} offene Angelegenheit${open.length !== 1 ? "en" : ""}. Man hat die Hoffnung noch nicht aufgegeben.\u201c`;
}

export default function Angelegenheiten() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleTopic(topic: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(topic) ? next.delete(topic) : next.add(topic);
      return next;
    });
  }
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .order("priority", { ascending: true })
        .order("created_at", { ascending: false });
      setTasks(data ?? []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  async function toggleStatus(task: Task) {
    const next = STATUS_NEXT[task.status];
    await supabase.from("tasks").update({ status: next, updated_at: new Date().toISOString() }).eq("id", task.id);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
  }

  const visible = tasks.filter((t) =>
    filter === "all" ? true : filter === "open" ? t.status === "open" || t.status === "snoozed" : t.status === "done"
  );

  const grouped = groupByTopic(visible);
  const topics = Object.keys(grouped).sort();

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Header */}
      <header
        style={{
          width: "100%",
          borderBottom: "1px solid var(--g-border)",
          padding: "1rem 1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxSizing: "border-box",
          flexShrink: 0,
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-playfair), Georgia, serif",
            fontSize: "1.2rem",
            letterSpacing: "0.12em",
            color: "var(--g-gold)",
            fontWeight: 700,
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          Grinshaw
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <span
            style={{
              fontSize: "0.65rem",
              color: "var(--g-muted)",
              letterSpacing: "0.08em",
              fontFamily: "var(--font-playfair), Georgia, serif",
              textTransform: "uppercase",
              textAlign: "right",
            }}
          >
            Die laufenden
            <br />
            Angelegenheiten
          </span>
        </div>
      </header>

      <div
        style={{
          width: "100%",
          maxWidth: "640px",
          padding: "2rem 1.5rem",
          boxSizing: "border-box",
          flex: 1,
        }}
      >
        {/* Filter */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            marginBottom: "2rem",
            borderBottom: "1px solid var(--g-border)",
            paddingBottom: "1rem",
          }}
        >
          {(["open", "done", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: "transparent",
                border: "none",
                padding: "0.2rem 0",
                marginRight: "1rem",
                fontSize: "0.7rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontFamily: "var(--font-playfair), Georgia, serif",
                cursor: "pointer",
                color: filter === f ? "var(--g-gold)" : "var(--g-muted)",
                borderBottom: filter === f ? "1px solid var(--g-gold)" : "1px solid transparent",
                transition: "color 0.2s",
              }}
            >
              {f === "open" ? "Offen" : f === "done" ? "Erledigt" : "Alle"}
            </button>
          ))}
        </div>

        {/* Grinshaw-Kommentar */}
        {!loading && (
          <p style={{
            fontSize: "0.78rem",
            color: "var(--g-muted)",
            fontStyle: "italic",
            lineHeight: "1.6",
            marginBottom: "1.5rem",
            marginTop: "-0.5rem",
          }}>
            {buildComment(tasks)}
          </p>
        )}

        {/* Inhalt */}
        {loading ? (
          <p style={{ fontSize: "0.82rem", color: "var(--g-muted)", fontStyle: "italic" }}>
            Ich sichte Ihre Unterlagen. Einen Moment, bitte.
          </p>
        ) : visible.length === 0 ? null : (
          topics.map((topic) => {
            const isCollapsed = collapsed.has(topic);
            return (
            <div key={topic} style={{ marginBottom: "2.5rem" }}>
              {/* Namensschild */}
              <div
                onClick={() => toggleTopic(topic)}
                style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.55rem 2.5rem",
                marginBottom: isCollapsed ? 0 : "1rem",
                background: "linear-gradient(180deg, rgba(212,180,131,0.11) 0%, rgba(212,180,131,0.05) 50%, rgba(212,180,131,0.09) 100%)",
                border: "1px solid rgba(212,180,131,0.55)",
                boxShadow: "inset 0 1px 0 rgba(212,180,131,0.18), inset 0 0 0 3px rgba(212,180,131,0.07)",
                cursor: "pointer",
              }}>
                {/* Schrauben */}
                {([
                  { top: "5px", left: "7px" },
                  { top: "5px", right: "7px" },
                  { bottom: "5px", left: "7px" },
                  { bottom: "5px", right: "7px" },
                ] as React.CSSProperties[]).map((pos, i) => (
                  <div key={i} style={{
                    position: "absolute",
                    ...pos,
                    width: "5px",
                    height: "5px",
                    borderRadius: "50%",
                    background: "radial-gradient(circle at 35% 35%, rgba(212,180,131,0.9), rgba(212,180,131,0.3))",
                    boxShadow: "0 0 2px rgba(0,0,0,0.4)",
                  }} />
                ))}
                <span style={{
                  fontFamily: "var(--font-playfair), Georgia, serif",
                  fontSize: "0.95rem",
                  color: "var(--g-gold)",
                  fontStyle: "italic",
                  letterSpacing: "0.05em",
                }}>
                  {topic}
                </span>
                {/* Chevron */}
                <svg
                  width="10" height="6" viewBox="0 0 10 6" fill="none"
                  style={{ position: "absolute", right: "14px", opacity: 0.55, transition: "transform 0.2s", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
                >
                  <path d="M1 1l4 4 4-4" stroke="#d4b483" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              {!isCollapsed && <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {grouped[topic].map((task) => {
                  const date = formatDate(task.due_date);
                  return (
                    <div
                      key={task.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.85rem",
                        padding: "0.7rem 0.6rem 0.7rem 0.9rem",
                        borderLeft: `2px solid ${task.status === "done" ? "rgba(212,180,131,0.2)" : PRIORITY_COLOR[task.priority] ?? "var(--g-muted)"}`,
                        borderBottom: "1px solid var(--g-border)",
                        opacity: task.status === "done" ? 0.45 : 1,
                        transition: "opacity 0.2s",
                      }}
                    >
                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: "0.875rem",
                          lineHeight: "1.55",
                          color: "var(--g-text)",
                          textDecoration: task.status === "done" ? "line-through" : "none",
                          margin: 0,
                        }}>
                          {task.title}
                        </p>
                        {date && (
                          <p style={{
                            fontSize: "0.7rem",
                            color: date.tone === "urgent" ? "#c0392b" : date.tone === "today" ? "var(--g-gold)" : "var(--g-muted)",
                            fontStyle: "italic",
                            marginTop: "0.25rem",
                            lineHeight: 1.4,
                          }}>
                            {date.text}
                          </p>
                        )}
                        {task.status === "snoozed" && (
                          <p style={{ fontSize: "0.7rem", color: "var(--g-muted)", fontStyle: "italic", marginTop: "0.2rem" }}>
                            Zurückgestellt. Man wartet ab.
                          </p>
                        )}
                      </div>

                      {/* Toggle — Siegel statt Checkbox */}
                      <button
                        onClick={() => toggleStatus(task)}
                        title={task.status === "done" ? "Als offen markieren" : "Als erledigt markieren"}
                        style={{
                          background: task.status === "done" ? "rgba(212,180,131,0.15)" : "transparent",
                          border: `1px solid ${task.status === "done" ? "rgba(212,180,131,0.6)" : "rgba(212,180,131,0.25)"}`,
                          width: "16px",
                          height: "16px",
                          borderRadius: "50%",
                          flexShrink: 0,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.2s",
                        }}
                      >
                        {task.status === "done" && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="var(--g-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>}
            </div>
            );
          })
        )}
      </div>

      {/* Floating Chat Button */}
      <Link
        href="/"
        style={{
          position: "fixed",
          bottom: "1.5rem",
          left: "1.5rem",
          background: "var(--g-bg)",
          border: "1px solid var(--g-gold)",
          color: "var(--g-gold)",
          fontFamily: "var(--font-playfair), Georgia, serif",
          fontSize: "0.7rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          textDecoration: "none",
          padding: "0.7rem 1.4rem",
          fontWeight: 400,
          zIndex: 50,
          fontStyle: "italic",
        }}
      >
        Zum Butler
      </Link>
    </div>
  );
}
