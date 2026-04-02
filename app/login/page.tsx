"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.SyntheticEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(
        "Die Angaben erweisen sich als — nun, sagen wir: verbesserungswürdig."
      );
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: "360px" }}>
        <p
          style={{
            fontFamily: "var(--font-playfair), Georgia, serif",
            fontSize: "1.75rem",
            color: "var(--g-gold)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            textAlign: "center",
            marginBottom: "0.5rem",
            fontWeight: 700,
          }}
        >
          Grinshaw
        </p>
        <p
          style={{
            fontSize: "0.8rem",
            color: "var(--g-muted)",
            textAlign: "center",
            marginBottom: "2.5rem",
            lineHeight: "1.6",
          }}
        >
          „Ich war nicht sicher, ob Sie zurückkehren würden. Wie erfreulich
          unerwartet."
        </p>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.7rem",
                color: "var(--g-gold)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: "0.4rem",
                fontFamily: "var(--font-playfair), Georgia, serif",
              }}
            >
              E-Mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--g-border)",
                color: "var(--g-text)",
                fontSize: "0.9rem",
                padding: "0.4rem 0",
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.7rem",
                color: "var(--g-gold)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: "0.4rem",
                fontFamily: "var(--font-playfair), Georgia, serif",
              }}
            >
              Kennwort
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--g-border)",
                color: "var(--g-text)",
                fontSize: "0.9rem",
                padding: "0.4rem 0",
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--g-gold)",
                opacity: 0.7,
                lineHeight: "1.5",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "0.5rem",
              background: "transparent",
              border: "1px solid var(--g-border)",
              color: "var(--g-gold)",
              fontSize: "0.75rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "0.7rem 1rem",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.4 : 1,
              fontFamily: "var(--font-playfair), Georgia, serif",
              transition: "opacity 0.2s",
              width: "100%",
            }}
          >
            {loading ? "Einen Moment bitte…" : "Eintreten"}
          </button>
        </form>
      </div>
    </div>
  );
}
