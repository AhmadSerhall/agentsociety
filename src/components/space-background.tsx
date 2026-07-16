/**
 * Agent Society — Animated Space Background
 *
 * Planet + stars + particles rendered with CSS + Framer Motion.
 */

"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  SETTINGS_CHANGED_EVENT,
  getSavedSettingsOptions,
  type SettingsOptions,
} from "@/lib/settingsPreferences";

function Star({ x, y, size, delay, duration, reduceMotion }: { x: number; y: number; size: number; delay: number; duration: number; reduceMotion: boolean }) {
  return (
    <motion.div
      className="absolute rounded-full bg-white"
      style={{ left: `${x}%`, top: `${y}%`, width: size, height: size }}
      animate={reduceMotion ? { opacity: 0.45 } : { opacity: [0.2, 0.8, 0.2] }}
      transition={reduceMotion ? undefined : { duration, repeat: Infinity, delay, ease: "easeInOut" }}
    />
  );
}

export function SpaceBackground() {
  const [settings, setSettings] = useState<SettingsOptions>(() => getSavedSettingsOptions());
  const stars = useMemo(() => Array.from({ length: 100 }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 1 + Math.random() * 2,
    delay: Math.random() * 4,
    duration: 2 + Math.random() * 3,
  })), []);
  const particleCount = settings.appearance.particles === "Low" ? 3 : settings.appearance.particles === "High" ? 10 : 6;
  const starCount = settings.appearance.particles === "Low" ? 38 : settings.appearance.particles === "High" ? 100 : 72;
  const speed = settings.appearance.animation === "Calm" ? 1.5 : settings.appearance.animation === "High" ? 0.7 : 1;
  const reduceMotion = settings.preferences.reduceMotion;

  useEffect(() => {
    const onSettingsChanged = (event: Event) => {
      const detail = (event as CustomEvent<SettingsOptions>).detail;
      setSettings(detail ?? getSavedSettingsOptions());
    };
    window.addEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged);
  }, []);

  return (
    <div
      data-space-particles={particleCount}
      data-space-stars={starCount}
      data-space-animation={settings.appearance.animation.toLowerCase()}
      className="fixed inset-0 -z-10 overflow-hidden"
      style={{ background: "var(--agent-background-start, #070b14)" }}
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, var(--agent-background-start, #070b14), var(--agent-background-middle, #0c1425), var(--agent-background-end, #070b14))" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 55% 10%, rgb(var(--agent-settings-accent, 34 211 238) / 0.1), transparent 38%)" }} />

      {/* Planet */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 320,
          height: 320,
          right: "-60px",
          bottom: "-60px",
          background: "radial-gradient(circle at 35% 35%, rgb(var(--agent-settings-accent, 34 211 238) / 0.35) 0%, #0d1b2a 50%, #050d16 100%)",
          boxShadow: "0 0 80px 20px rgb(var(--agent-settings-accent, 34 211 238) / 0.12), inset -20px -20px 40px rgba(0,0,0,0.5)",
        }}
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={reduceMotion ? undefined : { duration: 120 * speed, repeat: Infinity, ease: "linear" }}
      />

      {/* Planet ring */}
      <motion.div
        className="absolute rounded-full border border-white/5"
        style={{
          width: 480,
          height: 480,
          right: "-140px",
          bottom: "-140px",
          transform: "rotateX(70deg)",
        }}
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={reduceMotion ? undefined : { duration: 90 * speed, repeat: Infinity, ease: "linear" }}
      />

      {/* Small planet */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 60,
          height: 60,
          left: "15%",
          top: "20%",
          background: "radial-gradient(circle at 40% 40%, rgb(var(--agent-settings-accent, 34 211 238) / 0.45) 0%, #140e22 100%)",
          boxShadow: "0 0 30px 5px rgb(var(--agent-settings-accent, 34 211 238) / 0.16)",
        }}
        animate={reduceMotion ? undefined : { y: [0, -10, 0] }}
        transition={reduceMotion ? undefined : { duration: 8 * speed, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Stars */}
      {stars.slice(0, starCount).map((star, i) => (
        <Star key={i} {...star} reduceMotion={reduceMotion} />
      ))}

      {/* Floating particles */}
      {Array.from({ length: particleCount }).map((_, i) => (
        <motion.div
          key={`p-${i}`}
          className="absolute h-1 w-1 rounded-full"
          style={{ left: `${10 + (i * 80) / Math.max(1, particleCount - 1)}%`, bottom: "-5%" }}
          animate={reduceMotion ? { opacity: 0 } : { y: [0, -600], opacity: [0, 0.6, 0], backgroundColor: "rgb(var(--agent-settings-accent, 34 211 238) / 0.7)" }}
          transition={reduceMotion ? undefined : { duration: (8 + i * 2) * speed, repeat: Infinity, delay: i * 1.5, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
