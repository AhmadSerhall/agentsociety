"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { motion } from "framer-motion";
import { AGENT_DEFINITIONS } from "@/agents";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { computeReplayStats, getReplayDuration } from "@/services/replay/replay-engine";
import { useReplayStore } from "@/store";
import type { MissionReplayEvent } from "@/types";
import { ChevronLeft, ChevronRight, Eye, Gauge, Maximize2, Minimize2, Pause, PictureInPicture2, Play, RotateCcw, Search, Square, X } from "lucide-react";

type ReplayUiMode = "mini" | "expanded" | "inspector";

function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60).toString().padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function eventLabel(event?: MissionReplayEvent | null) {
  if (!event) return "Awaiting replay event";
  return event.workstreamTitle || event.agentName || event.type.replace(/_/g, " ").toLowerCase();
}

function eventTone(event: MissionReplayEvent) {
  if (event.type.includes("CONFLICT")) return { color: "#f59e0b", label: "Conflict" };
  if (event.type.includes("MEDIATOR") || event.type.includes("MEDIATION")) return { color: "#06b6d4", label: "Mediator" };
  if (event.type.includes("FINALIZER") || event.type.includes("MISSION_COMPLETED")) return { color: "#a855f7", label: "Finalization" };
  if (event.type.includes("WORKSTREAM") || event.type.includes("TASK")) return { color: "#10b981", label: "Workstream" };
  const agent = AGENT_DEFINITIONS.find((item) => item.role === event.agentRole);
  return { color: agent?.color ?? "#22d3ee", label: event.agentName ?? "Mission" };
}

function currentEvent(events: MissionReplayEvent[], time: number) {
  return events.filter((event) => event.relativeTimestamp <= time).at(-1) ?? null;
}

export function ReplayControlBar() {
  const mode = useReplayStore((s) => s.mode);
  const status = useReplayStore((s) => s.replayStatus);
  const replayTime = useReplayStore((s) => s.replayTime);
  const speed = useReplayStore((s) => s.replaySpeed);
  const events = useReplayStore((s) => s.replayEvents);
  const bookmarks = useReplayStore((s) => s.bookmarks);
  const autoFollow = useReplayStore((s) => s.autoFollowEnabled);
  const inspector = useReplayStore((s) => s.inspectorEnabled);
  const adaptive = useReplayStore((s) => s.adaptiveSpeedEnabled);
  const selectedEvent = useReplayStore((s) => s.selectedReplayEvent);
  const play = useReplayStore((s) => s.play);
  const pause = useReplayStore((s) => s.pause);
  const restart = useReplayStore((s) => s.restart);
  const stepBackward = useReplayStore((s) => s.stepBackward);
  const stepForward = useReplayStore((s) => s.stepForward);
  const exitReplay = useReplayStore((s) => s.exitReplay);
  const seek = useReplayStore((s) => s.seek);
  const setSpeed = useReplayStore((s) => s.setSpeed);
  const setAutoFollowEnabled = useReplayStore((s) => s.setAutoFollowEnabled);
  const setInspectorEnabled = useReplayStore((s) => s.setInspectorEnabled);
  const setAdaptiveSpeedEnabled = useReplayStore((s) => s.setAdaptiveSpeedEnabled);
  const selectReplayEvent = useReplayStore((s) => s.selectReplayEvent);
  const [uiMode, setUiMode] = useState<ReplayUiMode>("expanded");
  const [pip, setPip] = useState(false);
  const [position, setPosition] = useState({ x: 24, y: 220 });
  const positionInitializedRef = useRef(false);
  const dragRef = useRef<{ originX: number; originY: number; startX: number; startY: number } | null>(null);

  const duration = getReplayDuration(events);
  const activeEvent = selectedEvent ?? currentEvent(events, replayTime);
  const stats = useMemo(() => computeReplayStats(events, duration / Math.max(0.1, speed)), [duration, events, speed]);

  useEffect(() => {
    if (mode !== "replay") {
      positionInitializedRef.current = false;
      return;
    }
    if (positionInitializedRef.current || typeof window === "undefined") return;
    const width = Math.min(window.innerWidth - 32, 1440);
    setPosition({
      x: Math.max(16, (window.innerWidth - width) / 2),
      y: Math.max(24, window.innerHeight - 460),
    });
    positionInitializedRef.current = true;
  }, [mode]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!dragRef.current) return;
      event.preventDefault();
      setPosition({
        x: dragRef.current.originX + event.clientX - dragRef.current.startX,
        y: dragRef.current.originY + event.clientY - dragRef.current.startY,
      });
    };
    const stop = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, []);

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragRef.current = {
      originX: position.x,
      originY: position.y,
      startX: event.clientX,
      startY: event.clientY,
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  };

  useEffect(() => {
    if (mode !== "replay") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [role='combobox']")) return;
      if (event.key === " ") {
        event.preventDefault();
        if (status === "playing") pause();
        else play();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (event.shiftKey) stepForward();
        else seek(replayTime + 1000);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (event.shiftKey) stepBackward();
        else seek(replayTime - 1000);
      }
      if (event.key === "+" || event.key === "=") setSpeed(Math.min(8, speed * 2));
      if (event.key === "-" || event.key === "_") setSpeed(Math.max(0.25, speed / 2));
      if (event.key.toLowerCase() === "r") restart();
      if (event.key.toLowerCase() === "i") setUiMode((current) => current === "inspector" ? "expanded" : "inspector");
      if (event.key.toLowerCase() === "t") setUiMode("expanded");
      if (event.key.toLowerCase() === "p") setPip((current) => !current);
      if (event.key === "Escape") exitReplay();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exitReplay, mode, pause, play, replayTime, restart, seek, setSpeed, speed, status, stepBackward, stepForward]);

  useEffect(() => {
    if (mode !== "replay" || !autoFollow || !activeEvent) return;
    if (activeEvent.type.includes("FINALIZER") || activeEvent.type === "MISSION_COMPLETED") {
      document.querySelector("[data-mission-tabs]")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (activeEvent.type.includes("CONFLICT")) {
      document.querySelector("[data-mission-intelligence]")?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (activeEvent.type.includes("WORKSTREAM") || activeEvent.type.includes("TASK")) {
      document.querySelector("[data-workstream-strip]")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeEvent, autoFollow, mode]);

  if (mode !== "replay") return null;

  const isPlaying = status === "playing";
  const overlayWidthClass = uiMode === "mini"
    ? "w-[min(calc(100vw-2rem),1440px)]"
    : pip
      ? "w-[390px]"
      : "w-[min(calc(100vw-2rem),1440px)]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`fixed z-50 select-none text-white ${overlayWidthClass}`}
      style={{ left: position.x, top: position.y }}
    >
      {uiMode === "mini" ? (
        <MiniDock
          event={activeEvent}
          status={status}
          time={replayTime}
          duration={duration}
          onSeek={seek}
          onDragStart={startDrag}
          onToggle={() => isPlaying ? pause() : play()}
          onExpand={() => setUiMode("expanded")}
          onExit={exitReplay}
        />
      ) : (
        <div className="overflow-hidden rounded-[1.35rem] border border-cyan-200/15 bg-[#07111f]/94 p-4 shadow-[0_24px_120px_rgba(34,211,238,0.22)] backdrop-blur-2xl">
          <div
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <div className="cursor-grab touch-none active:cursor-grabbing" onPointerDown={startDrag}>
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/55">Floating Mission Replay</p>
              <p className="mt-1 text-sm text-white/70">{status === "completed" ? "Replay complete" : isPlaying ? "Playing recorded mission events" : "Replay paused"} - {eventLabel(activeEvent)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="icon" variant="outline" onClick={stepBackward} className="border-white/10 bg-white/[0.04] text-white/70 hover:text-white"><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="icon" onClick={isPlaying ? pause : play} className="bg-cyan-300 text-[#06101f] hover:bg-cyan-200">
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="outline" onClick={stepForward} className="border-white/10 bg-white/[0.04] text-white/70 hover:text-white"><ChevronRight className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" onClick={restart} className="border-white/10 bg-white/[0.04] text-white/70 hover:text-white"><RotateCcw className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" onClick={() => setUiMode(uiMode === "inspector" ? "expanded" : "inspector")} className="border-white/10 bg-white/[0.04] text-white/70 hover:text-white"><Eye className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" onClick={() => setPip((current) => !current)} className="border-white/10 bg-white/[0.04] text-white/70 hover:text-white"><PictureInPicture2 className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" onClick={() => setUiMode("mini")} className="border-white/10 bg-white/[0.04] text-white/70 hover:text-white"><Minimize2 className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={exitReplay} className="gap-1 border-red-300/20 bg-red-400/10 text-red-100 hover:bg-red-400/15"><Square className="h-3.5 w-3.5" /> Exit</Button>
            </div>
          </div>

          <div className={`mt-4 grid gap-4 ${uiMode === "inspector" ? "xl:grid-cols-[1fr_360px]" : ""}`}>
            <div className="space-y-4">
              <Timeline
                events={events}
                replayTime={replayTime}
                duration={duration}
                onSeek={(time, event) => {
                  seek(time);
                  selectReplayEvent(event);
                }}
              />

              <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                <div className="flex items-center gap-3">
                  <span className="w-12 text-xs tabular-nums text-white/50">{formatTime(replayTime)}</span>
                  <Slider value={[replayTime]} min={0} max={Math.max(1, duration)} step={100} onValueChange={([value]) => seek(value)} />
                  <span className="w-12 text-right text-xs tabular-nums text-white/50">{formatTime(duration)}</span>
                </div>
                <Select value={String(speed)} onValueChange={(value) => setSpeed(Number(value))}>
                  <SelectTrigger className="w-28 border-white/10 bg-white/[0.04] text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[0.25, 0.5, 1, 2, 4, 8].map((value) => <SelectItem key={value} value={String(value)}>{value}x</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap items-center gap-4 text-xs text-white/55">
                  <label className="flex items-center gap-2"><Switch checked={autoFollow} onCheckedChange={setAutoFollowEnabled} /> Follow</label>
                  <label className="flex items-center gap-2"><Switch checked={adaptive} onCheckedChange={setAdaptiveSpeedEnabled} /> Adaptive</label>
                  <label className="flex items-center gap-2"><Switch checked={inspector} onCheckedChange={setInspectorEnabled} /> Raw</label>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {bookmarks.map((bookmark) => (
                  <button key={bookmark.eventId} type="button" onClick={() => seek(bookmark.time)} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/60 transition hover:border-cyan-200/35 hover:text-cyan-100">
                    {bookmark.label}
                  </button>
                ))}
              </div>

              <div className="grid gap-2 text-xs text-white/52 sm:grid-cols-2 xl:grid-cols-5">
                <span>Events: {stats.totalEventsProcessed}</span>
                <span>Messages: {stats.agentMessages}</span>
                <span>Conflicts: {stats.resolvedConflicts}/{stats.conflicts}</span>
                <span>Peak parallelism: {stats.peakParallelism}</span>
                <span>Avg confidence: {stats.averageConfidence}%</span>
              </div>
            </div>

            {uiMode === "inspector" && (
              <EventInspector
                events={events}
                selectedEvent={activeEvent}
                showRaw={inspector}
                onSelect={(event) => {
                  selectReplayEvent(event);
                  seek(event.relativeTimestamp);
                }}
              />
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function MiniDock({
  event,
  status,
  time,
  duration,
  onSeek,
  onDragStart,
  onToggle,
  onExpand,
  onExit,
}: {
  event: MissionReplayEvent | null;
  status: string;
  time: number;
  duration: number;
  onSeek: (time: number) => void;
  onDragStart: (event: ReactPointerEvent<HTMLElement>) => void;
  onToggle: () => void;
  onExpand: () => void;
  onExit: () => void;
}) {
  const progress = duration ? Math.min(100, (time / duration) * 100) : 0;
  return (
    <div className="overflow-hidden rounded-2xl border border-cyan-200/15 bg-[#07111f]/94 p-3 shadow-[0_24px_100px_rgba(34,211,238,0.22)] backdrop-blur-2xl">
      <div className="flex items-center gap-3">
        <Button size="icon" onClick={onToggle} className="bg-cyan-300 text-[#06101f] hover:bg-cyan-200">
          {status === "playing" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <div className="min-w-0 flex-1 cursor-grab touch-none active:cursor-grabbing" onPointerDown={onDragStart}>
          <p className="truncate text-xs uppercase tracking-[0.18em] text-cyan-100/60">Replay Dock</p>
          <p className="truncate text-sm text-white/70">{eventLabel(event)}</p>
        </div>
        <Button size="icon" variant="outline" onClick={onExpand} className="border-white/10 bg-white/[0.04] text-white/70"><Maximize2 className="h-4 w-4" /></Button>
        <Button size="icon" variant="outline" onClick={onExit} className="border-red-300/20 bg-red-400/10 text-red-100"><X className="h-4 w-4" /></Button>
      </div>
      <div className="mt-3 grid grid-cols-[44px_1fr_44px] items-center gap-3">
        <span className="text-xs tabular-nums text-white/45">{formatTime(time)}</span>
        <Slider
          value={[time]}
          min={0}
          max={Math.max(1, duration)}
          step={100}
          onValueChange={([value]) => onSeek(value)}
          className="[&_[role=slider]]:border-cyan-100 [&_[role=slider]]:bg-[#07111f]"
        />
        <span className="text-right text-xs tabular-nums text-white/45">{formatTime(duration)}</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-purple-400" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function Timeline({ events, replayTime, duration, onSeek }: { events: MissionReplayEvent[]; replayTime: number; duration: number; onSeek: (time: number, event: MissionReplayEvent) => void }) {
  return (
    <div className="relative rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/60"><Gauge className="h-3.5 w-3.5" /> Event Timeline</span>
        <span className="text-xs text-white/38">Hover markers for context. Click to seek.</span>
      </div>
      <div className="relative h-12">
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10" />
        <div className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-cyan-300 to-purple-400" style={{ width: `${duration ? (replayTime / duration) * 100 : 0}%` }} />
        {events.map((event) => {
          const tone = eventTone(event);
          const left = duration ? (event.relativeTimestamp / duration) * 100 : 0;
          const active = Math.abs(event.relativeTimestamp - replayTime) < 500;
          return (
            <button
              key={event.id}
              type="button"
              title={`${formatTime(event.relativeTimestamp)} - ${tone.label}: ${eventLabel(event)}`}
              onClick={() => onSeek(event.relativeTimestamp, event)}
              className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 transition hover:scale-125 ${active ? "scale-125 shadow-[0_0_24px_rgba(34,211,238,0.8)]" : ""}`}
              style={{ left: `${left}%`, backgroundColor: tone.color, boxShadow: active ? `0 0 24px ${tone.color}` : undefined }}
            >
              <span className="sr-only">{tone.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EventInspector({ events, selectedEvent, showRaw, onSelect }: { events: MissionReplayEvent[]; selectedEvent: MissionReplayEvent | null; showRaw: boolean; onSelect: (event: MissionReplayEvent) => void }) {
  return (
    <aside className="rounded-2xl border border-cyan-200/12 bg-cyan-300/[0.045] p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/70">
        <Search className="h-3.5 w-3.5" />
        Replay Inspector
      </div>
      <Select value={selectedEvent?.id ?? ""} onValueChange={(id) => {
        const event = events.find((item) => item.id === id);
        if (event) onSelect(event);
      }}>
        <SelectTrigger className="h-9 border-white/10 bg-black/25 text-white"><SelectValue placeholder="Select replay event" /></SelectTrigger>
        <SelectContent>
          {events.map((event) => <SelectItem key={event.id} value={event.id}>{formatTime(event.relativeTimestamp)} {event.type}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="text-sm font-semibold text-white">{eventLabel(selectedEvent)}</p>
        <p className="mt-1 text-xs text-white/45">{selectedEvent?.type.replace(/_/g, " ") ?? "No event selected"}</p>
        {selectedEvent?.workstreamTitle && <p className="mt-3 text-sm text-white/58">Workstream: {selectedEvent.workstreamTitle}</p>}
        {selectedEvent?.agentName && <p className="mt-1 text-sm text-white/58">Agent: {selectedEvent.agentName}</p>}
      </div>
      {showRaw && (
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-purple-200/10 bg-purple-300/[0.045] p-3 text-[0.7rem] leading-relaxed text-white/58">
          {selectedEvent ? JSON.stringify(selectedEvent, null, 2) : "Select an event to inspect raw replay metadata."}
        </pre>
      )}
      {!showRaw && <p className="mt-3 text-xs leading-relaxed text-white/42">Raw metadata is hidden unless the Raw switch is enabled.</p>}
    </aside>
  );
}
