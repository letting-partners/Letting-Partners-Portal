/* eslint-disable @next/next/no-img-element */

/**
 * Avatar with an initials fallback. Uses a plain <img> rather than next/image
 * because sources are arbitrary blob URLs at tiny fixed sizes, where the
 * optimiser adds cost without benefit.
 */

export type AvatarSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<AvatarSize, string> = {
  sm: "avatar avatar--sm",
  md: "avatar",
  lg: "avatar avatar--lg",
  xl: "avatar avatar--xl",
};

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[parts.length - 1][0]}`;
}

export function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string | null;
  size?: AvatarSize;
}) {
  return (
    <span className={SIZE_CLASS[size]} aria-hidden="true">
      {src ? <img src={src} alt="" loading="lazy" /> : initialsOf(name)}
    </span>
  );
}

/** Avatar plus name, the standard way a person appears in a table row. */
export function Person({
  name,
  src,
  meta,
  size = "sm",
}: {
  name: string | null | undefined;
  src?: string | null;
  meta?: string | null;
  size?: AvatarSize;
}) {
  if (!name) return <span className="subtle">Unassigned</span>;

  return (
    <span className="person">
      <Avatar name={name} src={src} size={size} />
      <span style={{ minWidth: 0 }}>
        <span className="person-name">{name}</span>
        {meta && (
          <span className="table-secondary" style={{ display: "block" }}>
            {meta}
          </span>
        )}
      </span>
    </span>
  );
}
