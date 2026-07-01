"use client";

import { Variants } from "framer-motion";

export function useFadeInUp(delay = 0): Variants {
  return {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, delay, ease: "easeOut" } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
  };
}

export function useStaggerContainer(staggerDelay = 0.08): Variants {
  return {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: staggerDelay, delayChildren: 0.1 } },
  };
}