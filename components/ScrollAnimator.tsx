"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function ScrollAnimator() {
  const pathname = usePathname();

  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    let frameId = 0;

    frameId = window.requestAnimationFrame(() => {
      const elements = document.querySelectorAll("[data-lp-animate]");

      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight + 40) {
          el.classList.add("lp-visible");
        }
      });

      document.documentElement.classList.add("js-ready");

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("lp-visible");
              observer?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: "0px 0px -30px 0px" }
      );

      elements.forEach((el) => {
        if (!el.classList.contains("lp-visible")) {
          observer?.observe(el);
        }
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      observer?.disconnect();
    };
  }, [pathname]);

  return null;
}
