"use client";

import { create } from "zustand";
import { buildMissionStateFromEvents, createReplayBookmarks, getReplayDuration, type ReplayBookmark } from "@/services/replay/replay-engine";
import type { MissionReplayEvent } from "@/types";
import { useMissionStore } from "./mission-store";

export type ReplayStatus = "idle" | "playing" | "paused" | "completed";

interface ReplayState {
  mode: "live" | "replay";
  replayStatus: ReplayStatus;
  replayTime: number;
  replaySpeed: number;
  replayEvents: MissionReplayEvent[];
  autoFollowEnabled: boolean;
  inspectorEnabled: boolean;
  selectedReplayEvent: MissionReplayEvent | null;
  bookmarks: ReplayBookmark[];
  startReplay: (events: MissionReplayEvent[]) => void;
  exitReplay: () => void;
  play: () => void;
  pause: () => void;
  restart: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  seek: (time: number) => void;
  tick: (deltaMs: number) => void;
  setSpeed: (speed: number) => void;
  setAutoFollowEnabled: (enabled: boolean) => void;
  setInspectorEnabled: (enabled: boolean) => void;
  selectReplayEvent: (event: MissionReplayEvent | null) => void;
}

function applyReplayState(events: MissionReplayEvent[], time: number) {
  const ctx = buildMissionStateFromEvents(events, time);
  useMissionStore.setState({ context: ctx, isRunning: false });
}

function setReplayGuard(enabled: boolean) {
  if (typeof window !== "undefined") {
    (window as unknown as { __AGENT_SOCIETY_REPLAY_ACTIVE__?: boolean }).__AGENT_SOCIETY_REPLAY_ACTIVE__ = enabled;
  }
}

export const useReplayStore = create<ReplayState>((set, get) => ({
  mode: "live",
  replayStatus: "idle",
  replayTime: 0,
  replaySpeed: 1,
  replayEvents: [],
  autoFollowEnabled: true,
  inspectorEnabled: false,
  selectedReplayEvent: null,
  bookmarks: [],

  startReplay: (events) => {
    setReplayGuard(true);
    const sorted = [...events].sort((a, b) => a.relativeTimestamp - b.relativeTimestamp);
    applyReplayState(sorted, 0);
    set({
      mode: "replay",
      replayStatus: "paused",
      replayTime: 0,
      replayEvents: sorted,
      bookmarks: createReplayBookmarks(sorted),
      selectedReplayEvent: null,
    });
  },
  exitReplay: () => {
    setReplayGuard(false);
    useMissionStore.getState().reset();
    set({ mode: "live", replayStatus: "idle", replayTime: 0, replayEvents: [], bookmarks: [], selectedReplayEvent: null });
  },
  play: () => set({ replayStatus: "playing" }),
  pause: () => set({ replayStatus: "paused" }),
  restart: () => {
    const events = get().replayEvents;
    applyReplayState(events, 0);
    set({ replayTime: 0, replayStatus: "playing", selectedReplayEvent: null });
  },
  stepForward: () => {
    const { replayEvents, replayTime } = get();
    const next = replayEvents.find((event) => event.relativeTimestamp > replayTime);
    const time = next?.relativeTimestamp ?? getReplayDuration(replayEvents);
    applyReplayState(replayEvents, time);
    set({ replayTime: time, replayStatus: time >= getReplayDuration(replayEvents) ? "completed" : "paused", selectedReplayEvent: next ?? null });
  },
  stepBackward: () => {
    const { replayEvents, replayTime } = get();
    const previous = [...replayEvents].reverse().find((event) => event.relativeTimestamp < replayTime);
    const time = previous?.relativeTimestamp ?? 0;
    applyReplayState(replayEvents, time);
    set({ replayTime: time, replayStatus: "paused", selectedReplayEvent: previous ?? null });
  },
  seek: (time) => {
    const events = get().replayEvents;
    const duration = getReplayDuration(events);
    const nextTime = Math.max(0, Math.min(duration, time));
    applyReplayState(events, nextTime);
    set({ replayTime: nextTime, replayStatus: nextTime >= duration ? "completed" : "paused" });
  },
  tick: (deltaMs) => {
    const { replayStatus, replayTime, replaySpeed, replayEvents } = get();
    if (replayStatus !== "playing") return;
    const duration = getReplayDuration(replayEvents);
    const nextTime = Math.min(duration, replayTime + deltaMs * replaySpeed);
    applyReplayState(replayEvents, nextTime);
    set({ replayTime: nextTime, replayStatus: nextTime >= duration ? "completed" : "playing" });
  },
  setSpeed: (speed) => set({ replaySpeed: speed }),
  setAutoFollowEnabled: (enabled) => set({ autoFollowEnabled: enabled }),
  setInspectorEnabled: (enabled) => set({ inspectorEnabled: enabled }),
  selectReplayEvent: (event) => set({ selectedReplayEvent: event }),
}));
