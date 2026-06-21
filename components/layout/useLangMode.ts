"use client";

import { useEffect, useState } from "react";

export type LangMode = "th-primary" | "en-primary" | "th-only";

const LANG_MODE_KEY = "wf_lang_mode";

function readLangMode(): LangMode {
  if (typeof window === "undefined") return "th-primary";
  const value = window.localStorage.getItem(LANG_MODE_KEY);
  if (value === "en-primary" || value === "th-only") return value;
  return "th-primary";
}

export function useLangMode() {
  const [langMode, setLangMode] = useState<LangMode>("th-primary");

  useEffect(() => {
    setLangMode(readLangMode());

    function onLangChange(event: Event) {
      const next = (event as CustomEvent<LangMode>).detail;
      setLangMode(next ?? readLangMode());
    }

    function onStorage(event: StorageEvent) {
      if (event.key === LANG_MODE_KEY) setLangMode(readLangMode());
    }

    window.addEventListener("wf-lang-change", onLangChange);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("wf-lang-change", onLangChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return langMode;
}

export function getBilingualLabel(langMode: LangMode, th: string, en: string) {
  if (langMode === "en-primary") {
    return { primary: en, secondary: th };
  }

  if (langMode === "th-only") {
    return { primary: th, secondary: "" };
  }

  return { primary: th, secondary: en };
}
