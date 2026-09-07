"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  LogOut,
  Monitor,
  Moon,
  Search,
  Sun,
  User as UserIcon,
} from "lucide-react";
import { setThemeAction, signOutAction } from "@/app/actions/session";
import { THEME_LABELS, THEME_OPTIONS, type ThemePreference } from "@/lib/theme";
import { formatRelative } from "@/lib/dates";

export type TopbarNotification = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: string;
  read: boolean;
};

export default function Topbar({
  theme,
  notifications,
  unread,
}: {
  theme: ThemePreference;
  notifications: TopbarNotification[];
  unread: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl + K focuses search from anywhere, the shortcut people expect.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <form
        className="topbar-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = query.trim();
          if (trimmed) router.push(`/search?q=${encodeURIComponent(trimmed)}`);
        }}
      >
        <div className="input-group">
          <Search size={15} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            className="input"
            placeholder="Search landlords, properties, phone numbers..."
            aria-label="Search the portal"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </form>

      <div className="topbar-spacer" />

      <NotificationsMenu notifications={notifications} unread={unread} />
      <ThemeMenu theme={theme} />
      <ProfileMenu />
    </>
  );
}

/* ------------------------------------------------------------ dropdowns */

function useDismissable(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return ref;
}

function NotificationsMenu({
  notifications,
  unread,
}: {
  notifications: TopbarNotification[];
  unread: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismissable(() => setOpen(false));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="btn btn--ghost btn--icon"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <Bell size={17} />
        {unread > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--status-danger-fg)",
            }}
          />
        )}
      </button>

      {open && (
        <div className="menu" style={{ right: 0, top: "calc(100% + 6px)", width: 320 }} role="menu">
          <div className="row row--between" style={{ padding: "6px 9px" }}>
            <strong style={{ fontSize: "0.8rem" }}>Notifications</strong>
            <Link href="/notifications" className="small" style={{ color: "var(--text-muted)" }}>
              View all
            </Link>
          </div>
          <div className="menu-separator" />

          {notifications.length === 0 ? (
            <p className="subtle small" style={{ padding: "12px 9px" }}>
              Nothing new. Follow-ups, chats and deal updates will appear here.
            </p>
          ) : (
            <div style={{ maxHeight: 340, overflowY: "auto" }}>
              {notifications.map((item) => (
                <Link
                  key={item.id}
                  href={item.href ?? "/notifications"}
                  className="menu-item"
                  style={{ alignItems: "flex-start", flexDirection: "column", gap: 2 }}
                >
                  <span style={{ fontWeight: item.read ? 500 : 700 }}>{item.title}</span>
                  {item.body && <span className="subtle small">{item.body}</span>}
                  <span className="subtle" style={{ fontSize: "0.7rem" }}>
                    {formatRelative(item.createdAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ThemeMenu({ theme }: { theme: ThemePreference }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(theme);
  const ref = useDismissable(() => setOpen(false));
  const router = useRouter();

  function choose(preference: ThemePreference) {
    setCurrent(preference);
    setOpen(false);
    // Apply immediately so the change is instant, then persist.
    applyTheme(preference);
    startTransition(async () => {
      await setThemeAction(preference);
      router.refresh();
    });
  }

  const Icon = current === "DARK" ? Moon : current === "LIGHT" ? Sun : Monitor;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="btn btn--ghost btn--icon"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Change theme"
        disabled={pending}
      >
        <Icon size={17} />
      </button>

      {open && (
        <div className="menu" style={{ right: 0, top: "calc(100% + 6px)" }} role="menu">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className="menu-item"
              role="menuitemradio"
              aria-checked={current === option}
              onClick={() => choose(option)}
            >
              {option === "LIGHT" && <Sun size={15} />}
              {option === "DARK" && <Moon size={15} />}
              {option === "SYSTEM" && <Monitor size={15} />}
              <span style={{ flex: 1 }}>{THEME_LABELS[option]}</span>
              {current === option && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Stamp the choice on <html> straight away; the cookie keeps it after reload. */
function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === "SYSTEM") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference.toLowerCase());
}

function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useDismissable(() => setOpen(false));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="btn btn--ghost btn--icon"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        <UserIcon size={17} />
      </button>

      {open && (
        <div className="menu" style={{ right: 0, top: "calc(100% + 6px)" }} role="menu">
          <Link href="/profile" className="menu-item">
            <UserIcon size={15} />
            Profile and preferences
          </Link>
          <div className="menu-separator" />
          <form action={signOutAction}>
            <button type="submit" className="menu-item menu-item--danger" style={{ width: "100%" }}>
              <LogOut size={15} />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
