"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { createContext, useContext } from "react";

export type AppRole = "owner" | "field_manager" | "technical_admin";

interface UserRoleContextValue {
  role: AppRole;
  assignedSiteId: string | null;
}

const UserRoleContext = createContext<UserRoleContextValue>({
  role: "owner",
  assignedSiteId: null,
});

export function UserRoleProvider({
  role,
  assignedSiteId,
  children,
}: {
  role: AppRole;
  assignedSiteId: string | null;
  children: React.ReactNode;
}) {
  return (
    <UserRoleContext.Provider value={{ role, assignedSiteId }}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRole() {
  return useContext(UserRoleContext);
}
