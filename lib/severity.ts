// Copyright © 2026 Workforce. All rights reserved.

import type { SeverityInput } from "@/types/database";

export function calculateSeverityScore(input: SeverityInput): number {
  const { labor_amount, supplier_amount, labor_event_count, supplier_event_count } = input;
  const total_amount = labor_amount + supplier_amount;
  const total_events = labor_event_count + supplier_event_count;

  if (total_amount === 0 || total_events === 0) return 0;

  const labor_score =
    (labor_amount / total_amount) * 70 +
    (labor_event_count / total_events) * 30;

  const supplier_score =
    (supplier_amount / total_amount) * 70 +
    (supplier_event_count / total_events) * 30;

  // Tie-break: labor wins
  const score = labor_score >= supplier_score ? labor_score : supplier_score;
  return Math.round(score);
}

export function severityColor(score: number): string {
  if (score >= 80) return "text-red-600";
  if (score >= 60) return "text-orange-500";
  if (score >= 40) return "text-amber-500";
  return "text-green-600";
}
