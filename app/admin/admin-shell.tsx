"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavLogoutButton } from "@/components/nav-logout-button";
import { FloatingChat } from "@/components/floating-chat";

type AdminUser = {
  name: string;
  email: string;
  profilePicture?: string | null;
};

type ChatContact = { id: string; name: string; email: string; profilePicture?: string | null };

type Props = {
  user: AdminUser;
  userId: string;
  chatContacts: ChatContact[];
  children: React.ReactNode;
};

function DashboardIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M2 10a8 8 0 1 1 16 0 8 8 0 0 1-16 0Zm7-4a1 1 0 0 0-2 0v3a1 1 0 0 0 .293.707l2.5 2.5a1 1 0 1 0 1.414-1.414L9 8.586V6Z" />
    </svg>
  );
}

function AgentsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z" />
    </svg>
  );
}

function LandlordsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clipRule="evenodd" />
    </svg>
  );
}

function PropertiesIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M4 2a2 2 0 0 0-2 2v11a3 3 0 1 0 6 0V4a2 2 0 0 0-2-2H4Zm1 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm5-1.757 4.9-4.9a2 2 0 0 0 0-2.828L13.485 5.1a2 2 0 0 0-2.828 0L10 5.757v8.486ZM16 17H9.071l6-6H16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2Z" clipRule="evenodd" />
    </svg>
  );
}

function SalesIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
    </svg>
  );
}

function TenantsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM1.49 15.326a.78.78 0 0 1-.358-.442 3 3 0 0 1 4.308-3.516 6.484 6.484 0 0 0-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 0 1-2.07-.655ZM16.44 15.98a4.97 4.97 0 0 0 2.07-.654.78.78 0 0 0 .357-.442 3 3 0 0 0-4.308-3.517 6.484 6.484 0 0 1 1.907 3.96 2.32 2.32 0 0 1-.026.654ZM18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5.304 16.19a.844.844 0 0 1-.277-.71 5 5 0 0 1 9.947 0 .843.843 0 0 1-.277.71A6.975 6.975 0 0 1 10 18a6.974 6.974 0 0 1-4.696-1.81Z" />
    </svg>
  );
}

function AuditIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M4 4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-5L9 4H4Zm7 5a1 1 0 1 0-2 0v1H8a1 1 0 1 0 0 2h1v1a1 1 0 1 0 2 0v-1h1a1 1 0 1 0 0-2h-1V9Z" clipRule="evenodd" />
    </svg>
  );
}


function CommissionIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.798 7.45c.512-.67 1.135-.95 1.702-.95s1.19.28 1.702.95a.75.75 0 0 0 1.192-.91C12.637 5.55 11.596 5 10.5 5s-2.137.55-2.894 1.54A5.205 5.205 0 0 0 6.5 10c0 1.173.382 2.26 1.106 3.46C8.363 14.45 9.404 15 10.5 15s2.137-.55 2.894-1.54a.75.75 0 0 0-1.192-.91c-.512.67-1.135.95-1.702.95s-1.19-.28-1.702-.95A3.705 3.705 0 0 1 8 10c0-.87.284-1.72.798-2.55Z" clipRule="evenodd" />
    </svg>
  );
}

function PotentialTenantsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M10 1a.75.75 0 0 1 .683.438l1.842 3.73 4.116.598a.75.75 0 0 1 .416 1.279l-2.98 2.903.703 4.1a.75.75 0 0 1-1.088.791L10 12.775l-3.692 1.94a.75.75 0 0 1-1.088-.79l.704-4.101L2.943 7.02a.75.75 0 0 1 .416-1.28l4.116-.597L9.317 1.44A.75.75 0 0 1 10 1Z" clipRule="evenodd" />
    </svg>
  );
}

function PotentialLandlordsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clipRule="evenodd" />
    </svg>
  );
}

function DialerIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M2 4.75A2.75 2.75 0 0 1 4.75 2h2.5A2.75 2.75 0 0 1 10 4.75v10.5A2.75 2.75 0 0 1 7.25 18h-2.5A2.75 2.75 0 0 1 2 15.25V4.75Zm10 0A2.75 2.75 0 0 1 14.75 2h.5A2.75 2.75 0 0 1 18 4.75v3.5a.75.75 0 0 1-1.5 0v-3.5c0-.69-.56-1.25-1.25-1.25h-.5c-.69 0-1.25.56-1.25 1.25v10.5c0 .69.56 1.25 1.25 1.25h.5c.69 0 1.25-.56 1.25-1.25v-3.5a.75.75 0 0 1 1.5 0v3.5A2.75 2.75 0 0 1 15.25 18h-.5A2.75 2.75 0 0 1 12 15.25V4.75Z" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M5 4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1V4Zm3 0h4v1H8V4Zm-4 4h12v8H4V8Zm2 2a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm0 3a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Z" clipRule="evenodd" />
    </svg>
  );
}

function MediaLibraryIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-2.69l-2.22-2.22a.75.75 0 0 0-1.06 0l-1.91 1.91-.48-.48a.75.75 0 0 0-1.06 0L9 12.56 7.28 10.84a.75.75 0 0 0-1.06 0l-3.72 3.72ZM6.5 7.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" clipRule="evenodd" />
    </svg>
  );
}

function ApprovalsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M4.75 2A2.75 2.75 0 0 0 2 4.75v10.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25V4.75A2.75 2.75 0 0 0 15.25 2H4.75ZM6.5 5.75a.75.75 0 0 0 0 1.5h7a.75.75 0 0 0 0-1.5h-7Zm0 3.5a.75.75 0 0 0 0 1.5h4.25a.75.75 0 0 0 0-1.5H6.5Zm0 3.5a.75.75 0 0 0 0 1.5h2.75a.75.75 0 0 0 0-1.5H6.5Zm7.28-2.22a.75.75 0 0 0-1.06-1.06l-1.47 1.47-.47-.47a.75.75 0 0 0-1.06 1.06l1 1a.75.75 0 0 0 1.06 0l2-2Z" clipRule="evenodd" />
    </svg>
  );
}

const navItems = [
  { href: "/admin",            label: "Dashboard",   icon: DashboardIcon,  exact: true  },
  { href: "/admin/agents",     label: "Agents",      icon: AgentsIcon,     exact: false },
  { href: "/admin/approvals",  label: "Approvals",   icon: ApprovalsIcon,  exact: false },
  { href: "/admin/landlords",  label: "Landlords",   icon: LandlordsIcon,  exact: false },
  { href: "/admin/properties", label: "Properties",  icon: PropertiesIcon, exact: false },
  { href: "/admin/sales",      label: "Sales",       icon: SalesIcon,      exact: false },
  { href: "/admin/tenants",             label: "Tenants",            icon: TenantsIcon,            exact: false },
  { href: "/admin/potential-tenants",    label: "Potential Tenants",   icon: PotentialTenantsIcon,    exact: false },
  { href: "/admin/potential-landlords", label: "Potential Landlords", icon: PotentialLandlordsIcon,  exact: false },
  { href: "/admin/audit",      label: "Audit Logs",  icon: AuditIcon,      exact: false },
  { href: "/admin/commission", label: "Commission",  icon: CommissionIcon, exact: false },
  { href: "/admin/dialer-domain",   label: "Dialer Settings", icon: DialerIcon,        exact: false },
  { href: "/admin/reports",         label: "Reports",         icon: ReportsIcon,       exact: false },
  { href: "/admin/media-library",   label: "Media Library",   icon: MediaLibraryIcon,  exact: false },
];

export function AdminShell({ user, userId, chatContacts, children }: Props) {
  const pathname = usePathname();

  const initials = user.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email[0].toUpperCase();

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    return pathname?.startsWith(href) ?? false;
  }

  // Compute breadcrumb label
  const activeItem = navItems.find((item) =>
    item.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(item.href)
  );
  const breadcrumbLabel = activeItem?.label ?? "Admin";

  return (
    <div className="admin-shell">
      {/* ── Sidebar ── */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lp-logo.webp" alt="Letting Partners" />
          <span className="admin-sidebar-badge">Admin</span>
        </div>

        <nav className="admin-sidebar-nav">
          <span className="admin-nav-section">Navigation</span>

          {navItems.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              className={`admin-nav-link${isActive(href, exact) ? " admin-nav-link-active" : ""}`}
            >
              <Icon />
              {label}
            </Link>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <Link href="/admin/profile" className="admin-user-card" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer" }}>
            {user.profilePicture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.profilePicture} alt="Profile" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1.5px solid var(--brand-gold)" }} />
            ) : (
              <div className="admin-user-avatar">{initials}</div>
            )}
            <div className="admin-user-info">
              <div className="admin-user-name">{user.name || "Admin"}</div>
              <div className="admin-user-email">{user.email}</div>
            </div>
          </Link>
          <NavLogoutButton />
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="admin-content">
        {/* Top bar */}
        <div className="admin-topbar">
          <div className="admin-topbar-left">
            <div className="admin-topbar-breadcrumb">
              <span>Admin</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 20 20"
                fill="currentColor"
                style={{ opacity: 0.4 }}
              >
                <path
                  fillRule="evenodd"
                  d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="current">{breadcrumbLabel}</span>
            </div>
          </div>

          <div className="admin-topbar-meta">
            <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{user.name || user.email}</span>
            <span className="badge badge-admin">Admin</span>
          </div>
        </div>

        {/* Page content */}
        <div className="admin-page">{children}</div>

        <div className="shell-credit-wrap">
          <a
            className="shell-credit-pill"
            href="https://itmetasolutions.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Design &amp; Development by IT Meta Solutions
          </a>
        </div>
      </div>

      <FloatingChat userId={userId} contacts={chatContacts} isAdmin />
    </div>
  );
}
