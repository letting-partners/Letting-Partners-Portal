"use client";

import { useEffect, useRef, useState } from "react";
import LPIcon from "@/components/LPIcon";

type Testimonial = {
  name: string;
  role: string;
  text: string;
  stars: number;
};

export default function TestimonialsSlider({ items }: { items: Testimonial[] }) {
  const [current, setCurrent] = useState(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      if (!pausedRef.current) {
        setCurrent((c) => (c + 1) % items.length);
      }
    }, 5500);
    return () => clearInterval(id);
  }, [items.length]);

  function goTo(i: number) {
    setCurrent(i);
    pausedRef.current = true;
    setTimeout(() => { pausedRef.current = false; }, 9000);
  }

  return (
    <div
      className="lp-testimonials-slider"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      <div
        className="lp-testimonials-track"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {items.map((t, i) => (
          <blockquote key={i} className="lp-testimonial-slide">
            <div className="lp-testimonial-stars" aria-label={`${t.stars} stars`}>
              {Array.from({ length: t.stars }).map((_, j) => (
                <LPIcon key={j} name="star" size={18} />
              ))}
            </div>
            <p className="lp-testimonial-text">&ldquo;{t.text}&rdquo;</p>
            <footer className="lp-testimonial-author">
              <strong className="lp-testimonial-name">{t.name}</strong>
              <span className="lp-testimonial-role">{t.role}</span>
            </footer>
          </blockquote>
        ))}
      </div>

      <div className="lp-testimonials-controls">
        <button
          className="lp-testimonials-btn"
          onClick={() => goTo((current - 1 + items.length) % items.length)}
          aria-label="Previous review"
        >
          <LPIcon name="chevron-left" size={18} />
        </button>

        <div className="lp-testimonials-dots" role="tablist">
          {items.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === current}
              className={`lp-testimonials-dot${i === current ? " active" : ""}`}
              onClick={() => goTo(i)}
              aria-label={`Review ${i + 1}`}
            />
          ))}
        </div>

        <button
          className="lp-testimonials-btn"
          onClick={() => goTo((current + 1) % items.length)}
          aria-label="Next review"
        >
          <LPIcon name="chevron-right" size={18} />
        </button>
      </div>
    </div>
  );
}
