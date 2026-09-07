import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import AppShell from "@/components/shell/AppShell";
import Topbar from "@/components/shell/Topbar";
import { getAccessContext } from "@/services/permissions";
import { getShellBadges } from "@/services/badges";
import { listNotifications, unreadCount } from "@/services/notifications";
import { isThemePreference, THEME_COOKIE } from "@/lib/theme";

/**
 * The authenticated shell. Every page under this layout is guaranteed a
 * signed-in user - but each route still checks its own permission, because a
 * layout is not an authorisation boundary for route handlers or actions.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const context = await getAccessContext();
  if (!context) redirect("/login");

  const [badges, notifications, unread, cookieStore] = await Promise.all([
    getShellBadges(context),
    listNotifications(context.user.id, 8),
    unreadCount(context.user.id),
    cookies(),
  ]);

  // The cookie is authoritative for the current device; the stored preference
  // is the fallback when this device has not chosen yet.
  const cookieTheme = cookieStore.get(THEME_COOKIE)?.value;
  const theme = isThemePreference(cookieTheme) ? cookieTheme : context.user.themePreference;

  return (
    <AppShell
      user={{
        id: context.user.id,
        fullName: context.user.fullName,
        role: context.user.role,
        avatarUrl: context.user.avatarUrl,
        jobTitle: context.user.jobTitle,
      }}
      badges={badges}
      topbar={
        <Topbar
          theme={theme}
          unread={unread}
          notifications={notifications.map((item) => ({
            id: item.id,
            title: item.title,
            body: item.body,
            href: item.href,
            createdAt: item.createdAt.toISOString(),
            read: item.readAt !== null,
          }))}
        />
      }
    >
      {children}
    </AppShell>
  );
}
