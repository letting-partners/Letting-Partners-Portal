"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { isActivePath, navigationForRole, ROLE_LABELS, type Role } from "@/lib/navigation";
import { Avatar } from "@/components/ui/Avatar";
import ChatWidget from "@/components/shell/ChatWidget";
import { StartCallButton, StartCallProvider } from "@/components/calls/StartCall";

export type ShellUser = {
  id: string;
  fullName: string;
  role: Role;
  avatarUrl: string | null;
  jobTitle: string | null;
};

export type ShellBadges = {
  followUpsDue: number;
  customerChats: number;
  internalChats: number;
  notifications: number;
  crossSell: number;
};

const COLLAPSE_KEY = "lp_portal_sidebar_collapsed";

export default function AppShell({
  user,
  badges,
  topbar,
  children,
}: {
  user: ShellUser;
  badges: ShellBadges;
  topbar: React.ReactNode;
  children: React.ReactNode;
}) {
  // Customer chat is closed to fronters, so their widget shows only the team tab.
  const canUseCustomerChat = user.role !== "FRONTER";
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Rail preference is a per-device convenience, so localStorage is the right
  // home for it. Read after mount to keep the server and client markup equal.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "true");
    } catch {
      // Private mode or blocked storage: the default expanded rail is fine.
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        // Ignore - the preference simply will not persist.
      }
      return next;
    });
  }, []);

  // Any navigation closes the mobile drawer.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const groups = navigationForRole(user.role);

  return (
    <StartCallProvider>
      <div className="app-shell" data-collapsed={collapsed} data-mobile-open={mobileOpen}>
        <div
          className="sidebar-scrim"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />

        <nav className="sidebar" aria-label="Main navigation">
          <Link href="/dashboard" className="sidebar-brand" aria-label="Letting Partners dashboard">
            <img src="/lp-logo.webp" alt="Letting Partners" />
          </Link>

          <div className="sidebar-cta">
            <StartCallButton className="btn btn--primary btn--block">
              <span className="sidebar-link-label">Start call</span>
            </StartCallButton>
          </div>

          <div className="sidebar-nav">
            {groups.map((group) => (
              <div className="sidebar-group" key={group.label}>
                <div className="sidebar-group-label">{group.label}</div>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActivePath(pathname, item.href);
                  const count = item.badge ? badges[item.badge] : 0;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="sidebar-link"
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon size={16} aria-hidden="true" />
                      <span className="sidebar-link-label">{item.label}</span>
                      {count > 0 && (
                        <span className="sidebar-link-badge">
                          {count > 99 ? "99+" : count}
                          <span className="sr-only"> unread</span>
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="sidebar-footer">
            <Link href="/profile" className="sidebar-user">
              <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
              <span className="sidebar-user-meta">
                <span className="sidebar-user-name">{user.fullName}</span>
                <span className="sidebar-user-role">
                  {user.jobTitle ?? ROLE_LABELS[user.role]}
                </span>
              </span>
            </Link>

            <button
              type="button"
              className="sidebar-user desktop-only"
              onClick={toggleCollapsed}
              aria-pressed={collapsed}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
              <span className="sidebar-user-meta">
                <span className="sidebar-user-name" style={{ fontWeight: 500 }}>
                  Collapse menu
                </span>
              </span>
            </button>
          </div>
        </nav>

        <div className="app-main">
          <header className="topbar">
            <button
              type="button"
              className="btn btn--ghost btn--icon mobile-only"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </button>
            {topbar}
          </header>

          <main className="page" id="main-content">
            {children}
          </main>
        </div>

        <ChatWidget canUseCustomer={canUseCustomerChat} />
      </div>
    </StartCallProvider>
  );
}
