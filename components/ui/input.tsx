import type { InputHTMLAttributes } from "react";

export function UIInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${className}`.trim()} {...props} />;
}
