"use client";
// Copyright © 2026 Workforce. All rights reserved.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, QrCode, MapPin, MoreHorizontal } from "lucide-react";
import { useUserRole, type AppRole } from "./UserRoleContext";

const BOTTOM_ITEMS = [
  { href: "/",          icon: Home,          th: "แดชบอร์ด", en: "Dashboard", roles: ["owner", "field_manager", "technical_admin"] as AppRole[] },
  { href: "/workers",   icon: Users,          th: "พนักงาน",  en: "Workers",   roles: ["owner"] as AppRole[] },
  { href: "/suppliers", icon: QrCode,         th: "สแกน",     en: "Scan",      roles: ["owner", "technical_admin"] as AppRole[], accent: true },
  { href: "/sites",     icon: MapPin,         th: "ไซต์",     en: "Sites",     roles: ["owner", "field_manager", "technical_admin"] as AppRole[] },
  { href: "/more",      icon: MoreHorizontal, th: "เพิ่มเติม",en: "More",      roles: ["owner", "field_manager", "technical_admin"] as AppRole[] },
];

export function BottomNav() {
  const pathname = usePathname();
  const { role } = useUserRole();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  const visibleItems = BOTTOM_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <nav className="bottom-nav mobile-only" aria-label="Mobile navigation">
      {visibleItems.map(({ href, icon: Icon, th, en, accent }) => (
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
