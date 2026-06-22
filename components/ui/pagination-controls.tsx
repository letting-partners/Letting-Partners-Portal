"use client";

import { UIButton } from "@/components/ui/button";
import { UISelect } from "@/components/ui/select";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  busy?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

const PAGE_SIZE_OPTIONS = [50, 100, 150, 200];

export function PaginationControls({
  page,
  pageSize,
  total,
  totalPages,
  busy = false,
  onPageChange,
  onPageSizeChange,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.75rem",
        flexWrap: "wrap",
      }}
    >
      <div className="inline-row">
        <span className="muted" style={{ fontSize: "0.82rem" }}>
          {total} records
        </span>
        <label className="inline-row">
          <span className="label">Rows</span>
          <UISelect
            value={String(pageSize)}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            disabled={busy}
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} per page
              </option>
            ))}
          </UISelect>
        </label>
      </div>

      <div className="inline-row">
        <UIButton
          variant="secondary"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={busy || page <= 1}
        >
          Previous
        </UIButton>
        <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
          {page} / {Math.max(totalPages, 1)}
        </span>
        <UIButton
          variant="secondary"
          onClick={() => onPageChange(Math.min(Math.max(totalPages, 1), page + 1))}
          disabled={busy || page >= totalPages || totalPages === 0}
        >
          Next
        </UIButton>
      </div>
    </div>
  );
}
