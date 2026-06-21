"use client";
// Copyright © 2026 Workforce. All rights reserved.
// Thin progress bar at top of screen during route transitions.

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const prevPath = useRef(pathname);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (pathname === prevPath.current) return;
    prevPath.current = pathname;

    // Start bar
    setWidth(0);
    setVisible(true);

    // Animate to ~85% quickly, then pause (server fetch happening)
    let w = 0;
    const tick = () => {
      w = w < 30 ? w + 8 : w < 60 ? w + 3 : w < 85 ? w + 0.8 : w;
      setWidth(Math.min(w, 85));
      if (w < 85) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    // Complete after a short delay (page rendered)
    timerRef.current = setTimeout(() => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setWidth(100);
      setTimeout(() => setVisible(false), 300);
    }, 500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: 3,
        width: `${width}%`,
        background: "linear-gradient(90deg, #6C5CE7, #8B7CF6)",
        zIndex: 9999,
        transition: width === 100 ? "width 0.2s ease-out, opacity 0.3s" : "width 0.15s ease-out",
        opacity: visible ? 1 : 0,
        borderRadius: "0 2px 2px 0",
        boxShadow: "0 0 8px rgba(108,92,231,0.6)",
      }}
    />
  );
}
