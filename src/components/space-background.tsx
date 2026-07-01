/**
 * Agent Society — Animated Space Background
 *
 * Planet + stars + particles rendered with CSS + Framer Motion.
 */

"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

function Star({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  return (
    <motion.div
      className="absolute rounded-full bg-white"
      style={{ left: `${x}%`, top: `${y}%`, width: size, height: size }}
      animate={{ opacity: [0.2, 0.8, 0.2] }}
      transition={{ duration: 2 + Math.random() * 3, repeat: Infinity, delay, ease: "easeInOut" }}
    />
  );
}

export function SpaceBackground() {
  const stars = useMemo(() => Array.from({ length: 80 }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 1 + Math.random() * 2,
    delay: Math.random() * 4,
  })), []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#070b14]">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#070b14] via-[#0c1425] to-[#070b14]" />

      {/* Planet */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 320,
          height: 320,
          right: "-60px",
          bottom: "-60px",
          background: "radial-gradient(circle at 35% 35%, #1e3a5f 0%, #0d1b2a 50%, #050d16 100%)",
          boxShadow: "0 0 80px 20px rgba(30, 58, 95, 0.15), inset -20px -20px 40px rgba(0,0,0,0.5)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
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
        animate={{ rotate: 360 }}
        transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
      />

      {/* Small planet */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 60,
          height: 60,
          left: "15%",
          top: "20%",
          background: "radial-gradient(circle at 40% 40%, #2d1b4e 0%, #140e22 100%)",
          boxShadow: "0 0 30px 5px rgba(45, 27, 78, 0.2)",
        }}
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Stars */}
      {stars.map((star, i) => (
        <Star key={i} {...star} />
      ))}

      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={`p-${i}`}
          className="absolute h-1 w-1 rounded-full bg-white/30"
          style={{ left: `${20 + i * 12}%`, bottom: "-5%" }}
          animate={{ y: [0, -600], opacity: [0, 0.6, 0] }}
          transition={{ duration: 8 + i * 2, repeat: Infinity, delay: i * 1.5, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}