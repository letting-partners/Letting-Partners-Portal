"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

/**
 * Filters and pagination live in the URL.
 *
 * That keeps the server the single source of truth for what is on screen, and
 * it means a filtered view can be bookmarked, shared with a colleague, and
 * survives the back button.
 */

const SEARCH_DEBOUNCE_MS = 350;

function useQueryUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(
    (updates: Record<string, string | null>, options: { resetPage?: boolean } = {}) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }

      // Any change to a filter puts the user back on page one, otherwise they
      // can land on an empty page 4 of a 2 page result.
      if (options.resetPage !== false) params.delete("page");

      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );
}

export function SearchInput({
  placeholder = "Search...",
  paramName = "q",
}: {
  placeholder?: string;
  paramName?: string;
}) {
  const searchParams = useSearchParams();
  const update = useQueryUpdater();
  const initial = searchParams.get(paramName) ?? "";
  const [value, setValue] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep in step when the URL changes from elsewhere (back button, clear all).
  useEffect(() => {
    setValue(searchParams.get(paramName) ?? "");
  }, [searchParams, paramName]);

  const onChange = (next: string) => {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => update({ [paramName]: next || null }), SEARCH_DEBOUNCE_MS);
  };

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <div className="input-group filter-bar-search">
      <Search size={14} aria-hidden="true" />
      <input
        type="search"
        className="input"
        placeholder={placeholder}
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function FilterSelect({
  paramName,
  label,
  options,
  allLabel = "All",
}: {
  paramName: string;
  label: string;
  options: { value: string; label: string }[];
  allLabel?: string;
}) {
  const searchParams = useSearchParams();
  const update = useQueryUpdater();
  const value = searchParams.get(paramName) ?? "";

  return (
    <select
      className="select"
      aria-label={label}
      value={value}
      onChange={(event) => update({ [paramName]: event.target.value || null })}
      style={{ width: "auto", minWidth: 150 }}
    >
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function ClearFilters({ keys }: { keys: string[] }) {
  const searchParams = useSearchParams();
  const update = useQueryUpdater();

  const active = useMemo(
    () => keys.filter((key) => searchParams.get(key)).length,
    [keys, searchParams],
  );

  if (active === 0) return null;

  return (
    <button
      type="button"
      className="btn btn--ghost btn--sm"
      onClick={() => update(Object.fromEntries(keys.map((key) => [key, null])))}
    >
      <X size={13} />
      Clear {active} filter{active === 1 ? "" : "s"}
    </button>
  );
}

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
}) {
  const update = useQueryUpdater();

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <span>
        {total === 0
          ? "No results"
          : `Showing ${from}-${to} of ${total.toLocaleString("en-GB")}`}
      </span>

      {pageCount > 1 && (
        <div className="pagination-controls">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            disabled={page <= 1}
            onClick={() => update({ page: String(page - 1) }, { resetPage: false })}
          >
            Previous
          </button>
          <span className="numeric" style={{ padding: "0 6px" }}>
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            disabled={page >= pageCount}
            onClick={() => update({ page: String(page + 1) }, { resetPage: false })}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
