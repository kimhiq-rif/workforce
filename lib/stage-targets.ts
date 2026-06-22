// Copyright © 2026 Workforce. All rights reserved.
// Shared helper: which active long-project sites have a current stage with no
// target_end_date. Used by the midnight nag, the 08:00/16:30 reminders, and the
// owner soft-block. The target lives on site_stages.target_end_date (NOT on the
// sites row).
import type { createServiceClient } from "@/lib/supabase/server";

type DbClient = ReturnType<typeof createServiceClient>;

export interface SiteMissingStageTarget {
  siteId: string;
  siteNameTh: string;
  siteNameEn: string | null;
  /** When the current stage started (or was created) — basis for "overdue" age. */
  stageSince: string | null;
}

export async function sitesMissingStageTarget(
  supabase: DbClient,
  ownerId: string
): Promise<SiteMissingStageTarget[]> {
  const { data } = await supabase
    .from("site_stages")
    .select("site_id, started_at, created_at, site:site_id(id, name_th, name_en, is_active, project_type)")
    .eq("owner_id", ownerId)
    .eq("is_current", true)
    .is("target_end_date", null);

  if (!data) return [];

  const rows: SiteMissingStageTarget[] = [];
  for (const row of data as any[]) {
    const site = row.site;
    if (!site || !site.is_active || site.project_type !== "long") continue;
    rows.push({
      siteId: site.id,
      siteNameTh: site.name_th,
      siteNameEn: site.name_en ?? null,
      stageSince: row.started_at ?? row.created_at ?? null,
    });
  }
  return rows;
}

/** Days since a date string/ISO; 0 if null. */
export function daysSince(iso: string | null): number {
  if (!iso) return 0;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.floor((Date.now() - then) / 86_400_000);
}
