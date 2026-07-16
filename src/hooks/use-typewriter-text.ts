"use client";

import { useCallback, useEffect, useRef } from "react";

export function useTypewriterText(onTick: (value: string) => void) {
  const timersRef = useRef<number[]>([]);

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  return useCallback((fullText: string, onComplete?: () => void) => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
    onTick("");
    let index = 0;
    const step = () => {
      index += 1;
      onTick(fullText.slice(0, index));
      if (index < fullText.length) {
        const delay = /[.,!?]/.test(fullText[index - 1] ?? "") ? 42 : fullText[index - 1] === " " ? 16 : 11;
        timersRef.current.push(window.setTimeout(step, delay));
      } else {
        onComplete?.();
      }
    };
    timersRef.current.push(window.setTimeout(step, 60));
  }, [onTick]);
}
