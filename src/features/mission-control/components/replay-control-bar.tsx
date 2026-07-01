"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { computeReplayStats, getReplayDuration } from "@/services/replay/replay-engine";
import { useReplayStore } from "@/store";
import { ChevronLeft, ChevronRight, Eye, Pause, Play, RotateCcw, Square } from "lucide-react";

function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60).toString().padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
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
  const selectReplayEvent = useReplayStore((s) => s.selectReplayEvent);
  const duration = getReplayDuration(events);
  const stats = useMemo(() => computeReplayStats(events, duration / speed), [duration, events, speed]);

  if (mode !== "replay") return null;

  return (
    <div className="sticky bottom-4 z-30 rounded-2xl border border-cyan-200/15 bg-[#07111f]/92 p-4 text-white shadow-[0_24px_100px_rgba(34,211,238,0.18)] backdrop-blur-2xl">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/55">Mission Replay</p>
            <p className="mt-1 text-sm text-white/70">{status === "playing" ? "Playing mission time machine" : status === "completed" ? "Replay complete" : "Replay paused"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="icon" variant="outline" onClick={stepBackward} className="border-white/10 bg-white/[0.04] text-white/70"><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="icon" onClick={status === "playing" ? pause : play} className="bg-cyan-300 text-[#06101f] hover:bg-cyan-200">
              {status === "playing" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="outline" onClick={stepForward} className="border-white/10 bg-white/[0.04] text-white/70"><ChevronRight className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" onClick={restart} className="border-white/10 bg-white/[0.04] text-white/70"><RotateCcw className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={exitReplay} className="gap-1 border-red-300/20 bg-red-400/10 text-red-100"><Square className="h-3.5 w-3.5" /> Exit Replay</Button>
          </div>
        </div>

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
          <div className="flex items-center gap-4 text-xs text-white/55">
            <label className="flex items-center gap-2"><Switch checked={autoFollow} onCheckedChange={setAutoFollowEnabled} /> Auto Follow</label>
            <label className="flex items-center gap-2"><Switch checked={inspector} onCheckedChange={setInspectorEnabled} /> Inspector</label>
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

        {inspector && (
          <div className="rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/60"><Eye className="h-3.5 w-3.5" /> Event Inspector</span>
              <Select value={selectedEvent?.id ?? ""} onValueChange={(id) => selectReplayEvent(events.find((event) => event.id === id) ?? null)}>
                <SelectTrigger className="h-8 w-64 border-white/10 bg-white/[0.04] text-white"><SelectValue placeholder="Select replay event" /></SelectTrigger>
                <SelectContent>
                  {events.map((event) => <SelectItem key={event.id} value={event.id}>{formatTime(event.relativeTimestamp)} {event.type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words text-[0.7rem] leading-relaxed text-white/58">
              {selectedEvent ? JSON.stringify(selectedEvent, null, 2) : "Select an event to inspect raw replay metadata."}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
