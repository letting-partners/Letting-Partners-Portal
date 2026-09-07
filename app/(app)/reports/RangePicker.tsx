"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Date range presets shared by every report screen. */

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
];

export default function RangePicker() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = searchParams.get("range") ?? "today";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  function update(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="row row--wrap">
      <div className="segmented" role="group" aria-label="Report range">
        {PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            aria-pressed={current === preset.value}
            onClick={() => update({ range: preset.value, from: null, to: null })}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <input
        type="date"
        className="input"
        style={{ width: "auto" }}
        aria-label="From date"
        value={from}
        onChange={(event) => update({ range: "custom", from: event.target.value })}
      />
      <input
        type="date"
        className="input"
        style={{ width: "auto" }}
        aria-label="To date"
        value={to}
        onChange={(event) => update({ range: "custom", to: event.target.value })}
      />
    </div>
  );
}
