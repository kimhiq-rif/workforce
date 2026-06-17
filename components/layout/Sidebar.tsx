"use client";
// Copyright © 2026 Workforce. All rights reserved.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, MapPin, Users, Truck, Calendar, FileText,
  Wallet, MoreHorizontal, Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/",          icon: Home,          th: "แดชบอร์ด",       en: "Dashboard" },
  { href: "/sites",     icon: MapPin,         th: "ไซต์",           en: "Sites" },
  { href: "/workers",   icon: Users,          th: "พนักงาน",        en: "Workers" },
  { href: "/suppliers", icon: Truck,          th: "ซัพพลายเออร์",   en: "Suppliers" },
  { href: "/calendar",  icon: Calendar,       th: "ปฏิทิน",         en: "Calendar" },
  { href: "/reports",   icon: FileText,       th: "รายงาน",         en: "Reports" },
  { href: "/finance",   icon: Wallet,         th: "การเงิน",        en: "Finance" },
  { href: "/more",      icon: MoreHorizontal, th: "เพิ่มเติม",      en: "More" },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className="sidebar desktop-only">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">W</div>
        <div className="sidebar-logo-text">
          <strong>Workforce</strong>
          <small>Driven by Proof</small>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1">
        {NAV_ITEMS.map(({ href, icon: Icon, th, en }) => (
          <Link
            key={href}
            href={href}
            className={`nav-item ${isActive(href) ? "active" : ""}`}
          >
            <Icon size={22} strokeWidth={1.8} />
            <span className="nav-label">
              <strong>{th}</strong>
              <small>{en}</small>
            </span>
          </Link>
        ))}
      </nav>

      {/* Settings */}
      <div className="sidebar-bottom">
        <Link
          href="/settings"
          className={`nav-item ${isActive("/settings") ? "active" : ""}`}
        >
          <Settings size={22} strokeWidth={1.8} />
          <span className="nav-label">
            <strong>ตั้งค่า</strong>
            <small>Settings</small>
          </span>
        </Link>
      </div>
    </aside>
  );
}
