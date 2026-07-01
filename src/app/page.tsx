"use client";

import dynamic from "next/dynamic";

const MissionControl = dynamic(
  () => import("@/features/mission-control").then((mod) => mod.MissionControl),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-[#070b14]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white/80" />
      </div>
    ),
  }
);

export default function Home() {
  return <MissionControl />;
}