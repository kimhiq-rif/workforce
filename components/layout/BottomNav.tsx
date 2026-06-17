"use client";
// Copyright © 2026 Workforce. All rights reserved.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, QrCode, MapPin, MoreHorizontal } from "lucide-react";

const BOTTOM_ITEMS = [
  { href: "/",          icon: Home,          th: "แดชบอร์ด", en: "Dashboard" },
  { href: "/workers",   icon: Users,          th: "พนักงาน",  en: "Workers" },
  { href: "/suppliers", icon: QrCode,         th: "สแกน",     en: "Scan",    accent: true },
  { href: "/sites",     icon: MapPin,         th: "ไซต์",     en: "Sites" },
  { href: "/more",      icon: MoreHorizontal, th: "เพิ่มเติม",en: "More" },
];

export function BottomNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav className="bottom-nav mobile-only" aria-label="Mobile navigation">
      {BOTTOM_ITEMS.map(({ href, icon: Icon, th, en, accent }) => (
        <Link
          key={href}
          href={href}
          className={`bottom-nav-item ${accent ? (isActive(href) ? "scan-active" : "") : isActive(href) ? "active" : ""}`}
        >
          <Icon size={22} strokeWidth={1.8} />
          <span>{th}</span>
          <small>{en}</small>
        </Link>
      ))}
    </nav>
  );
}
