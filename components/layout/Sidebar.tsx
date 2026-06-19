"use client";
// Copyright © 2026 Workforce. All rights reserved.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, MapPin, Users, Truck, Calendar, FileText,
  Wallet, MoreHorizontal, Settings, UsersRound,
} from "lucide-react";
import { useUserRole, type AppRole } from "./UserRoleContext";

const NAV_ITEMS = [
  { href: "/",          icon: Home,          th: "แดชบอร์ด",       en: "Dashboard",  roles: ["owner", "field_manager", "technical_admin"] as AppRole[] },
  { href: "/sites",     icon: MapPin,         th: "ไซต์",           en: "Sites",      roles: ["owner", "field_manager", "technical_admin"] as AppRole[] },
  { href: "/workers",   icon: Users,          th: "พนักงาน",        en: "Workers",    roles: ["owner"] as AppRole[] },
  { href: "/suppliers", icon: Truck,          th: "ซัพพลายเออร์",   en: "Suppliers",  roles: ["owner", "technical_admin"] as AppRole[] },
  { href: "/calendar",  icon: Calendar,       th: "ปฏิทิน",         en: "Calendar",   roles: ["owner"] as AppRole[] },
  { href: "/reports",   icon: FileText,       th: "รายงาน",         en: "Reports",    roles: ["owner"] as AppRole[] },
  { href: "/finance",   icon: Wallet,         th: "การเงิน",        en: "Finance",    roles: ["owner"] as AppRole[] },
  { href: "/more",      icon: MoreHorizontal, th: "เพิ่มเติม",      en: "More",       roles: ["owner", "field_manager", "technical_admin"] as AppRole[] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { role } = useUserRole();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));
  const showTeam = role === "owner";

  return (
    <aside className="sidebar desktop-only">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path d="M1.5 4.5L5 15L10 9" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 9L17 15L20.5 4.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11 5C8.5 5 6.5 7.1 6.5 9.6C6.5 12.8 11 18.5 11 18.5C11 18.5 15.5 12.8 15.5 9.6C15.5 7.1 13.5 5 11 5Z" fill="#FF6A00"/>
            <circle cx="11" cy="9.6" r="2.7" fill="white"/>
            <line x1="11" y1="9.6" x2="11" y2="7.9" stroke="#FF6A00" strokeWidth="0.65" strokeLinecap="round"/>
            <line x1="11" y1="9.6" x2="12.4" y2="10.2" stroke="#FF6A00" strokeWidth="0.65" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="sidebar-logo-text">
          <strong>Workforce</strong>
          <small>Driven by Proof</small>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1">
        {visibleItems.map(({ href, icon: Icon, th, en }) => (
          <Link
            key={href}
            href={href}
            className={`nav-item ${isActive(href) ? "active" : ""}`}
          >
            <span className="nav-icon-wrap">
              <Icon size={18} strokeWidth={1.9} />
            </span>
            <span className="nav-label">
              <strong>{th}</strong>
              <small>{en}</small>
            </span>
          </Link>
        ))}
      </nav>

      {/* Bottom fixed items */}
      <div className="sidebar-bottom">
        {showTeam && (
          <Link
            href="/team"
            className={`nav-item ${isActive("/team") ? "active" : ""}`}
          >
            <span className="nav-icon-wrap">
              <UsersRound size={18} strokeWidth={1.9} />
            </span>
            <span className="nav-label">
              <strong>ทีมงาน</strong>
              <small>Team</small>
            </span>
          </Link>
        )}
        <Link
          href="/settings"
          className={`nav-item ${isActive("/settings") ? "active" : ""}`}
        >
          <span className="nav-icon-wrap">
            <Settings size={18} strokeWidth={1.9} />
          </span>
          <span className="nav-label">
            <strong>ตั้งค่า</strong>
            <small>Settings</small>
          </span>
        </Link>
      </div>
    </aside>
  );
}
