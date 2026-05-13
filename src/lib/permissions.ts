import type { FamilyRole, Scope } from "@prisma/client";

export function canReadScoped(ownerUserId: string, scope: Scope, currentUserId: string) {
  return scope === "FAMILY" || ownerUserId === currentUserId;
}

export function canWriteScoped(ownerUserId: string, currentUserId: string, role: FamilyRole) {
  return ownerUserId === currentUserId || role === "ADMIN";
}

export function isFamilyAdmin(role: FamilyRole) {
  return role === "ADMIN";
}

export function visibleScopeWhere(userId: string) {
  return {
    OR: [{ scope: "FAMILY" as const }, { ownerUserId: userId }]
  };
}
