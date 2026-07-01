# Workforce — Project Context
**עודכן:** 2026-07-01

---

## מיקום ומסלולי עבודה

- **GitHub:** `https://github.com/kimhiq-rif/workforce`
- **Vercel:** Production → `main` branch בלבד
- **Push:** `git push origin main` (remote name = `origin`)
- **Supabase:** `https://keihzjpkshrucqwiwzoy.supabase.co`
- **App URL:** `https://workforce-ivory-delta.vercel.app`
- **Env vars:** `.env.local` (לא מחויב לgit)

---

## תיאור המוצר

Workforce — אפליקציית Next.js + Supabase לניהול אתרי בנייה בתאילנד.
מיועדת לבעלים, מנהלי שדה, נהגים/מנהלי רכב.
Stack: Next.js 14 App Router · Supabase (Auth + DB + Storage) · OneSignal Web Push · Vercel

---

## תפקידים (Roles)

| Role | Code | גישה |
|------|------|------|
| בעלים | `owner` | גישה מלאה, desktop + iPhone |
| מנהל שדה | `field_manager` | אתרים + נוכחות, מנותב לאתר משויך |
| נהג/מנהל רכב | `technical_admin` | כל FM + קבלות + QR, מסלול `/driver` |

---

## ארכיטקטורה — auth

```typescript
// lib/auth-context.ts
getAppUserContext() → { user, profile, ownerId, serviceClient }

// ownerId logic:
ownerId = profile.role === "owner" ? profile.id : profile.owner_id

// serviceClient = bypasses RLS — להשתמש בserver routes בלבד
```

---

## ארכיטקטורה — קבלות (Receipts)

### סטטוסים
| סטטוס | משמעות |
|--------|---------|
| `pending_review` | קבלת מזומן שנשלחה — ממתינה לאישור בעלים |
| `pending` | קבלת ספק רגילה |
| `pending_qr` | תשלום QR ממתין |
| `pending_sorting` | ממתינה למיון |
| `approved` | אושרה |
| `paid` | שולמה |
| `disputed` | בוטלה / יש בעיה |

### Cash Receipt Flow
```
DriverClient → uploadPhoto() → /api/receipts/analyze (OCR Claude Haiku)
→ handleCashSend() → POST /api/receipts/cash (server-side)
→ serviceClient.insert() + sendOneSignalPush()
```

**חשוב:** `handleCashSend` חסום עד ש-OCR מסיים (`analyzing === true`)

### API routes
- `POST /api/receipts/cash` — מכניס קבלת מזומן, שולח push לבעלים
- `POST /api/receipts/analyze` — OCR עם Claude Haiku 4.5
- `POST /api/push` — שליחת push ידנית

---

## ארכיטקטורה — Storage

### bucket: `receipt-photos`
- **פרטי** (`public = false`)
- `photo_url` בDB מאחסן **storage path** (לא URL)
  - דוגמה: `receipts/cash/owner123/1234567890.jpg`
- **לתצוגה**: חייב לייצר signed URL

```typescript
// suppliers/page.tsx — SSR normalization
if (photoUrl && !photoUrl.startsWith("http")) {
  const { data: signed } = await supabase.storage
    .from("receipt-photos")
    .createSignedUrl(photoUrl, 3600); // 1 שעה
  photoUrl = signed?.signedUrl ?? null;
}
```

---

## ארכיטקטורה — Push Notifications (OneSignal)

```typescript
// lib/send-push.ts
sendOneSignalPush({ externalIds, title, body, url, tag })
// external_id = users.id (לא email)
// url = absolute URL עם NEXT_PUBLIC_APP_URL כ-prefix
```

- `NEXT_PUBLIC_APP_URL=https://workforce-ivory-delta.vercel.app` — חייב ב-Vercel env vars
- Mobile PWA: בעלים חייב להתקין PWA ולאשר push
- Deep-link: `/suppliers?receipt=<id>` → מועבר כ-`initialClosingReceipt` prop ב-SSR

---

## ארכיטקטורה — Deep Link מ-Push

```typescript
// suppliers/page.tsx (server component)
export default async function SuppliersPage({ searchParams }) {
  const { receipt: deepLinkReceiptId } = await searchParams;
  const initialClosingReceipt = deepLinkReceiptId
    ? normalizedReceipts.find(r => r.id === deepLinkReceiptId) ?? null
    : null;
  // מועבר ל-SuppliersClient כ-prop
}

// SuppliersClient.tsx
const [closingReceipt, setClosingReceipt] = useState(initialClosingReceipt ?? null);
// מודל נפתח מיד ב-SSR — לא תלוי ב-JS
```

---

## ארכיטקטורה — Crons (Vercel Hobby — daily only)

| Cron | Schedule (UTC) | שעה בנגקוק | מה עושה |
|------|---------------|------------|---------|
| `daily-reset` | `0 17 * * *` | 00:00 | איפוס סטטוס אתרים, עדכון עובדים, push לבעלים |
| `receipts-reminder` | `0 9 * * *` | 16:00 | push תזכורת לסגירת קבלות פתוחות |
| `qr-followup-check` | `30 8 * * *` | 15:30 | בדיקת QR |

**חשוב:** `receipts-reminder` מכסה: `pending_sorting`, `pending_qr`, `pending`, `pending_review`

### מחזור יממה
```
16:00 → push תזכורת "סגור קבלות לפני 17:00"
00:00 → איפוס: live/rain/half_day/day_off → "waiting" + עובדים → אתרים
בוקר → דשבורד נקי (waiting = מצב בסיס, לא התראה)
```

---

## ארכיטקטורה — Dashboard מובייל

### totalAlerts
```typescript
// DashboardClient.tsx
const totalAlerts = openReceiptsCount + reviewSites + criticalItems;
// !! waitingSites לא נספר — waiting = מצב בסיס לאחר איפוס
```

### ניווט Tiles / Signal Cards
| כרטיס | מסלול |
|-------|-------|
| Sites | `/sites` |
| Workers | `/workers` |
| Complete | `/sites` |
| Alerts | ללא (composite metric) |
| Live now / Complete / Rain / Needs check | `/sites` |
| Critical | `/finance` |
| Receipts | `/suppliers` |

---

## קבצים קריטיים

```
app/
  (dashboard)/
    page.tsx                      — Dashboard SSR
    suppliers/page.tsx            — Suppliers SSR + deep-link + signed URLs
    finance/page.tsx              — Finance (pending + pending_review)
  api/
    receipts/
      cash/route.ts               — POST cash receipt (server-side, RLS bypass)
      analyze/route.ts            — OCR עם Claude Haiku
    cron/
      daily-reset/route.ts        — 00:00 Bangkok
      receipts-reminder/route.ts  — 16:00 Bangkok

components/
  screens/
    Suppliers/
      SuppliersClient.tsx         — ReceiptClosingModal, deep-link prop, buildClosingStats
      ReceiptTriageModal.tsx      — תצוגה מפורטת של קבלה
    Driver/
      DriverClient.tsx            — uploadPhoto, runOCR, handleCashSend
    Dashboard/
      DashboardClient.tsx         — MobileMetricTile, MobileSignalCard (href support)
  OneSignalInit.tsx               — אתחול OneSignal
  EnablePushPrompt.tsx            — בקשת הרשאת push

lib/
  auth-context.ts                 — getAppUserContext()
  send-push.ts                    — sendOneSignalPush()
  onesignal.ts                    — client-side OneSignal utils
  format.ts                       — formatThaiDate, bangkokDate, formatCurrency
  supabase/
    server.ts                     — createServiceClient() (RLS bypass)
    client.ts                     — createClient() (browser)

supabase/migrations/
  030_storage_buckets.sql         — receipt-photos bucket (פרטי!)
```

---

## כללים עסקיים קריטיים

### נוכחות
- עובד שדווח באתר A → מועבר אוטומטית מתור A, מופיע ב-B עם נקודה צבעונית
- העברה ≠ איחור: דווח A לפני 08:00, B אחרי 08:00 → לא איחור

### חצי יום (נעול 2026-06-15)
- בוקר: הגיע לפני 12:00 בלבד → זיהוי אוטומטי
- אחר הצהריים: 12:00–12:30 = ללא איחור; 12:30–13:00 = איחור + חצי יום; אחרי 13:00 = חריגה

### גשם
- בטווח-אתר, לא גלובלי
- ניתן לסמן רק אם אין דיווחים עדיין OR בעלים מחליט (עם פאנל החלטת שכר)

### Event Sourcing
- כל פעולה = event. מקוריים לא נמחקים. תיקונים דורשים הערה.

### Timezone
- תמיד Asia/Bangkok. שעת שרת = מקור האמת.

---

## צבעי מותג (נעולים)

| Token | Hex | שימוש |
|-------|-----|-------|
| Brand primary | `#1E3A8A` | ניווט, כותרות, פעולות ראשיות |
| Brand accent | `#FF6A00` | פעולה חשובה, קבלות, פרויקט ארוך |
| Brand violet | `#6C5CE7` | פרויקט קצר, Move Stage, תיקונים |
| Live | `#06B6D4` | נקודת סטטוס, גבול דק |
| Finished | `#22C55E` | אישור, בוצע, שכר נטו |
| Day off | `#3B82F6` | יום חופש / גשם |
| Check | `#F59E0B` | דורש בדיקה, חצי יום |
| Waiting | `#F97316` | חריגות בלבד — סמנים מאוחרים |
| Critical | `#EF4444` | שגיאה / חריגה |

**כלל עיצוב:** רקעים לבן / `#F2F4FF` בלבד.

---

## בעיות ידועות

1. `attendance_events` — אין unique constraint ברמת DB על (worker_id, event_date, site_id) — UI מונע כפילויות בלבד
2. Desktop push — WIRASAKMANCLASH צריך לאשר push ב-Chrome desktop ידנית
3. `bcryptjs` + `@anthropic-ai/sdk` — שגיאות TS בחלק מהcontexts — packages קיימים ב-package.json, לא שגיאת runtime

---

## הוראות סנכרון זיכרון מקומי

בסשן local, הוסף שורה אחת ל-`~/.claude/CLAUDE.md`:
```
@/path/to/workforce/PROJECT_CONTEXT.md
```
כך Claude תמיד טוען את ההקשר המעודכן מה-repo.
