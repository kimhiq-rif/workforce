"use client";

import { useEffect, useState } from "react";
import { IntroSplash } from "@/components/IntroSplash";

const INTRO_SEEN_KEY = "workforce:intro-seen";
const INTRO_DURATION_MS = 2150;
const REDUCED_MOTION_DURATION_MS = 1100;

export function IntroSplashGate() {
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const alreadySeen = window.sessionStorage.getItem(INTRO_SEEN_KEY) === "1";
    if (alreadySeen) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = prefersReducedMotion ? REDUCED_MOTION_DURATION_MS : INTRO_DURATION_MS;

    window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    setShowIntro(true);

    const timeout = window.setTimeout(() => {
      setShowIntro(false);
    }, duration);

    return () => window.clearTimeout(timeout);
  }, []);

  function finishIntro() {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    }

    setShowIntro(false);
  }

  if (!showIntro) return null;

  return <IntroSplash onDone={finishIntro} />;
}
