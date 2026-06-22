"use client";

import { useState } from "react";
import LPIcon from "@/components/LPIcon";

type Faq = { question: string; answer: string };

export default function AreaFaqAccordion({ faqs }: { faqs: Faq[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="lp-faq-list">
      {faqs.map((faq, i) => (
        <div key={i} className={`lp-faq-item${open === i ? " lp-faq-item--open" : ""}`}>
          <button
            className="lp-faq-trigger"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
          >
            <span>{faq.question}</span>
            <LPIcon name={open === i ? "minus" : "plus"} size={18} />
          </button>
          {open === i && (
            <div className="lp-faq-body">
              <p>{faq.answer}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
