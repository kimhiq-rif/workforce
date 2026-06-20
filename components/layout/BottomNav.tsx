"use client";
// Copyright © 2026 Workforce. All rights reserved.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Receipt, MapPin, MoreHorizontal } from "lucide-react";
import { useUserRole, type AppRole } from "./UserRoleContext";

const BOTTOM_ITEMS = [
  { href: "/",          roleHref: {},  icon: Home,          th: "แดชบอร์ด", en: "Dashboard", roles: ["owner", "field_manager", "technical_admin"] as AppRole[] },
  { href: "/workers",   roleHref: {},  icon: Users,          th: "พนักงาน",  en: "Workers",   roles: ["owner"] as AppRole[] },
  { href: "/suppliers", roleHref: {},  icon: Receipt,        th: "ใบเสร็จ",  en: "Receipts",  roles: ["owner", "technical_admin"] as AppRole[], accent: true },
  { href: "/sites",     roleHref: {},  icon: MapPin,         th: "ไซต์",     en: "Sites",     roles: ["owner", "field_manager", "technical_admin"] as AppRole[] },
  { href: "/more",      roleHref: {},  icon: MoreHorizontal, th: "เพิ่มเติม",en: "More",      roles: ["owner", "field_manager", "technical_admin"] as AppRole[] },
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
      {visibleItems.map(({ href, roleHref, icon: Icon, th, en, accent }) => {
        const resolvedHref = (roleHref as Partial<Record<typeof role, string>>)[role] ?? href;
        return (
        <Link
          key={href}
          href={resolvedHref}
          className={`bottom-nav-item ${accent ? (isActive(resolvedHref) ? "scan-active" : "") : isActive(resolvedHref) ? "active" : ""}`}
        >
          <Icon size={22} strokeWidth={1.8} />
          <span>{th}</span>
          <small>{en}</small>
        </Link>
        );
      })}
    </nav>
  );
}
