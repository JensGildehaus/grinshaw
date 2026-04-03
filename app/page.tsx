"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { InstallPrompt } from "./components/InstallPrompt";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const router = useRouter();
  const supabase = createClient();

  function toggleVoice() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SR();
    recognition.lang = "de-DE";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev: string) => prev ? prev + " " + transcript : transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognition.start();
    setListening(true);
  }


  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.ready.then(async (reg) => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });
      await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub) });
    });
  }, []);

  async function send(e: React.SyntheticEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages([...next, { role: "assistant", content: `[Fehler: ${data.error}]` }]);
      } else {
        setMessages([...next, { role: "assistant", content: data.content }]);
      }
    } catch (err) {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: `[Netzwerkfehler: ${err instanceof Error ? err.message : String(err)}]`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
    <InstallPrompt />
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
          padding: "1rem 1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxSizing: "border-box",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-playfair), Georgia, serif",
            fontSize: "1.2rem",
            letterSpacing: "0.12em",
            color: "var(--g-gold)",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          Grinshaw
        </span>
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
          <a
            href="/angelegenheiten"
            className="nav-angelegenheiten-header"
            style={{
              fontSize: "0.72rem",
              color: "var(--g-muted)",
              letterSpacing: "0.06em",
              textDecoration: "none",
              fontFamily: "var(--font-playfair), Georgia, serif",
              textTransform: "uppercase",
            }}
          >
            Angelegenheiten
          </a>
          <button
            onClick={logout}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--g-muted)",
              fontSize: "0.72rem",
              cursor: "pointer",
              fontFamily: "inherit",
              letterSpacing: "0.04em",
            }}
          >
            Abmelden
          </button>
        </div>
      </header>

      {/* Butler + Chat */}
      <div
        style={{
          width: "100%",
          maxWidth: "640px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "0 1.5rem",
          boxSizing: "border-box",
        }}
      >
        {/* Butler-Figur */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "1.5rem 0 0.75rem",
            flexShrink: 0,
          }}
        >
          <div style={{ position: "relative", marginBottom: "0.75rem" }}>
            <div style={{
              position: "absolute",
              inset: "-30px",
              background: "radial-gradient(circle, rgba(212,180,131,0.18) 0%, transparent 70%)",
              borderRadius: "50%",
              pointerEvents: "none",
            }} />
            <Image
              src="/avatar-transparent.png"
              alt="Grinshaw"
              width={220}
              height={330}
              className="butler-img"
              style={{
                objectFit: "contain",
                width: "auto",
                position: "relative",
              }}
              priority
            />
          </div>
          <a
            href="/angelegenheiten"
            className="nav-angelegenheiten-mobile"
            style={{
              fontSize: "0.65rem",
              color: "var(--g-gold)",
              letterSpacing: "0.08em",
              textDecoration: "none",
              fontFamily: "var(--font-playfair), Georgia, serif",
              textTransform: "uppercase",
              marginBottom: "0.5rem",
              opacity: 0.7,
            }}
          >
            Angelegenheiten
          </a>
          {messages.length === 0 && (
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--g-text)",
                textAlign: "center",
                maxWidth: "320px",
                lineHeight: "1.7",
                fontStyle: "italic",
              }}
            >
              „Ah. Sie sind es."
            </p>
          )}
        </div>

        {/* Nachrichten */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                marginBottom: "1.25rem",
                display: "flex",
                gap: "0.75rem",
                alignItems: "flex-start",
                flexDirection: m.role === "user" ? "row-reverse" : "row",
              }}
            >
              {m.role === "assistant" && (
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    overflow: "hidden",
                    flexShrink: 0,
                    border: "1px solid var(--g-border)",
                    marginTop: "2px",
                  }}
                >
                  <Image
                    src="/butler.png"
                    alt="Grinshaw"
                    width={40}
                    height={40}
                    style={{ objectFit: "cover", width: "100%", height: "100%" }}
                  />
                </div>
              )}
              <div
                style={{
                  maxWidth: "80%",
                  padding: "0.65rem 0.9rem",
                  borderRadius: "4px",
                  fontSize: "0.875rem",
                  lineHeight: "1.7",
                  background:
                    m.role === "user"
                      ? "rgba(0,0,0,0.2)"
                      : "transparent",
                  border:
                    m.role === "user"
                      ? "1px solid var(--g-border)"
                      : "none",
                  color: "var(--g-text)",
                }}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div
              style={{
                marginBottom: "1.25rem",
                display: "flex",
                gap: "0.75rem",
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  flexShrink: 0,
                  border: "1px solid var(--g-border)",
                }}
              >
                <Image
                  src="/avatar.png"
                  alt="Grinshaw"
                  width={28}
                  height={28}
                  style={{ objectFit: "cover", width: "100%", height: "100%" }}
                />
              </div>
              <p
                style={{
                  fontSize: "0.82rem",
                  color: "var(--g-text)",
                  fontStyle: "italic",
                  marginTop: "4px",
                }}
              >
                …denkt nach. Widerwillig, aber pflichtbewusst.
              </p>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <form
        onSubmit={send}
        style={{
          width: "100%",
          maxWidth: "640px",
          padding: "1rem 1.5rem 1.5rem",
          flexShrink: 0,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            borderTop: "1px solid var(--g-border)",
            paddingTop: "1rem",
          }}
        >
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (input.trim() && !loading) send(e);
              }
            }}
            placeholder="Ihr Anliegen, bitte…"
            disabled={loading}
            rows={1}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              borderBottom: "1px solid var(--g-border)",
              color: "var(--g-text)",
              fontSize: "0.875rem",
              padding: "0.35rem 0",
              outline: "none",
              fontFamily: "inherit",
              resize: "none",
              overflow: "hidden",
              lineHeight: "1.5",
            }}
          />
          <button
            type="button"
            onClick={toggleVoice}
            title={listening ? "Aufnahme stoppen" : "Sprechen"}
            style={{
              background: "transparent",
              border: "none",
              color: listening ? "var(--g-gold)" : "var(--g-muted)",
              cursor: "pointer",
              padding: "0.35rem 0.25rem",
              fontSize: "1rem",
              lineHeight: 1,
              transition: "color 0.2s",
              flexShrink: 0,
            }}
          >
            {listening ? "⏹" : "🎙"}
          </button>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{
              background: "transparent",
              border: "1px solid var(--g-border)",
              color: "var(--g-gold)",
              fontSize: "0.7rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "0.35rem 1rem",
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              opacity: loading || !input.trim() ? 0.4 : 1,
              fontFamily: "var(--font-playfair), Georgia, serif",
              transition: "opacity 0.2s",
              whiteSpace: "nowrap",
            }}
          >
            Senden
          </button>
        </div>
      </form>
    </div>
    </>
  );
}
