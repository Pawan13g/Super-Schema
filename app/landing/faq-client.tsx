"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface FaqItem {
  q: string;
  a: string;
}

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(1);

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={i}
            className={`overflow-hidden rounded-xl border transition-colors ${
              isOpen
                ? "border-violet-500/30 bg-violet-500/[0.04]"
                : "border-white/[0.06] bg-white/[0.02]"
            }`}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-white transition-colors hover:text-white"
            >
              <span>{item.q}</span>
              {isOpen ? (
                <ChevronUp className="size-4 shrink-0 text-zinc-400" />
              ) : (
                <ChevronDown className="size-4 shrink-0 text-zinc-400" />
              )}
            </button>
            {isOpen && (
              <div className="px-5 pb-5 text-sm leading-relaxed text-zinc-400">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
