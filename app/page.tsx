"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import type { Task } from "@/lib/types";

const PRIORITY_LABEL: Record<number, string> = {
  1: "Dringend",
  2: "Mittel",
  3: "Nachrangig",
};

const PRIORITY_COLOR: Record<number, string> = {
  1: "#c0392b",
  2: "var(--g-gold)",
  3: "var(--g-muted)",
};

function isOverdue(due: string | null): boolean {
  if (!due) return false;
  return new Date(due) < new Date(new Date().setHours(0, 0, 0, 0));
}

function isDueToday(due: string | null): boolean {
  if (!due) return false;
  const d = new Date(due);
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function formatDue(due: string | null): string | null {
  if (!due) return null;
  if (isDueToday(due)) return "Heute";
  if (isOverdue(due)) {
    const d = new Date(due);
    return `Überfällig seit ${d.toLocaleDateString("de-DE", { day: "numeric", month: "short" })}`;
  }
  return new Date(due).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
  });
}

const GRINSHAW_DONE = [
  "Es ist vollbracht. Ich empfehle, das Ergebnis nicht übermäßig zu hinterfragen.",
  "Erledigt. Ich gestehe, dass ich mit weniger gerechnet hatte.",
  "Die Aufgabe ist abgeschlossen — ein Umstand, der mich, ich will es nicht verhehlen, leicht überrascht.",
];

const GRINSHAW_ADDED = [
  "Eingetragen. Ob Sie es auch erledigen werden, bleibt, wie stets, abzuwarten.",
  "Ich habe es vermerkt. Die Zuversicht, die das erfordert, beeindruckt mich auf eine mir fremde Weise.",
  "Notiert. Ich wünsche Ihnen Erfolg — in dem Maße, in dem dieser Wunsch realistisch ist.",
];

function randomFrom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [addTitle, setAddTitle] = useState("");
  const [addPriority, setAddPriority] = useState<1 | 2 | 3>(2);
  const [addDue, setAddDue] = useState("");
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .order("priority", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    setTasks((data as Task[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  async function addTask(e: React.SyntheticEvent) {
    e.preventDefault();
    const title = addTitle.trim();
    if (!title) return;
    setAdding(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("tasks").insert({
      title,
      priority: addPriority,
      due_date: addDue || null,
      user_id: user.id,
    });

    setAddTitle("");
    setAddPriority(2);
    setAddDue("");
    setAdding(false);
    showToast(randomFrom(GRINSHAW_ADDED));
    fetchTasks();
  }

  async function toggleDone(task: Task) {
    const newStatus = task.status === "done" ? "open" : "done";
    await supabase.from("tasks").update({ status: newStatus }).eq("id", task.id);
    if (newStatus === "done") showToast(randomFrom(GRINSHAW_DONE));
    fetchTasks();
  }

  async function deleteTask(id: string) {
    await supabase.from("tasks").delete().eq("id", id);
    fetchTasks();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const openTasks = tasks.filter((t) => t.status === "open");
  const doneTasks = tasks.filter((t) => t.status === "done");
  const overdueTasks = openTasks.filter((t) => isOverdue(t.due_date));

  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Header */}
      <header
        style={{
          width: "100%",
          borderBottom: "1px solid var(--g-border)",
          padding: "1.25rem 1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxSizing: "border-box",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-playfair), Georgia, serif",
            fontSize: "1.4rem",
            letterSpacing: "0.12em",
            color: "var(--g-gold)",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          Grinshaw
        </span>
        <button
          onClick={logout}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--g-muted)",
            fontSize: "0.75rem",
            cursor: "pointer",
            letterSpacing: "0.05em",
            fontFamily: "inherit",
          }}
        >
          Abmelden
        </button>
      </header>

      <div style={{ width: "100%", maxWidth: "640px", padding: "2rem 1.5rem", boxSizing: "border-box" }}>

        {/* Überfällig-Banner */}
        {overdueTasks.length > 0 && (
          <div
            style={{
              border: "1px solid rgba(192,57,43,0.35)",
              borderRadius: "4px",
              padding: "0.75rem 1rem",
              marginBottom: "1.75rem",
              fontSize: "0.82rem",
              color: "#e07070",
              lineHeight: "1.6",
            }}
          >
            Ich erlaube mir, dezent darauf hinzuweisen, dass{" "}
            {overdueTasks.length === 1
              ? "eine Aufgabe"
              : `${overdueTasks.length} Aufgaben`}{" "}
            Ihrer Aufmerksamkeit harr{overdueTasks.length === 1 ? "t" : "en} — und dies nicht erst seit gestern."}
          </div>
        )}

        {/* Neue Aufgabe */}
        <form
          onSubmit={addTask}
          style={{
            marginBottom: "2rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <input
            type="text"
            value={addTitle}
            onChange={(e) => setAddTitle(e.target.value)}
            placeholder="Neue Aufgabe…"
            style={{
              background: "transparent",
              border: "none",
              borderBottom: "1px solid var(--g-border)",
              color: "var(--g-text)",
              fontSize: "0.95rem",
              padding: "0.4rem 0",
              outline: "none",
              fontFamily: "inherit",
              width: "100%",
            }}
          />
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={addPriority}
              onChange={(e) => setAddPriority(Number(e.target.value) as 1 | 2 | 3)}
              style={{
                background: "var(--g-bg)",
                border: "1px solid var(--g-border)",
                color: "var(--g-text)",
                fontSize: "0.78rem",
                padding: "0.3rem 0.5rem",
                outline: "none",
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              <option value={1}>Dringend</option>
              <option value={2}>Mittel</option>
              <option value={3}>Nachrangig</option>
            </select>
            <input
              type="date"
              value={addDue}
              onChange={(e) => setAddDue(e.target.value)}
              style={{
                background: "var(--g-bg)",
                border: "1px solid var(--g-border)",
                color: addDue ? "var(--g-text)" : "var(--g-muted)",
                fontSize: "0.78rem",
                padding: "0.3rem 0.5rem",
                outline: "none",
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            />
            <button
              type="submit"
              disabled={adding || !addTitle.trim()}
              style={{
                marginLeft: "auto",
                background: "transparent",
                border: "1px solid var(--g-border)",
                color: "var(--g-gold)",
                fontSize: "0.72rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                padding: "0.35rem 0.85rem",
                cursor: adding || !addTitle.trim() ? "not-allowed" : "pointer",
                opacity: adding || !addTitle.trim() ? 0.4 : 1,
                fontFamily: "var(--font-playfair), Georgia, serif",
                transition: "opacity 0.2s",
                whiteSpace: "nowrap",
              }}
            >
              Eintragen
            </button>
          </div>
        </form>

        {/* Task-Liste */}
        {loading ? (
          <p style={{ color: "var(--g-muted)", fontSize: "0.85rem" }}>
            Ich rufe die Unterlagen herbei…
          </p>
        ) : openTasks.length === 0 ? (
          <p
            style={{
              color: "var(--g-muted)",
              fontSize: "0.85rem",
              lineHeight: "1.6",
            }}
          >
            Sie haben derzeit keine offenen Aufgaben. Dies ist entweder ein
            seltenes Zeichen von Effizienz oder ein bedenkliches von
            Vergesslichkeit. Ich neige zur zweiten Deutung.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0" }}>
            {openTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={toggleDone}
                onDelete={deleteTask}
              />
            ))}
          </ul>
        )}

        {/* Erledigte */}
        {doneTasks.length > 0 && (
          <div style={{ marginTop: "2.5rem" }}>
            <button
              onClick={() => setShowDone((v) => !v)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--g-muted)",
                fontSize: "0.72rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
                fontFamily: "var(--font-playfair), Georgia, serif",
                padding: 0,
                marginBottom: "1rem",
              }}
            >
              {showDone ? "Erledigte ausblenden" : `Erledigte anzeigen (${doneTasks.length})`}
            </button>
            {showDone && (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0", opacity: 0.5 }}>
                {doneTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={toggleDone}
                    onDelete={deleteTask}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "2rem",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.75)",
            border: "1px solid var(--g-border)",
            color: "var(--g-text)",
            fontSize: "0.8rem",
            padding: "0.75rem 1.25rem",
            borderRadius: "4px",
            maxWidth: "480px",
            textAlign: "center",
            lineHeight: "1.5",
            backdropFilter: "blur(8px)",
            zIndex: 100,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: (t: Task) => void;
  onDelete: (id: string) => void;
}) {
  const due = formatDue(task.due_date);
  const overdue = isOverdue(task.due_date) && task.status === "open";
  const today = isDueToday(task.due_date) && task.status === "open";

  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.75rem",
        padding: "0.85rem 0",
        borderBottom: "1px solid var(--g-border)",
      }}
    >
      <button
        onClick={() => onToggle(task)}
        aria-label={task.status === "done" ? "Wieder öffnen" : "Abhaken"}
        style={{
          marginTop: "2px",
          flexShrink: 0,
          width: "16px",
          height: "16px",
          border: `1px solid ${task.status === "done" ? "var(--g-border)" : PRIORITY_COLOR[task.priority]}`,
          borderRadius: "2px",
          background: task.status === "done" ? "var(--g-border)" : "transparent",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {task.status === "done" && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3L3.5 5.5L8 1" stroke="var(--g-bg)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: "0.9rem",
            color: task.status === "done" ? "var(--g-muted)" : "var(--g-text)",
            textDecoration: task.status === "done" ? "line-through" : "none",
            lineHeight: "1.4",
          }}
        >
          {task.title}
        </p>
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: "0.68rem",
              color: PRIORITY_COLOR[task.priority],
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {PRIORITY_LABEL[task.priority]}
          </span>
          {due && (
            <span
              style={{
                fontSize: "0.68rem",
                color: overdue ? "#e07070" : today ? "var(--g-gold)" : "var(--g-muted)",
                letterSpacing: "0.04em",
              }}
            >
              {due}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={() => onDelete(task.id)}
        aria-label="Löschen"
        style={{
          background: "transparent",
          border: "none",
          color: "var(--g-muted)",
          cursor: "pointer",
          fontSize: "1rem",
          lineHeight: 1,
          padding: "2px 4px",
          opacity: 0.4,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </li>
  );
}
