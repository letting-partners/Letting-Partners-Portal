import type { SelectHTMLAttributes } from "react";

export function UISelect({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`select ${className}`.trim()} {...props} />;
}
