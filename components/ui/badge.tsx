import type { HTMLAttributes } from "react";

type BadgeType = "ACTIVE" | "PASSIVE";

type Props = HTMLAttributes<HTMLSpanElement> & {
  status: BadgeType;
};

export function UIStatusBadge({ status, className = "", ...props }: Props) {
  const style = status === "ACTIVE" ? "badge-active" : "badge-passive";
  return (
    <span className={`badge ${style} ${className}`.trim()} {...props}>
      {status}
    </span>
  );
}
