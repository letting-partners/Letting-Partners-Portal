"use client";

import type { InputHTMLAttributes } from "react";
import { UIInput } from "@/components/ui/input";
import { normalizePostcode } from "@/lib/normalize";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
};

export function UppercasePostcodeInput({ value, onChange, ...props }: Props) {
  return (
    <UIInput
      {...props}
      value={value}
      onChange={(event) => onChange(normalizePostcode(event.target.value))}
      autoCapitalize="characters"
      spellCheck={false}
    />
  );
}