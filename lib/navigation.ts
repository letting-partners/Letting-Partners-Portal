import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgePoundSterling,
  Building2,
  CalendarClock,
  ClipboardCheck,
  Contact,
  FileBarChart,
  Handshake,
  Images,
  KeyRound,
  LayoutDashboard,
  PhoneCall,
  PhoneOff,
  Repeat2,
  ScrollText,
  Settings,
  ShieldCheck,
  StickyNote,
  Trophy,
  UserCog,
  Users,
  UsersRound,
} from "lucide-react";

/**
 * The navigation model. Each item declares which roles may see it, and the
 * sidebar renders only what the signed-in user is allowed to reach.
 *
 * This governs visibility only. Every route also enforces its own permission
 * server-side, because hiding a link is not access control.
 */

export type Role = "SUPER_ADMIN" | "AGENT" | "FRONTER";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: Role[];
  /** Which unread/overdue counter, if any, appears on this item. */
  badge?: "followUpsDue" | "customerChats" | "internalChats" | "notifications" | "crossSell";
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

const ALL: Role[] = ["SUPER_ADMIN", "AGENT", "FRONTER"];
const AGENT_UP: Role[] = ["SUPER_ADMIN", "AGENT"];
const ADMIN_ONLY: Role[] = ["SUPER_ADMIN"];

export const NAVIGATION: NavGroup[] = [
  {
    label: "Core",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ALL },
      { label: "Call log", href: "/calls", icon: PhoneCall, roles: ALL },
      {
        label: "Follow ups",
        href: "/follow-ups",
        icon: CalendarClock,
        roles: ALL,
        badge: "followUpsDue",
      },
      { label: "Not interested", href: "/not-interested", icon: PhoneOff, roles: ALL },
      { label: "Landlords", href: "/landlords", icon: Contact, roles: ALL },
      { label: "Properties", href: "/properties", icon: Building2, roles: ALL },
      { label: "Tenants", href: "/tenants", icon: UsersRound, roles: AGENT_UP },
      { label: "Notes", href: "/notes", icon: StickyNote, roles: ALL },
      { label: "Sales", href: "/sales", icon: Trophy, roles: ALL },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { label: "Viewings", href: "/viewings", icon: KeyRound, roles: AGENT_UP },
      { label: "Verifications", href: "/verifications", icon: ClipboardCheck, roles: AGENT_UP },
      { label: "Closings", href: "/closings", icon: Handshake, roles: AGENT_UP },
      { label: "Cross sell", href: "/cross-sell", icon: Repeat2, roles: AGENT_UP, badge: "crossSell" },
      { label: "Collaborations", href: "/collaborations", icon: Users, roles: AGENT_UP },
    ],
  },
  {
    label: "Resources",
    items: [{ label: "Image library", href: "/images", icon: Images, roles: AGENT_UP }],
  },
  {
    label: "Reporting",
    items: [
      { label: "Daily report", href: "/reports/daily", icon: FileBarChart, roles: ALL },
      { label: "Performance", href: "/reports/performance", icon: Activity, roles: AGENT_UP },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Agents", href: "/team/agents", icon: UserCog, roles: ADMIN_ONLY },
      { label: "Fronters", href: "/team/fronters", icon: Users, roles: ADMIN_ONLY },
      { label: "Users", href: "/team/users", icon: ShieldCheck, roles: ADMIN_ONLY },
      {
        label: "Commissions",
        href: "/settings/commissions",
        icon: BadgePoundSterling,
        roles: ADMIN_ONLY,
      },
      { label: "System settings", href: "/settings", icon: Settings, roles: ADMIN_ONLY },
      { label: "Audit log", href: "/audit", icon: ScrollText, roles: ADMIN_ONLY },
    ],
  },
];

export function navigationForRole(role: Role): NavGroup[] {
  return NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}

/**
 * Longest-prefix match so /properties/abc/edit still highlights "Properties",
 * without /calls also matching /call-log.
 */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super admin",
  AGENT: "Agent",
  FRONTER: "Fronter",
};
