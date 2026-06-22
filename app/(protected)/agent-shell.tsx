"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { NavLogoutButton } from "@/components/nav-logout-button";
import { FloatingChat } from "@/components/floating-chat";
import { NotificationsBell } from "@/components/notifications-bell";

type AgentUser = {
  name: string;
  email: string;
  profilePicture?: string | null;
};

type ChatContact = { id: string; name: string; email: string; role?: string; profilePicture?: string | null };

type Props = {
  user: AgentUser;
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

function LandlordsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PropertiesIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M4 2a2 2 0 0 0-2 2v11a3 3 0 1 0 6 0V4a2 2 0 0 0-2-2H4Zm1 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm5-1.757 4.9-4.9a2 2 0 0 0 0-2.828L13.485 5.1a2 2 0 0 0-2.828 0L10 5.757v8.486ZM16 17H9.071l6-6H16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SalesIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
        clipRule="evenodd"
      />
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


function DialerIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M2 4.75A2.75 2.75 0 0 1 4.75 2h2.5A2.75 2.75 0 0 1 10 4.75v10.5A2.75 2.75 0 0 1 7.25 18h-2.5A2.75 2.75 0 0 1 2 15.25V4.75Zm10 0A2.75 2.75 0 0 1 14.75 2h.5A2.75 2.75 0 0 1 18 4.75v3.5a.75.75 0 0 1-1.5 0v-3.5c0-.69-.56-1.25-1.25-1.25h-.5c-.69 0-1.25.56-1.25 1.25v10.5c0 .69.56 1.25 1.25 1.25h.5c.69 0 1.25-.56 1.25-1.25v-3.5a.75.75 0 0 1 1.5 0v3.5A2.75 2.75 0 0 1 15.25 18h-.5A2.75 2.75 0 0 1 12 15.25V4.75Z" />
    </svg>
  );
}

function CallHistoryIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 2.5a7.5 7.5 0 1 0 7.387 8.804.75.75 0 1 0-1.476-.26A6 6 0 1 1 10 4a6 6 0 0 1 5.192 2.995H13a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 .75-.75v-3.5a.75.75 0 1 0-1.5 0v1.568A7.489 7.489 0 0 0 10 2.5Zm-.75 3.5a.75.75 0 0 1 1.5 0v3.19l2.03 1.218a.75.75 0 0 1-.772 1.286l-2.392-1.435a.75.75 0 0 1-.366-.643V6Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IntercallingIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M2.5 5A2.5 2.5 0 0 1 5 2.5h2A2.5 2.5 0 0 1 9.5 5v1A2.5 2.5 0 0 1 7 8.5H5A2.5 2.5 0 0 1 2.5 6V5Zm8 9A2.5 2.5 0 0 1 13 11.5h2a2.5 2.5 0 0 1 2.5 2.5v1A2.5 2.5 0 0 1 15 17.5h-2a2.5 2.5 0 0 1-2.5-2.5v-1ZM6.75 11a.75.75 0 0 1 0-1.5h6.94l-1.22-1.22a.75.75 0 0 1 1.06-1.06l2.5 2.5a.75.75 0 0 1 0 1.06l-2.5 2.5a.75.75 0 0 1-1.06-1.06l1.22-1.22H6.75Z" />
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

function DailyReportIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M5 4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1V4Zm3 0h4v1H8V4Zm-4 4h12v8H4V8Zm2 2a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm0 3a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Z" clipRule="evenodd" />
    </svg>
  );
}

function CallRecordsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M2 3a1 1 0 0 1 1-1h2.153a1 1 0 0 1 .986.836l.74 4.435a1 1 0 0 1-.54 1.06l-1.548.773a11.037 11.037 0 0 0 6.105 6.105l.774-1.548a1 1 0 0 1 1.059-.54l4.435.74a1 1 0 0 1 .836.986V17a1 1 0 0 1-1 1h-2C7.82 18 2 12.18 2 5V3Z" />
    </svg>
  );
}

function NotesIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 0 4.243 3 3 0 0 0 4.243 0l.741-.741a.75.75 0 1 1 1.06 1.06l-.741.741a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.364 6.364l-4 4a2.25 2.25 0 0 1-3.182-3.182l5.5-5.5a.75.75 0 0 1 1.061 1.06l-5.5 5.5a.75.75 0 0 0 1.06 1.061l4-4a3 3 0 0 0 0-4.243Z" clipRule="evenodd" />
    </svg>
  );
}

function ContactsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 9a7 7 0 1 1 14 0H3Zm12.25-8a.75.75 0 0 1 .75.75V12h1.25a.75.75 0 0 1 0 1.5H16v1.25a.75.75 0 0 1-1.5 0V13.5h-1.25a.75.75 0 0 1 0-1.5h1.25v-1.25a.75.75 0 0 1 .75-.75Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function TemplatesIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm2 6a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2H7Z" clipRule="evenodd" />
    </svg>
  );
}


const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon, exact: true },
  { href: "/dialer", label: "Dialpad", icon: DialerIcon, exact: true },
  { href: "/dialer/history", label: "Call History", icon: CallHistoryIcon, exact: false },
  { href: "/dialer/intercalling", label: "Intercalling", icon: IntercallingIcon, exact: false },
  { href: "/dialer/contacts", label: "Contacts", icon: ContactsIcon, exact: false },
  { href: "/landlords", label: "Landlords", icon: LandlordsIcon, exact: false },
  { href: "/portal/properties", label: "Properties", icon: PropertiesIcon, exact: false },
  { href: "/sales", label: "Sales", icon: SalesIcon, exact: false },
  { href: "/tenants", label: "Tenants", icon: TenantsIcon, exact: false },
  { href: "/potential-tenants", label: "Potential Tenants", icon: PotentialTenantsIcon, exact: false },
  { href: "/potential-landlords", label: "Potential Landlords", icon: PotentialLandlordsIcon, exact: false },
  { href: "/daily-reports", label: "Daily Reports", icon: DailyReportIcon, exact: false },
  { href: "/call-records", label: "Call Records", icon: CallRecordsIcon, exact: false },
  { href: "/notes", label: "My Notes", icon: NotesIcon, exact: false },
  { href: "/templates", label: "Templates", icon: TemplatesIcon, exact: false },
];

export function AgentShell({ user, userId, chatContacts, children }: Props) {
  const pathname = usePathname();

  const initials = user.name
    ? user.name
        .split(" ")
        .map((word) => word[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email[0].toUpperCase();

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    return pathname?.startsWith(href) ?? false;
  }

  const activeItem = navItems.find((item) =>
    item.exact ? pathname === item.href : pathname?.startsWith(item.href),
  );

  return (
    <div className="agent-shell">
      <aside className="agent-sidebar">
        <div className="agent-sidebar-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lp-logo.webp" alt="Letting Partners" />
          <span className="agent-sidebar-badge">Agent</span>
        </div>

        <nav className="agent-sidebar-nav">
          <span className="agent-nav-section">Navigation</span>
          {navItems.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              className={`agent-nav-link${isActive(href, exact) ? " agent-nav-link-active" : ""}`}
            >
              <Icon />
              {label}
            </Link>
          ))}
        </nav>

        <div className="agent-sidebar-footer">
          <Link href="/profile" className="agent-user-card" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer" }}>
            {user.profilePicture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.profilePicture} alt="Profile" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1.5px solid var(--brand-gold)" }} />
            ) : (
              <div className="agent-user-avatar">{initials}</div>
            )}
            <div className="agent-user-info">
              <div className="agent-user-name">{user.name || "Agent"}</div>
              <div className="agent-user-email">{user.email}</div>
            </div>
          </Link>
          <NavLogoutButton />
        </div>
      </aside>

      <div className="agent-content">
        <div className="agent-topbar">
          <div className="agent-topbar-left">
            <div className="agent-topbar-breadcrumb">
              <span>Agent</span>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style={{ opacity: 0.4 }}>
                <path
                  fillRule="evenodd"
                  d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
                <span className="current">{activeItem?.label ?? "Dashboard"}</span>
            </div>
          </div>

          <div className="agent-topbar-right">
            <NotificationsBell />
            <span className="agent-topbar-meta">{user.name || user.email}</span>
          </div>
        </div>

        <div className="agent-page">{children}</div>

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

      <FloatingChat userId={userId} contacts={chatContacts} />
    </div>
  );
}
