import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/** Page and card scaffolding shared by every screen in the portal. */

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-title-group">
        {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {index > 0 && <ChevronRight size={12} className="breadcrumbs-sep" aria-hidden="true" />}
          {item.href ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function Card({
  title,
  actions,
  footer,
  flush = false,
  children,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="card">
      {(title || actions) && (
        <div className="card-header">
          {typeof title === "string" ? <h2 className="card-title">{title}</h2> : title}
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      <div className={flush ? "card-body card-body--flush" : "card-body"}>{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </section>
  );
}

export function StatCard({
  label,
  value,
  meta,
  delta,
  icon,
  href,
}: {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  delta?: { value: number; suffix?: string } | null;
  icon?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <div className="stat-label">
        {icon}
        {label}
      </div>
      <div className="stat-value">{value}</div>
      {(meta || delta) && (
        <div className="stat-meta">
          {delta && (
            <span className={`stat-delta stat-delta--${delta.value >= 0 ? "up" : "down"}`}>
              {delta.value >= 0 ? "+" : ""}
              {delta.value}
              {delta.suffix ?? "%"}
            </span>
          )}
          {delta && meta ? " " : null}
          {meta}
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="stat" style={{ display: "block" }}>
        {body}
      </Link>
    );
  }

  return <div className="stat">{body}</div>;
}

/**
 * Empty states always say what the screen is for and what to do next - a bare
 * "No results" leaves a new user stuck.
 */
export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: ReactNode;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <h3>{title}</h3>
      <p>{message}</p>
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div style={{ padding: 14 }} aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton skeleton--row" />
      ))}
    </div>
  );
}

export function DefinitionList({
  items,
}: {
  items: { term: string; value: ReactNode }[];
}) {
  return (
    <dl className="definition-list">
      {items.map((item) => (
        <div key={item.term}>
          <dt>{item.term}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
