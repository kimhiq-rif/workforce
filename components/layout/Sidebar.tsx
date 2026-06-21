"use client";
// Copyright © 2026 Workforce. All rights reserved.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, MapPin, Users, Truck, Calendar, FileText,
  Wallet, Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/",          icon: Home,          th: "แดชบอร์ด",       en: "Dashboard" },
  { href: "/sites",     icon: MapPin,         th: "ไซต์",           en: "Sites" },
  { href: "/workers",   icon: Users,          th: "พนักงาน",        en: "Workers" },
  { href: "/suppliers", icon: Truck,          th: "ซัพพลายเออร์",   en: "Suppliers" },
  { href: "/calendar",  icon: Calendar,       th: "ปฏิทิน",         en: "Calendar" },
  { href: "/reports",   icon: FileText,       th: "รายงาน",         en: "Reports" },
  { href: "/finance",   icon: Wallet,         th: "การเงิน",        en: "Finance" },
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
        <div className="sidebar-logo-mark">
          {/* W + location-pin + clock — DO NOT CHANGE THIS SVG */}
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            {/* W letterform — white stroke */}
            <path
              d="M2 4L6.5 16L11 10L15.5 16L20 4"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Orange location pin overlaid at W center */}
            <path
              d="M11 3C8.79 3 7 4.79 7 7C7 9.76 11 15 11 15C11 15 15 9.76 15 7C15 4.79 13.21 3 11 3Z"
              fill="#FF6A00"
            />
            {/* White clock face inside pin */}
            <circle cx="11" cy="7" r="2.2" fill="white" />
            {/* Clock hands (orange) */}
            <line x1="11" y1="7" x2="12.4" y2="7" stroke="#FF6A00" strokeWidth="0.9" strokeLinecap="round" />
            <line x1="11" y1="7" x2="11" y2="5.5" stroke="#FF6A00" strokeWidth="0.9" strokeLinecap="round" />
            {/* Center dot */}
            <circle cx="11" cy="7" r="0.5" fill="#FF6A00" />
          </svg>
        </div>
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

      {/* Settings */}
      <div className="sidebar-bottom">
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
