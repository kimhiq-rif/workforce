// Auto-generated from Supabase migrations — do not edit manually.
// Regenerate with: npx supabase gen types typescript --project-id keihzjpkshrucqwiwzoy

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ─── Enum types ──────────────────────────────────────────────────────────────

export type UserRole = "owner" | "field_manager" | "technical_admin";

export type SiteStatus =
  | "live"
  | "finished"
  | "rain"
  | "day_off"
  | "half_day"
  | "waiting"
  | "review";

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

export type ReceiptStatus =
  | "pending_qr"
  | "pending_payment"
  | "paid"
  | "needs_review"
  | "pending"
  | "approved"
  | "disputed"
  | "pending_sorting"
  | "paid_pending_sorting"
  | "pending_review";

export type AttendanceStatus =
  | "on_site"
  | "late"
  | "missing"
  | "half_day_am"
  | "half_day_pm"
  | "day_off"
  | "rain";

export type AbsenceReason = "sick" | "day_off" | "family" | "other";

export type ProjectType = "short" | "long";

export type CloseReason = "completed" | "stopped_cancelled";

export type ReportMode = "annual" | "half-year";

// ─── Table row types ──────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
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
          must_change_password: boolean | null;
          has_set_password: boolean;
          created_at: string;
          updated_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          auth_id?: string | null;
          owner_id?: string | null;
          role?: UserRole;
          name_th: string;
          name_en: string;
          phone?: string | null;
          admin_code_hash?: string | null;
          language_mode?: string;
          session_timeout_hours?: number;
          must_change_password?: boolean | null;
          has_set_password?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_id?: string | null;
          owner_id?: string | null;
          role?: UserRole;
          name_th?: string;
          name_en?: string;
          phone?: string | null;
          admin_code_hash?: string | null;
          language_mode?: string;
          session_timeout_hours?: number;
          must_change_password?: boolean | null;
          has_set_password?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      trusted_devices: {
        Row: {
          id: string;
          user_id: string;
          device_hash: string;
          device_label: string | null;
          approved_at: string;
          last_seen_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          user_id: string;
          device_hash: string;
          device_label?: string | null;
          approved_at?: string;
          last_seen_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          device_hash?: string;
          device_label?: string | null;
          approved_at?: string;
          last_seen_at?: string;
        };
      };

      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          owner_id: string | null;
          device_name: string | null;
          created_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          owner_id?: string | null;
          device_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          owner_id?: string | null;
          device_name?: string | null;
          created_at?: string;
        };
      };

      sites: {
        Row: {
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
          project_type: ProjectType;
          project_target_end_date: string | null;
          project_description: string | null;
          closed_at: string | null;
          close_reason: CloseReason | null;
          severity_score: number | null;
          created_at: string;
          updated_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          owner_id: string;
          name_th: string;
          name_en: string;
          location_th?: string | null;
          location_en?: string | null;
          status?: SiteStatus;
          manager_id?: string | null;
          lat?: number | null;
          lng?: number | null;
          photo_url?: string | null;
          is_active?: boolean;
          project_type?: ProjectType;
          project_target_end_date?: string | null;
          project_description?: string | null;
          closed_at?: string | null;
          close_reason?: CloseReason | null;
          severity_score?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name_th?: string;
          name_en?: string;
          location_th?: string | null;
          location_en?: string | null;
          status?: SiteStatus;
          manager_id?: string | null;
          lat?: number | null;
          lng?: number | null;
          photo_url?: string | null;
          is_active?: boolean;
          project_type?: ProjectType;
          project_target_end_date?: string | null;
          project_description?: string | null;
          closed_at?: string | null;
          close_reason?: CloseReason | null;
          severity_score?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      site_stages: {
        Row: {
          id: string;
          owner_id: string;
          site_id: string;
          name_en: string;
          name_th: string;
          color: string;
          position: number;
          started_at: string | null;
          completed_at: string | null;
          is_current: boolean;
          target_end_date: string | null;
          transition_note: string | null;
          created_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          owner_id: string;
          site_id: string;
          name_en: string;
          name_th?: string;
          color?: string;
          position?: number;
          started_at?: string | null;
          completed_at?: string | null;
          is_current?: boolean;
          target_end_date?: string | null;
          transition_note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          site_id?: string;
          name_en?: string;
          name_th?: string;
          color?: string;
          position?: number;
          started_at?: string | null;
          completed_at?: string | null;
          is_current?: boolean;
          target_end_date?: string | null;
          transition_note?: string | null;
          created_at?: string;
        };
      };

      workers: {
        Row: {
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
          auth_user_id: string | null;
          email: string | null;
          login_email: string | null;
          visa_expiry_date: string | null;
          age: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          owner_id: string;
          name_th: string;
          name_en: string;
          role_th?: string | null;
          role_en?: string | null;
          daily_wage?: number;
          is_temporary?: boolean;
          assigned_site_id?: string | null;
          photo_url?: string | null;
          phone?: string | null;
          auth_user_id?: string | null;
          email?: string | null;
          login_email?: string | null;
          visa_expiry_date?: string | null;
          age?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name_th?: string;
          name_en?: string;
          role_th?: string | null;
          role_en?: string | null;
          daily_wage?: number;
          is_temporary?: boolean;
          assigned_site_id?: string | null;
          photo_url?: string | null;
          phone?: string | null;
          auth_user_id?: string | null;
          email?: string | null;
          login_email?: string | null;
          visa_expiry_date?: string | null;
          age?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      attendance_events: {
        Row: {
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
          absence_reason: AbsenceReason | null;
          absence_note: string | null;
          absence_marked_by: string | null;
          source: string | null;
          created_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          owner_id: string;
          site_id: string;
          worker_id: string;
          reported_by?: string | null;
          event_date: string;
          arrival_time?: string | null;
          photo_url?: string | null;
          photo_lat?: number | null;
          photo_lng?: number | null;
          status?: AttendanceStatus;
          is_late?: boolean;
          after_cutoff?: boolean;
          wage_reason?: WageReason | null;
          wage_amount?: number | null;
          notes?: string | null;
          absence_reason?: AbsenceReason | null;
          absence_note?: string | null;
          absence_marked_by?: string | null;
          source?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          site_id?: string;
          worker_id?: string;
          reported_by?: string | null;
          event_date?: string;
          arrival_time?: string | null;
          photo_url?: string | null;
          photo_lat?: number | null;
          photo_lng?: number | null;
          status?: AttendanceStatus;
          is_late?: boolean;
          after_cutoff?: boolean;
          wage_reason?: WageReason | null;
          wage_amount?: number | null;
          notes?: string | null;
          absence_reason?: AbsenceReason | null;
          absence_note?: string | null;
          absence_marked_by?: string | null;
          source?: string | null;
          created_at?: string;
        };
      };

      site_day_status_events: {
        Row: {
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
        };
        Relationships: never[];
        Insert: {
          id?: string;
          owner_id: string;
          site_id: string;
          event_date: string;
          status: SiteStatus;
          set_by: string;
          set_at?: string;
          set_before_attendance?: boolean;
          rain_end_at?: string | null;
          wage_decision?: WageDecision;
          wage_reason?: WageReason | null;
          wage_decided_at?: string | null;
          wage_decided_by?: string | null;
          cutoff_time?: string | null;
          attendance_count_at_change?: number;
          affected_worker_ids?: string[] | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          site_id?: string;
          event_date?: string;
          status?: SiteStatus;
          set_by?: string;
          set_at?: string;
          set_before_attendance?: boolean;
          rain_end_at?: string | null;
          wage_decision?: WageDecision;
          wage_reason?: WageReason | null;
          wage_decided_at?: string | null;
          wage_decided_by?: string | null;
          cutoff_time?: string | null;
          attendance_count_at_change?: number;
          affected_worker_ids?: string[] | null;
          notes?: string | null;
          created_at?: string;
        };
      };

      suppliers: {
        Row: {
          id: string;
          owner_id: string;
          name_th: string;
          name_en: string;
          logo_initials: string | null;
          phone: string | null;
          category: string | null;
          qr_code_data: string | null;
          contact_phone: string | null;
          is_active: boolean;
          created_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          owner_id: string;
          name_th: string;
          name_en: string;
          logo_initials?: string | null;
          phone?: string | null;
          category?: string | null;
          qr_code_data?: string | null;
          contact_phone?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name_th?: string;
          name_en?: string;
          logo_initials?: string | null;
          phone?: string | null;
          category?: string | null;
          qr_code_data?: string | null;
          contact_phone?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
      };

      receipts: {
        Row: {
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
          photo_url: string | null;
          scanned_by: string | null;
          scanned_at: string | null;
          paid_at: string | null;
          paid_by: string | null;
          submitted_by: string | null;
          category: string | null;
          description: string | null;
          payment_type: string | null;
          gps_lat: number | null;
          gps_lng: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          owner_id: string;
          site_id?: string | null;
          supplier_id?: string | null;
          receipt_number: string;
          amount?: number | null;
          status?: ReceiptStatus;
          qr_value?: string | null;
          qr_image_url?: string | null;
          source_photo_url?: string | null;
          photo_url?: string | null;
          scanned_by?: string | null;
          scanned_at?: string | null;
          paid_at?: string | null;
          paid_by?: string | null;
          submitted_by?: string | null;
          category?: string | null;
          description?: string | null;
          payment_type?: string | null;
          gps_lat?: number | null;
          gps_lng?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          site_id?: string | null;
          supplier_id?: string | null;
          receipt_number?: string;
          amount?: number | null;
          status?: ReceiptStatus;
          qr_value?: string | null;
          qr_image_url?: string | null;
          source_photo_url?: string | null;
          photo_url?: string | null;
          scanned_by?: string | null;
          scanned_at?: string | null;
          paid_at?: string | null;
          paid_by?: string | null;
          submitted_by?: string | null;
          category?: string | null;
          description?: string | null;
          payment_type?: string | null;
          gps_lat?: number | null;
          gps_lng?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      advances: {
        Row: {
          id: string;
          owner_id: string;
          worker_id: string;
          site_id: string | null;
          amount: number;
          created_by: string | null;
          notes: string | null;
          status: string;
          reason: string | null;
          created_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          owner_id: string;
          worker_id: string;
          site_id?: string | null;
          amount: number;
          created_by?: string | null;
          notes?: string | null;
          status?: string;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          worker_id?: string;
          site_id?: string | null;
          amount?: number;
          created_by?: string | null;
          notes?: string | null;
          status?: string;
          reason?: string | null;
          created_at?: string;
        };
      };

      workday_settings: {
        Row: {
          id: string;
          owner_id: string;
          attendance_opens: string;
          workday_start: string;
          workday_end: string;
          daily_reset: string;
          timezone: string;
          start_time: string | null;
          end_time: string | null;
          late_threshold_minutes: number | null;
          half_day_cutoff_time: string | null;
          rain_block_after: string | null;
          daily_wage_default: number | null;
          hosted_company_name: string | null;
          hosted_company_logo_url: string | null;
          updated_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          owner_id: string;
          attendance_opens?: string;
          workday_start?: string;
          workday_end?: string;
          daily_reset?: string;
          timezone?: string;
          start_time?: string | null;
          end_time?: string | null;
          late_threshold_minutes?: number | null;
          half_day_cutoff_time?: string | null;
          rain_block_after?: string | null;
          daily_wage_default?: number | null;
          hosted_company_name?: string | null;
          hosted_company_logo_url?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          attendance_opens?: string;
          workday_start?: string;
          workday_end?: string;
          daily_reset?: string;
          timezone?: string;
          start_time?: string | null;
          end_time?: string | null;
          late_threshold_minutes?: number | null;
          half_day_cutoff_time?: string | null;
          rain_block_after?: string | null;
          daily_wage_default?: number | null;
          hosted_company_name?: string | null;
          hosted_company_logo_url?: string | null;
          updated_at?: string;
        };
      };

      audit_log: {
        Row: {
          id: string;
          owner_id: string | null;
          actor_id: string | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          old_value: Json | null;
          new_value: Json | null;
          device_hash: string | null;
          ip_address: string | null;
          created_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          owner_id?: string | null;
          actor_id?: string | null;
          action: string;
          target_type?: string | null;
          target_id?: string | null;
          old_value?: Json | null;
          new_value?: Json | null;
          device_hash?: string | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string | null;
          actor_id?: string | null;
          action?: string;
          target_type?: string | null;
          target_id?: string | null;
          old_value?: Json | null;
          new_value?: Json | null;
          device_hash?: string | null;
          ip_address?: string | null;
          created_at?: string;
        };
      };

      calendar_events: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          event_type: "task" | "meeting";
          event_date: string;
          event_time: string | null;
          site_id: string | null;
          notes: string | null;
          reminder_minutes: number | null;
          push_sent: boolean;
          is_done: boolean;
          image_url: string | null;
          image_lat: number | null;
          image_lng: number | null;
          image_taken_at: string | null;
          created_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          owner_id: string;
          title: string;
          event_type?: "task" | "meeting";
          event_date: string;
          event_time?: string | null;
          site_id?: string | null;
          notes?: string | null;
          reminder_minutes?: number | null;
          push_sent?: boolean;
          is_done?: boolean;
          image_url?: string | null;
          image_lat?: number | null;
          image_lng?: number | null;
          image_taken_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          title?: string;
          event_type?: "task" | "meeting";
          event_date?: string;
          event_time?: string | null;
          site_id?: string | null;
          notes?: string | null;
          reminder_minutes?: number | null;
          push_sent?: boolean;
          is_done?: boolean;
          image_url?: string | null;
          image_lat?: number | null;
          image_lng?: number | null;
          image_taken_at?: string | null;
          created_at?: string;
        };
      };

      driver_cash_entries: {
        Row: {
          id: string;
          owner_id: string;
          driver_user_id: string;
          amount: number;
          notes: string | null;
          given_by: string | null;
          photo_url: string | null;
          gps_lat: number | null;
          gps_lng: number | null;
          created_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          owner_id: string;
          driver_user_id: string;
          amount: number;
          notes?: string | null;
          given_by?: string | null;
          photo_url?: string | null;
          gps_lat?: number | null;
          gps_lng?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          driver_user_id?: string;
          amount?: number;
          notes?: string | null;
          given_by?: string | null;
          photo_url?: string | null;
          gps_lat?: number | null;
          gps_lng?: number | null;
          created_at?: string;
        };
      };

      site_daily_notes: {
        Row: {
          id: string;
          owner_id: string;
          site_id: string;
          note: string;
          note_date: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          owner_id: string;
          site_id: string;
          note: string;
          note_date?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          site_id?: string;
          note?: string;
          note_date?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      advance_payments: {
        Row: {
          id: string;
          owner_id: string;
          worker_id: string;
          payment_date: string;
          amount: number;
          notes: string | null;
          created_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          owner_id: string;
          worker_id: string;
          payment_date: string;
          amount: number;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          worker_id?: string;
          payment_date?: string;
          amount?: number;
          notes?: string | null;
          created_at?: string;
        };
      };

      halfmonth_report_snapshots: {
        Row: {
          id: string;
          owner_id: string;
          period_start: string;
          period_end: string;
          generated_at: string;
          total_workers: number;
          total_net_pay: number;
          data: Json;
          created_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          owner_id: string;
          period_start: string;
          period_end: string;
          generated_at?: string;
          total_workers?: number;
          total_net_pay?: number;
          data: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          period_start?: string;
          period_end?: string;
          generated_at?: string;
          total_workers?: number;
          total_net_pay?: number;
          data?: Json;
          created_at?: string;
        };
      };

      overtime_events: {
        Row: {
          id: string;
          owner_id: string;
          site_id: string;
          worker_id: string;
          session_id: string;
          event_date: string;
          overtime_end_time: string;
          overtime_hours: number;
          amount: number | null;
          approved_by: string | null;
          created_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          owner_id: string;
          site_id: string;
          worker_id: string;
          session_id: string;
          event_date: string;
          overtime_end_time: string;
          overtime_hours?: number;
          amount?: number | null;
          approved_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          site_id?: string;
          worker_id?: string;
          session_id?: string;
          event_date?: string;
          overtime_end_time?: string;
          overtime_hours?: number;
          amount?: number | null;
          approved_by?: string | null;
          created_at?: string;
        };
      };

      corrections: {
        Row: {
          id: string;
          owner_id: string;
          entity_type: string;
          entity_id: string;
          field_name: string;
          original_value: string | null;
          corrected_value: string | null;
          reason: string;
          corrected_by: string | null;
          corrected_at: string;
          created_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          owner_id: string;
          entity_type: string;
          entity_id: string;
          field_name: string;
          original_value?: string | null;
          corrected_value?: string | null;
          reason: string;
          corrected_by?: string | null;
          corrected_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          entity_type?: string;
          entity_id?: string;
          field_name?: string;
          original_value?: string | null;
          corrected_value?: string | null;
          reason?: string;
          corrected_by?: string | null;
          corrected_at?: string;
          created_at?: string;
        };
      };

      login_attempts: {
        Row: {
          normalized_email: string;
          failed_count: number;
          locked_until: string | null;
          last_attempt_at: string;
          created_at: string;
          updated_at: string;
        };
        Relationships: never[];
        Insert: {
          normalized_email: string;
          failed_count?: number;
          locked_until?: string | null;
          last_attempt_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          normalized_email?: string;
          failed_count?: number;
          locked_until?: string | null;
          last_attempt_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };

      stage_reports: {
        Row: {
          id: string;
          owner_id: string;
          site_id: string;
          stage_id: string;
          stage_name_en: string;
          stage_name_th: string;
          stage_color: string;
          period_from: string;
          period_to: string;
          duration_days: number;
          work_days: number;
          labor_cost_thb: number;
          receipts_cost_thb: number;
          temp_workers_cost_thb: number;
          overtime_cost_thb: number;
          total_cost_thb: number;
          worker_count: number;
          gps_issue_count: number;
          correction_count: number;
          receipt_problem_count: number;
          overtime_count: number;
          temp_worker_count: number;
          snapshot_json: Json | null;
          generated_at: string;
          created_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          owner_id: string;
          site_id: string;
          stage_id: string;
          stage_name_en: string;
          stage_name_th?: string;
          stage_color?: string;
          period_from: string;
          period_to: string;
          duration_days?: number;
          work_days?: number;
          labor_cost_thb?: number;
          receipts_cost_thb?: number;
          temp_workers_cost_thb?: number;
          overtime_cost_thb?: number;
          total_cost_thb?: number;
          worker_count?: number;
          gps_issue_count?: number;
          correction_count?: number;
          receipt_problem_count?: number;
          overtime_count?: number;
          temp_worker_count?: number;
          snapshot_json?: Json | null;
          generated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          site_id?: string;
          stage_id?: string;
          stage_name_en?: string;
          stage_name_th?: string;
          stage_color?: string;
          period_from?: string;
          period_to?: string;
          duration_days?: number;
          work_days?: number;
          labor_cost_thb?: number;
          receipts_cost_thb?: number;
          temp_workers_cost_thb?: number;
          overtime_cost_thb?: number;
          total_cost_thb?: number;
          worker_count?: number;
          gps_issue_count?: number;
          correction_count?: number;
          receipt_problem_count?: number;
          overtime_count?: number;
          temp_worker_count?: number;
          snapshot_json?: Json | null;
          generated_at?: string;
          created_at?: string;
        };
      };

      daily_report_snapshots: {
        Row: {
          id: string;
          owner_id: string;
          report_date: string;
          data: Json;
          generated_at: string;
          total_labor_cost: number;
          total_expenses: number;
          total_present: number;
          is_blocked: boolean;
          created_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          owner_id: string;
          report_date: string;
          data: Json;
          generated_at?: string;
          total_labor_cost?: number;
          total_expenses?: number;
          total_present?: number;
          is_blocked?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          report_date?: string;
          data?: Json;
          generated_at?: string;
          total_labor_cost?: number;
          total_expenses?: number;
          total_present?: number;
          is_blocked?: boolean;
          created_at?: string;
        };
      };

      annual_report_snapshots: {
        Row: {
          id: string;
          owner_id: string;
          report_mode: ReportMode;
          report_year: number;
          report_half: number | null;
          period_start: string;
          period_end: string;
          generated_at: string;
          data: Json;
          pdf_url: string | null;
          created_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          owner_id: string;
          report_mode: ReportMode;
          report_year: number;
          report_half?: number | null;
          period_start: string;
          period_end: string;
          generated_at?: string;
          data: Json;
          pdf_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          report_mode?: ReportMode;
          report_year?: number;
          report_half?: number | null;
          period_start?: string;
          period_end?: string;
          generated_at?: string;
          data?: Json;
          pdf_url?: string | null;
          created_at?: string;
        };
      };

      site_transfer_events: {
        Row: {
          id: string;
          owner_id: string;
          worker_id: string;
          from_site_id: string;
          to_site_id: string;
          event_date: string;
          transfer_time: string;
          source: string;
          performed_by: string;
          notes: string | null;
          created_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          owner_id: string;
          worker_id: string;
          from_site_id: string;
          to_site_id: string;
          event_date: string;
          transfer_time: string;
          source: string;
          performed_by: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          worker_id?: string;
          from_site_id?: string;
          to_site_id?: string;
          event_date?: string;
          transfer_time?: string;
          source?: string;
          performed_by?: string;
          notes?: string | null;
          created_at?: string;
        };
      };

      migrations_log: {
        Row: {
          id: number;
          name: string;
          applied_at: string;
          description: string | null;
        };
        Relationships: never[];
        Insert: {
          id?: number;
          name: string;
          applied_at?: string;
          description?: string | null;
        };
        Update: {
          id?: number;
          name?: string;
          applied_at?: string;
          description?: string | null;
        };
      };

      receipt_ocr_examples: {
        Row: {
          id: string;
          owner_id: string;
          image_url: string | null;
          correct_merchant: string | null;
          correct_description: string | null;
          correct_amount: number;
          correct_date: string | null;
          created_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          owner_id: string;
          image_url?: string | null;
          correct_merchant?: string | null;
          correct_description?: string | null;
          correct_amount: number;
          correct_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          image_url?: string | null;
          correct_merchant?: string | null;
          correct_description?: string | null;
          correct_amount?: number;
          correct_date?: string | null;
          created_at?: string;
        };
      };

      passkeys: {
        Row: {
          id: string;
          user_id: string;
          credential_id: string;
          public_key: string;
          counter: number;
          device_name: string | null;
          created_at: string;
        };
        Relationships: never[];
        Insert: {
          id?: string;
          user_id: string;
          credential_id: string;
          public_key: string;
          counter?: number;
          device_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          credential_id?: string;
          public_key?: string;
          counter?: number;
          device_name?: string | null;
          created_at?: string;
        };
      };
    };

    Views: {
      [_ in never]: never;
    };

    Functions: {
      get_owner_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      calculate_severity_score: {
        Args: {
          p_labor_amount: number;
          p_supplier_amount: number;
          p_labor_count: number;
          p_supplier_count: number;
        };
        Returns: number;
      };
      compute_wage_reason: {
        Args: {
          p_arrival_time: string;
          p_site_status: SiteStatus;
          p_workday_start?: string;
          p_half_day_cutoff?: string;
          p_afternoon_grace?: string;
        };
        Returns: WageReason;
      };
    };

    Enums: {
      user_role: UserRole;
      site_status: SiteStatus;
      wage_reason: WageReason;
      wage_decision: WageDecision;
      receipt_status: ReceiptStatus;
      attendance_status: AttendanceStatus;
    };
  };
}

// ─── Convenience row types ────────────────────────────────────────────────────

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Inserts<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type Updates<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

// Named row types
export type DbUser = Tables<"users">;
export type DbSite = Tables<"sites">;
export type DbWorker = Tables<"workers">;
// Note: workers.auth_user_id links to auth.users.id (not users table). No FK in schema.
export type DbAttendanceEvent = Tables<"attendance_events">;
export type DbSiteDayStatusEvent = Tables<"site_day_status_events">;
export type DbSupplier = Tables<"suppliers">;
export type DbReceipt = Tables<"receipts">;
export type DbAdvance = Tables<"advances">;
export type DbWorkdaySettings = Tables<"workday_settings">;
export type DbCalendarEvent = Tables<"calendar_events">;
export type DbDriverCashEntry = Tables<"driver_cash_entries">;
export type DbSiteStage = Tables<"site_stages">;
export type DbSiteTransferEvent = Tables<"site_transfer_events">;
export type DbOvertime = Tables<"overtime_events">;
export type DbCorrection = Tables<"corrections">;
export type DbDailyReportSnapshot = Tables<"daily_report_snapshots">;
export type DbHalfmonthReportSnapshot = Tables<"halfmonth_report_snapshots">;
export type DbAnnualReportSnapshot = Tables<"annual_report_snapshots">;
export type DbStageReport = Tables<"stage_reports">;
export type DbAdvancePayment = Tables<"advance_payments">;
export type DbSiteDailyNote = Tables<"site_daily_notes">;
export type DbLoginAttempt = Tables<"login_attempts">;
export type DbMigrationsLog = Tables<"migrations_log">;
