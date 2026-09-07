"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Autosave for long forms.
 *
 * The onboarding wizard takes several minutes to complete. If the browser is
 * closed or refreshed halfway through, the work must still be there. The draft
 * is per-device by nature (it is an unsubmitted form), so localStorage is the
 * right home for it - every access is guarded because storage can be blocked
 * or throw in a private window.
 */

const SAVE_DEBOUNCE_MS = 800;

export type DraftState<T> = {
  /** Restored value, or null when there was no draft. */
  restored: T | null;
  savedAt: Date | null;
  save: (value: T) => void;
  clear: () => void;
};

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { value: T; savedAt: string };
    return parsed.value ?? null;
  } catch {
    return null;
  }
}

export function useDraft<T>(key: string): DraftState<T> {
  const [restored, setRestored] = useState<T | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read after mount so server and client markup match on first paint.
  useEffect(() => {
    setRestored(read<T>(key));
  }, [key]);

  const save = useCallback(
    (value: T) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        try {
          const savedAtIso = new Date().toISOString();
          window.localStorage.setItem(key, JSON.stringify({ value, savedAt: savedAtIso }));
          setSavedAt(new Date(savedAtIso));
        } catch {
          // Storage unavailable: the form still works, it just will not resume.
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [key],
  );

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing to do.
    }
    setSavedAt(null);
  }, [key]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { restored, savedAt, save, clear };
}

function describeSavedAt(savedAt: Date): string {
  const seconds = Math.max(0, Math.round((Date.now() - savedAt.getTime()) / 1000));
  if (seconds < 10) return "Saved just now";
  if (seconds < 60) return `Saved ${seconds} seconds ago`;
  const minutes = Math.round(seconds / 60);
  return `Saved ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
}

/**
 * "Saved 12 seconds ago", refreshed on a timer so it stays truthful.
 * The clock is read in an effect rather than during render, because reading
 * the time while rendering makes the output depend on when React happens to
 * re-render.
 */
export function useSavedLabel(savedAt: Date | null): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!savedAt) {
      setLabel(null);
      return;
    }

    setLabel(describeSavedAt(savedAt));
    const interval = setInterval(() => setLabel(describeSavedAt(savedAt)), 10_000);
    return () => clearInterval(interval);
  }, [savedAt]);

  return label;
}
