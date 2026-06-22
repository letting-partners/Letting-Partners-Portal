import type { RequestUser } from "@/server/auth/requireUser";

export type PropertyPolicyResource = {
  ownerAgentId: string;
  landlordOwnerAgentId: string;
};

export function canListProperties(user: RequestUser): boolean {
  return user.role === "ADMIN" || user.role === "AGENT";
}

export function canViewProperty(user: RequestUser, property: PropertyPolicyResource): boolean {
  if (user.role === "ADMIN") {
    return true;
  }

  return property.ownerAgentId === user.id && property.landlordOwnerAgentId === user.id;
}

export function canCreateProperty(
  user: RequestUser,
  context: { ownerAgentId: string; landlordOwnerAgentId: string },
): boolean {
  if (user.role === "ADMIN") {
    return true;
  }

  return context.ownerAgentId === user.id && context.landlordOwnerAgentId === user.id;
}

export function canEditProperty(user: RequestUser, property: PropertyPolicyResource): boolean {
  return canViewProperty(user, property);
}

export function canDeleteProperty(user: RequestUser, property: PropertyPolicyResource): boolean {
  return canViewProperty(user, property);
}
