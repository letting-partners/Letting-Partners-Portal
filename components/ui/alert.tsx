import type { HTMLAttributes } from "react";

type AlertType = "success" | "error";

type Props = HTMLAttributes<HTMLDivElement> & {
  type: AlertType;
};

export function UIAlert({ type, className = "", ...props }: Props) {
  const style = type === "success" ? "alert-success" : "alert-error";
  return <div className={`alert ${style} ${className}`.trim()} {...props} />;
}
