"use client";
// Copyright © 2026 Workforce. All rights reserved.
// Updates last_seen_at in DB on any user interaction (throttled to once/min).
// Mounted inside DashboardShell so it runs on every authenticated page.

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export function ActivityTracker() {
  const lastUpdateRef = useRef(0);
  const supabase = createClient();

  useEffect(() => {
    async function updateActivity() {
      const now = Date.now();
      if (now - lastUpdateRef.current < 60_000) return;
      lastUpdateRef.current = now;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      supabase
        .from("users")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("auth_id", user.id)
        .then(() => {}, () => {});
    }

    document.addEventListener("click", updateActivity, { passive: true });
    document.addEventListener("touchstart", updateActivity, { passive: true });
    document.addEventListener("keydown", updateActivity, { passive: true });

    return () => {
      document.removeEventListener("click", updateActivity);
      document.removeEventListener("touchstart", updateActivity);
      document.removeEventListener("keydown", updateActivity);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
