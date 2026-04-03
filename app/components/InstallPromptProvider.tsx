"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallPromptContextType {
  deferredPrompt: BeforeInstallPromptEvent | null;
  clearPrompt: () => void;
}

const InstallPromptContext = createContext<InstallPromptContextType>({
  deferredPrompt: null,
  clearPrompt: () => {},
});

export function useInstallPrompt() {
  return useContext(InstallPromptContext);
}

export function InstallPromptProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Bereits vor React-Mount gefangen?
    const early = (window as Window & { __grinshawInstallPrompt?: BeforeInstallPromptEvent }).__grinshawInstallPrompt;
    if (early) setDeferredPrompt(early);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  return (
    <InstallPromptContext.Provider value={{ deferredPrompt, clearPrompt: () => setDeferredPrompt(null) }}>
      {children}
    </InstallPromptContext.Provider>
  );
}
