// Copyright © 2026 Workforce. All rights reserved.
// Proprietary and confidential.

export type UserRole = "owner" | "field_manager" | "technical_admin";
export type SiteStatus = "live" | "finished" | "rain" | "day_off" | "half_day" | "waiting" | "review";
export type WageReason =
  | "full_day"
  | "half_day_morning_departure"
  | "half_day_afternoon_arrival"
  | "half_day_rain"
  | "half_day_owner_decision"
  | "no_pay_rain_before_attendance"
  | "no_pay_day_off"
  | "pending_owner_decision";
export type WageDecision = "full_day" | "half_day" | "none" | "pending";
export type ReceiptStatus = "pending_qr" | "pending_payment" | "paid" | "needs_review";
export type AttendanceStatus = "on_site" | "late" | "missing" | "half_day_am" | "half_day_pm" | "day_off" | "rain";

export interface User {
  id: string;
  auth_id: string | null;
  owner_id: string | null;
  role: UserRole;
  name_th: string;
  name_en: string;
  phone: string | null;
  admin_code_hash: string | null;
  language_mode: string;
  session_timeout_hours: number;
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: string;
  owner_id: string;
  name_th: string;
  name_en: string;
  location_th: string | null;
  location_en: string | null;
  status: SiteStatus;
  manager_id: string | null;
  lat: number | null;
  lng: number | null;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  manager?: User;
}

export interface Worker {
  id: string;
  owner_id: string;
  name_th: string;
  name_en: string;
  role_th: string | null;
  role_en: string | null;
  daily_wage: number;
  is_temporary: boolean;
  assigned_site_id: string | null;
  photo_url: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  assigned_site?: Site;
}

export interface AttendanceEvent {
  id: string;
  owner_id: string;
  site_id: string;
  worker_id: string;
  reported_by: string | null;
  event_date: string;
  arrival_time: string | null;
  photo_url: string | null;
  photo_lat: number | null;
  photo_lng: number | null;
  status: AttendanceStatus;
  is_late: boolean;
  after_cutoff: boolean;
  wage_reason: WageReason | null;
  wage_amount: number | null;
  notes: string | null;
  created_at: string;
  // Joined
  worker?: Worker;
  site?: Site;
}

export interface SiteDayStatusEvent {
  id: string;
  owner_id: string;
  site_id: string;
  event_date: string;
  status: SiteStatus;
  set_by: string;
  set_at: string;
  set_before_attendance: boolean;
  rain_end_at: string | null;
  wage_decision: WageDecision;
  wage_reason: WageReason | null;
  wage_decided_at: string | null;
  wage_decided_by: string | null;
  cutoff_time: string | null;
  attendance_count_at_change: number;
  affected_worker_ids: string[] | null;
  notes: string | null;
  created_at: string;
}

export interface Supplier {
  id: string;
  owner_id: string;
  name_th: string;
  name_en: string;
  logo_initials: string | null;
  phone: string | null;
  contact_phone: string | null;
  category: string | null;
  qr_code_data: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Receipt {
  id: string;
  owner_id: string;
  site_id: string | null;
  supplier_id: string | null;
  receipt_number: string;
  amount: number | null;
  status: ReceiptStatus;
  qr_value: string | null;
  qr_image_url: string | null;
  source_photo_url: string | null;
  scanned_by: string | null;
  scanned_at: string | null;
  paid_at: string | null;
  paid_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  supplier?: Supplier;
  site?: Site;
}

export interface Advance {
  id: string;
  owner_id: string;
  worker_id: string;
  site_id: string | null;
  amount: number;
  status: "pending" | "paid";
  reason: string | null;
  created_by: string | null;
  notes: string | null;
  created_at: string;
  // Joined
  worker?: Worker;
}

export interface WorkdaySettings {
  id: string;
  owner_id: string;
  attendance_opens: string | null;
  workday_start: string | null;
  workday_end: string | null;
  start_time: string;
  end_time: string;
  late_threshold_minutes: number;
  half_day_cutoff_time: string;
  rain_block_after: string;
  daily_wage_default: number;
  daily_reset: string | null;
  timezone: string | null;
  updated_at: string;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

// ─── Derived / computed types ─────────────────────────────────────────────────

export interface SiteWithStats extends Site {
  today_reported: number;
  today_expected: number;
  today_workers: number;
  last_report_time: string | null;
  today_receipts: number;
  pending_items: number;
}

export interface DailyReport {
  site_id: string;
  site_name_th: string;
  site_name_en: string;
  report_date: string;
  status: "blocked" | "ready" | "sent";
  wage_type: WageReason | null;
  workers_count: number;
  labor_total: number;
  supplier_total: number;
  severity_score: number;
  block_reason: string | null;
}

export interface SeverityInput {
  labor_amount: number;
  supplier_amount: number;
  labor_event_count: number;
  supplier_event_count: number;
}
