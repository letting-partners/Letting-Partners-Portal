import type { HTMLAttributes } from "react";

export function UICard({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`panel ${className}`.trim()} {...props} />;
}

export function UICardBody({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`panel-body ${className}`.trim()} {...props} />;
}
