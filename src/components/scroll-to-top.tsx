"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

const RING_RADIUS = 21;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function ScrollToTop({ scrollContainer, resetKey }: { scrollContainer: HTMLElement | null; resetKey: string }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!scrollContainer) return;
    const updateProgress = () => {
      const scrollableHeight = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      setProgress(scrollableHeight > 0 ? Math.min(1, Math.max(0, scrollContainer.scrollTop / scrollableHeight)) : 0);
    };

    updateProgress();
    scrollContainer.addEventListener("scroll", updateProgress, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", updateProgress);
  }, [scrollContainer]);

  useEffect(() => {
    if (!scrollContainer) return;
    const frame = window.requestAnimationFrame(() => {
      scrollContainer.scrollTo({ top: 0 });
      setProgress(0);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [resetKey, scrollContainer]);

  return (
    <button
      type="button"
      onClick={() => scrollContainer?.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
      className={`fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full border border-cyan-200/25 bg-[#07121f]/90 text-cyan-100 shadow-[0_14px_42px_rgba(34,211,238,0.24)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-200/60 hover:bg-cyan-300/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80 ${progress > 0 ? "scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0"}`}
    >
      <svg className="pointer-events-none absolute inset-1 -rotate-90" viewBox="0 0 50 50" aria-hidden="true">
        <circle cx="25" cy="25" r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
        <circle
          cx="25"
          cy="25"
          r={RING_RADIUS}
          fill="none"
          stroke="rgb(34 211 238)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
          className="transition-[stroke-dashoffset] duration-150"
        />
      </svg>
      <ArrowUp className="relative h-5 w-5" />
    </button>
  );
}
