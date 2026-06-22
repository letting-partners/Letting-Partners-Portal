import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function UIButton({ variant = "primary", className = "", ...props }: Props) {
  const variantClass =
    variant === "primary" ? "btn-primary" : variant === "danger" ? "btn-danger" : "btn-secondary";

  return <button className={`btn ${variantClass} ${className}`.trim()} {...props} />;
}
