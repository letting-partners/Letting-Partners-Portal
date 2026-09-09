"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

/**
 * The contextual action menu used at the end of every table row.
 *
 * Rows carry one discreet trigger rather than a wall of buttons, so the table
 * stays readable and the primary action on a page keeps its emphasis.
 *
 * The panel is rendered into the document body rather than beside the trigger.
 * Tables scroll horizontally, which means `overflow: auto`, which clips any
 * absolutely positioned child no matter how high its z-index - the menu on the
 * last row was being cut off by the edge of its own table. Portalling escapes
 * the clip; the trade is that the position must be measured and kept in step
 * with scrolling, which is what the effects below do.
 */

const MENU_WIDTH = 190;
const GAP = 4;
const VIEWPORT_MARGIN = 8;

type Position = { top: number; left: number; placement: "below" | "above" };

export function RowMenu({
  label = "Row actions",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const panelHeight = panelRef.current?.offsetHeight ?? 0;
    const spaceBelow = window.innerHeight - rect.bottom;

    // Open upwards when the row is near the bottom of the window and there is
    // more room above - the case where the menu used to be unreachable.
    const placement: Position["placement"] =
      panelHeight > 0 && spaceBelow < panelHeight + GAP + VIEWPORT_MARGIN && rect.top > spaceBelow
        ? "above"
        : "below";

    const top = placement === "above" ? rect.top - panelHeight - GAP : rect.bottom + GAP;

    // Right-aligned to the trigger, but never off the left edge.
    const left = Math.max(VIEWPORT_MARGIN, rect.right - MENU_WIDTH);

    setPosition({ top, left, placement });
  }, []);

  // Measure before paint so the panel never appears in the wrong place first.
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    // Capture, so a scroll inside the table itself is seen and not just one on
    // the window.
    function onReflow() {
      place();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn--ghost btn--icon btn--sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal size={16} />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            className="menu menu--floating"
            role="menu"
            style={{
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              width: MENU_WIDTH,
              // Hidden until measured, so it cannot flash at the wrong spot.
              visibility: position ? "visible" : "hidden",
            }}
            onClick={() => setOpen(false)}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
