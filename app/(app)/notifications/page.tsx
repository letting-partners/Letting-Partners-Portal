import type { Metadata } from "next";
import { pageAccess } from "@/lib/auth/page-guard";
import Link from "next/link";
import { Bell } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { formatDateTime, formatRelative } from "@/lib/dates";
import { listNotifications, unreadCount } from "@/services/notifications";
import MarkAllRead from "./MarkAllRead";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const context = await pageAccess();

  const [notifications, unread] = await Promise.all([
    listNotifications(context.user.id, 100),
    unreadCount(context.user.id),
  ]);

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : "You are up to date."}
        actions={unread > 0 ? <MarkAllRead /> : undefined}
      />

      <div className="card">
        {notifications.length === 0 ? (
          <EmptyState
            icon={<Bell size={18} />}
            title="Nothing yet"
            message="Follow-ups coming due, cross-sell requests, deal updates and website enquiries all appear here."
          />
        ) : (
          <ul>
            {notifications.map((notification) => (
              <li
                key={notification.id}
                style={{
                  borderBottom: "1px solid var(--border)",
                  background: notification.readAt ? undefined : "var(--surface-2)",
                }}
              >
                <Link
                  href={notification.href ?? "/dashboard"}
                  style={{ display: "block", padding: "12px 16px" }}
                >
                  <div className="row row--between">
                    <strong style={{ fontWeight: notification.readAt ? 500 : 700 }}>
                      {notification.title}
                    </strong>
                    <span className="subtle small" title={formatDateTime(notification.createdAt)}>
                      {formatRelative(notification.createdAt)}
                    </span>
                  </div>
                  {notification.body && (
                    <p className="muted small" style={{ marginTop: 3 }}>
                      {notification.body}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
