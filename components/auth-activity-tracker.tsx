"use client";

import { useEffect, useRef } from "react";

const TOUCH_THROTTLE_MS = 5 * 60 * 1000;

export function AuthActivityTracker() {
  const lastSentAtRef = useRef(0);

  useEffect(() => {
    let isDisposed = false;

    async function touchActivity(force = false) {
      const now = Date.now();
      if (!force && now - lastSentAtRef.current < TOUCH_THROTTLE_MS) {
        return;
      }

      lastSentAtRef.current = now;

      try {
        await fetch("/api/auth/activity", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: "{}",
          keepalive: true,
        });
      } catch {
        if (!isDisposed) {
          lastSentAtRef.current = 0;
        }
      }
    }

    function handleInteraction() {
      void touchActivity();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void touchActivity(true);
      }
    }

    void touchActivity(true);

    window.addEventListener("focus", handleInteraction);
    window.addEventListener("pointerdown", handleInteraction, { passive: true });
    window.addEventListener("keydown", handleInteraction);
    window.addEventListener("scroll", handleInteraction, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isDisposed = true;
      window.removeEventListener("focus", handleInteraction);
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
      window.removeEventListener("scroll", handleInteraction);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
