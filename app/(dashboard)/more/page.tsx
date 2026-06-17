import { DashboardShell } from "@/components/layout/DashboardShell";
import { Grid3X3, Settings, CalendarDays, FileText } from "lucide-react";
import Link from "next/link";

const MORE_LINKS = [
  { href: "/settings", title: "Settings", subtitle: "Account, users, workday", icon: Settings },
  { href: "/calendar", title: "Calendar", subtitle: "Tasks and day planning", icon: CalendarDays },
  { href: "/reports", title: "Reports", subtitle: "Daily reports and review", icon: FileText },
];

export default function MorePage() {
  return (
    <DashboardShell>
      <div className="desktop-only">
        <div className="content-header">
          <div>
            <h1>เพิ่มเติม</h1>
            <p>More tools</p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
          {MORE_LINKS.map(({ href, title, subtitle, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 18,
                background: "white",
                border: "1px solid var(--border)",
                borderRadius: 8,
                textDecoration: "none",
                color: "var(--text-primary)",
              }}
            >
              <span className="attention-icon blue">
                <Icon size={22} />
              </span>
              <span>
                <strong style={{ display: "block", fontSize: 16 }}>{title}</strong>
                <small style={{ color: "var(--text-muted)", fontSize: 12 }}>{subtitle}</small>
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mobile-only">
        <div className="mobile-topbar">
          <div style={{ flex: 1 }}>
            <h1 style={{ color: "white" }}>เพิ่มเติม</h1>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>More tools</p>
          </div>
          <Grid3X3 size={22} color="white" />
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {MORE_LINKS.map(({ href, title, subtitle, icon: Icon }) => (
            <Link key={href} href={href} className="attention-row" style={{ textDecoration: "none", color: "inherit" }}>
              <span className="attention-icon blue">
                <Icon size={20} />
              </span>
              <span>
                <strong style={{ fontSize: 15 }}>{title}</strong>
                <small style={{ display: "block", color: "var(--text-muted)", fontSize: 12 }}>{subtitle}</small>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
