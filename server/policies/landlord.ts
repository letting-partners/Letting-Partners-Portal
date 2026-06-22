import type { RequestUser } from "@/server/auth/requireUser";

export type LandlordPolicyResource = {
  ownerAgentId: string;
};

export function canViewLandlordRegistry(user: RequestUser): boolean {
  return user.role === "ADMIN" || user.role === "AGENT";
}

export function canCreateLandlord(user: RequestUser, ownerAgentId: string): boolean {
  if (user.role === "ADMIN") {
    return true;
  }

  return ownerAgentId === user.id;
}

export function canEditLandlord(user: RequestUser, landlord: LandlordPolicyResource): boolean {
  if (user.role === "ADMIN") {
    return true;
  }

  return landlord.ownerAgentId === user.id;
}

export function canChangeLandlordOwnership(user: RequestUser): boolean {
  return user.role === "ADMIN";
}
