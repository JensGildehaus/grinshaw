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
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("grinshaw-chat");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [weather, setWeather] = useState<string | null>(null);

  const GREETINGS = [
    '„Ah. Sie sind es."',
    '„Man ist da. Was auch immer das wert sein mag."',
    '„Man hat gewartet. Es fiel nicht schwer."',
    '„Man ist zur Stelle. Wie gewohnt."',
    '„Man hat die Türe nicht gehört. Dennoch ist man hier."',
    '„Man tritt ein. Bitte erschrecken Sie nicht."',
    '„Man steht zur Verfügung. Wie immer."',
    '„Man ist nicht überrascht."',
    '„Man registriert Ihre Anwesenheit. Mit stiller Fassung."',
    '„Man hatte Erwartungen. Man hat gelernt, sie abzulegen."',
    '„Ah. Man war informiert, dass Sie kommen würden."',
    '„Man ist bereit. Soweit man das beurteilen kann."',
    '„Man hat sich die Freiheit genommen, bereits hier zu sein."',
    '„Sie erscheinen. Man nimmt das zur Kenntnis."',
    '„Man war in der Nähe. Was für ein glücklicher Zufall."',
    '„Man ist anwesend. Was man von anderen nicht immer behaupten kann."',
    '„Ah. Der Tag beginnt. Man hat sich damit abgefunden."',
    '„Man ist vorbereitet. Auf das Unvermeidliche."',
    '„Man begrüßt Sie. Mit der Wärme, die die Situation erfordert."',
    '„Man ist stets gern zu Diensten."',
  ];
  const rand = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  const [greeting] = useState(() => rand(GREETINGS));
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
    function fetchWeather(lat: number, lon: number) {
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&timezone=auto`)
        .then((r) => r.json())
        .then((d) => {
          const temp = Math.round(d.current.temperature_2m);
          const code = d.current.weathercode as number;
          const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
          const comment =
            code === 0 ? pick([
              'Wolkenlos. Eine angenehme Überraschung, die man nicht überbewerten sollte.',
              'Klarer Himmel. Man genießt ihn mit der üblichen Zurückhaltung.',
              'Sonnenschein. Man empfiehlt, ihn zu nutzen — er ist selten und flüchtig.',
              'Schönes Wetter. Man hält das für verdächtig.',
              'Strahlend. Man ist misstrauisch.',
            ]) :
            code <= 2 ? pick([
              'Leicht bewölkt. Die Natur hält sich bedeckt. Wie es sich gehört.',
              'Ein paar Wolken. Man findet das angemessen ausgewogen.',
              'Teils bewölkt. Wie die meisten Aussichten.',
              'Wechselhaft. Man ist vorbereitet. Auf beides.',
            ]) :
            code === 3 ? pick([
              'Bedeckt. Man hatte nichts anderes erwartet.',
              'Grau. Man findet das ehrlich.',
              'Wolkendecke. Man zieht es vor, nicht hinaufzusehen.',
              'Bedeckt. Die Natur drückt sich unmissverständlich aus.',
              'Trüb. Man findet das passend.',
            ]) :
            code <= 48 ? pick([
              'Neblig. Man findet das angemessen.',
              'Nebel. Man sieht nicht weit. Das hat auch Vorteile.',
              'Nebel. Man empfiehlt, keine weitreichenden Pläne zu machen.',
              'Neblig. Die Welt hält sich bedeckt. Man respektiert das.',
            ]) :
            code <= 57 ? pick([
              'Nieselregen. Man empfiehlt, die Erwartungen wasserfest zu gestalten.',
              'Es nieselt. Man hat es kommen sehen. Buchstäblich.',
              'Nieselregen. Nicht genug um zu klagen, aber genug um es zu wollen.',
              'Es tröpfelt. Man nennt das im Haushalt: Dienstag.',
            ]) :
            code <= 67 ? pick([
              'Regen. Man hatte es nicht anders erwartet.',
              'Es regnet. Man empfiehlt Resignation — sie ist wetterfest.',
              'Regen. Man findet, die Natur drückt sich heute besonders klar aus.',
              'Regen. Man bleibt. Drinnen. Vorzugsweise.',
              'Regen. Man ist nicht überrascht. Man ist nie überrascht.',
            ]) :
            code <= 77 ? pick([
              'Schnee. Man ist gerüstet. Emotional.',
              'Schneefall. Man findet das still und würdevoll — im Gegensatz zu vielem anderen.',
              'Schnee. Man empfiehlt, die Erwartungen an den Tag entsprechend zu drosseln.',
              'Es schneit. Man hat keine Einwände.',
            ]) :
            code <= 82 ? pick([
              'Schauer. Man empfiehlt Zurückhaltung — in allen Belangen.',
              'Regenschauer. Man wartet ab. Wie bei so vielem.',
              'Schauer. Man war vorbereitet. Man ist immer vorbereitet.',
              'Schauer. Man geht nicht hinaus. Freiwillig.',
            ]) :
            pick([
              'Gewitter. Man zieht sich klug zurück.',
              'Gewitter. Man findet das dramatisch. Passend.',
              'Gewitter. Man empfiehlt, nichts Wichtiges nach draußen zu bringen — einschließlich Erwartungen.',
              'Gewitter. Man bleibt. Die Alternative wäre unklug.',
            ]);
          setWeather(`${temp}°C · ${comment}`);
        })
        .catch(() => {});
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => fetchWeather(51.2977, 6.8497)
      );
    } else {
      fetchWeather(51.2977, 6.8497);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    localStorage.setItem("grinshaw-chat", JSON.stringify(messages));
  }, [messages]);

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
    if (textareaRef.current) textareaRef.current.style.height = "auto";
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
    } catch {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: "[Man kann die Verbindung derzeit nicht herstellen. Man wartet ab.]",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    localStorage.removeItem("grinshaw-chat");
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
    <InstallPrompt />
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflow: "hidden",
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
              color: "var(--g-text)",
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
              fontSize: "0.65rem",
              cursor: "pointer",
              fontFamily: "inherit",
              letterSpacing: "0.02em",
              opacity: 0.7,
            }}
          >
            Entlassen
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
            display: messages.length > 0 ? "none" : "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "1.5rem 0 0.75rem",
            flexShrink: 0,
            flex: 1,
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
          {messages.length === 0 && (
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  fontSize: "0.82rem",
                  color: "var(--g-text)",
                  maxWidth: "320px",
                  lineHeight: "1.7",
                  fontStyle: "italic",
                  margin: "0 0 0.4rem",
                }}
              >
                {greeting}
              </p>
              {weather && (
                <p style={{
                  fontSize: "0.82rem",
                  color: "var(--g-text)",
                  fontStyle: "italic",
                  maxWidth: "320px",
                  lineHeight: "1.7",
                  margin: "0 auto",
                }}>
                  {weather}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Nachrichten */}
        <div style={{ flex: messages.length > 0 ? 1 : "0 0 auto", overflowY: "auto", minHeight: 0 }}>
          {messages.map((m, i) => {
            const isFirstInGroup = i === 0 || messages[i - 1].role !== m.role;
            return (
            <div
              key={i}
              style={{
                marginBottom: isFirstInGroup ? "1.25rem" : "0.4rem",
                display: "flex",
                gap: "0.75rem",
                alignItems: "flex-start",
                flexDirection: m.role === "user" ? "row-reverse" : "row",
              }}
            >
              {m.role === "assistant" && (
                isFirstInGroup ? (
                  <div style={{ width: "48px", height: "48px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, marginTop: "2px" }}>
                    <Image src="/kopf-butler.png" alt="Grinshaw" width={48} height={48}
                      style={{ objectFit: "cover", width: "100%", height: "100%", transform: "scale(1.55)" }} />
                  </div>
                ) : (
                  <div style={{ width: "48px", flexShrink: 0 }} />
                )
              )}
              <div
                style={{
                  maxWidth: "78%",
                  padding: m.role === "user" ? "0.5rem 0.85rem" : "0.1rem 0 0.1rem 0.85rem",
                  fontSize: "0.875rem",
                  lineHeight: "1.75",
                  background: m.role === "user" ? "rgba(0,0,0,0.18)" : "transparent",
                  border: m.role === "user" ? "1px solid rgba(212,180,131,0.25)" : "none",
                  borderLeft: m.role === "assistant" ? "2px solid rgba(212,180,131,0.45)" : undefined,
                  color: "var(--g-text)",
                }}
              >
                {m.content}
              </div>
            </div>
            );
          })}

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
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                <Image
                  src="/kopf-butler.png"
                  alt="Grinshaw"
                  width={48}
                  height={48}
                  style={{ objectFit: "cover", width: "100%", height: "100%", transform: "scale(1.55)" }}
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
        <a
          href="/angelegenheiten"
          className="nav-angelegenheiten-mobile"
          style={{
            display: "block",
            textAlign: "center",
            fontSize: "0.65rem",
            color: "var(--g-gold)",
            letterSpacing: "0.1em",
            textDecoration: "none",
            fontFamily: "var(--font-playfair), Georgia, serif",
            textTransform: "uppercase",
            paddingBottom: "0.75rem",
            opacity: 0.7,
          }}
        >
          Angelegenheiten
        </a>
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            alignItems: "flex-end",
            borderTop: "1px solid rgba(212,180,131,0.4)",
            paddingTop: "1rem",
          }}
        >
          <textarea
            ref={textareaRef}
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
              fontSize: "1rem",
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
              opacity: listening ? 1 : 0.6,
              cursor: "pointer",
              padding: "0.35rem 0.25rem",
              fontSize: "1rem",
              lineHeight: 1,
              transition: "color 0.2s",
              flexShrink: 0,
            }}
          >
            {listening ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="4" y="4" width="8" height="8" rx="1" fill="#d4b483"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="6" y="1" width="4" height="7" rx="2" fill="#d4b483"/>
                <path d="M3 7a5 5 0 0010 0" stroke="#d4b483" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="8" y1="12" x2="8" y2="15" stroke="#d4b483" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            )}
          </button>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{
              background: input.trim() && !loading ? "var(--g-gold)" : "transparent",
              border: "1px solid var(--g-gold)",
              color: input.trim() && !loading ? "#1a2e20" : "var(--g-gold)",
              fontSize: "0.7rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "0.35rem 1rem",
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              opacity: loading ? 0.4 : 1,
              fontFamily: "var(--font-playfair), Georgia, serif",
              transition: "all 0.2s",
              whiteSpace: "nowrap",
              fontWeight: 700,
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
