"use client";
// Copyright © 2026 Workforce. All rights reserved.
// Reads wf_lang_mode from localStorage and sets data-lang on <html>.
// Re-applies on every route change (usePathname) because Next.js App Router
// can reset <html> attributes during soft navigation.

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function applyLang(mode?: string) {
  const value = mode ?? localStorage.getItem("wf_lang_mode") ?? "th-primary";
  document.documentElement.setAttribute("data-lang", value);
}

export function LangModeApplier() {
  const pathname = usePathname();

  // Re-apply on every route change
  useEffect(() => {
    applyLang();
  }, [pathname]);

  // Listen for same-tab toggle and cross-tab storage changes
  useEffect(() => {
    function onLangChange(e: Event) {
      applyLang((e as CustomEvent<string>).detail);
    }
    function onStorage() {
      applyLang();
    }

    window.addEventListener("wf-lang-change", onLangChange);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("wf-lang-change", onLangChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
