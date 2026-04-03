"use client";

import { useEffect, useState } from "react";
import { useInstallPrompt } from "./InstallPromptProvider";

const DISMISSED_KEY = "grinshaw-install-dismissed";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches;
}

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

export function InstallPrompt() {
  const { deferredPrompt, clearPrompt } = useInstallPrompt();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isAndroid()) return;
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    setShow(true);
  }, []);

  if (!show || !deferredPrompt) return null;

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") clearPrompt();
    dismiss();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div style={{
        background: "#1e3526",
        border: "1px solid var(--g-border)",
        borderRadius: "12px 12px 0 0",
        padding: "2rem 1.5rem 2.5rem",
        width: "100%",
        maxWidth: "480px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1rem",
      }}>
        <div style={{ textAlign: "center" }}>
          <p style={{
            fontFamily: "var(--font-playfair), Georgia, serif",
            fontSize: "1.1rem",
            color: "var(--g-gold)",
            letterSpacing: "0.06em",
            marginBottom: "0.5rem",
          }}>
            Grinshaw als App
          </p>
          <p style={{ fontSize: "0.875rem", color: "var(--g-text)", lineHeight: 1.6, opacity: 0.8 }}>
            Direkt vom Homescreen — kein Browser, kein Chrome-Abzeichen.
          </p>
        </div>

        <button onClick={install} style={{
          width: "100%",
          padding: "0.85rem",
          background: "var(--g-gold)",
          color: "#1a2e20",
          border: "none",
          borderRadius: "4px",
          fontFamily: "var(--font-playfair), Georgia, serif",
          fontWeight: 700,
          fontSize: "0.875rem",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}>
          Installieren
        </button>

        <button onClick={dismiss} style={{
          background: "none",
          border: "none",
          color: "var(--g-muted)",
          fontSize: "0.8rem",
          cursor: "pointer",
          fontFamily: "inherit",
        }}>
          Später
        </button>
      </div>
    </div>
  );
}
