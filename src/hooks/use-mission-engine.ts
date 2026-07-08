/**
 * Agent Society — useMissionEngine Hook
 *
 * Bridges the Mission Engine to React. Manages lifecycle,
 * event subscriptions, and store synchronization.
 */

"use client";

import { useRef, useCallback, useEffect } from "react";
import { useMissionStore } from "@/store/mission-store";
import { useHistoryStore } from "@/store/history-store";
import { MissionEngine } from "@/services/mission-engine";
import { hasUsableQwenKey } from "@/lib/qwenConfig";
import { getSavedSettingsOptions } from "@/lib/settingsPreferences";
import { MissionState, MissionEventType } from "@/types";
import type { MissionContext, MissionConfiguration } from "@/types";
import { toast as appToast } from "@/hooks/use-toast";

function saveMissionHistory(ctx: MissionContext, addHistory: ReturnType<typeof useHistoryStore.getState>["add"]) {
  addHistory({
    id: ctx.missionId,
    missionBrief: ctx.missionBrief,
    configuration: ctx.configuration,
    timestamp: ctx.completedAt ?? new Date().toISOString(),
    startedAt: ctx.startedAt,
    completedAt: ctx.completedAt,
    workstreams: ctx.workstreams,
    dialogue: ctx.dialogue,
    timeline: ctx.timeline,
    conflicts: ctx.conflicts.map((c) => ({ description: c.description, resolution: c.resolution ?? c.mediatorDecision })),
    finalReport: ctx.finalReport,
    efficiencyMetrics: ctx.efficiencyMetrics,
    replayEvents: ctx.replayEvents,
    parentMissionId: ctx.parentMissionId,
    sourceCardId: ctx.sourceCardId,
    sourceCardText: ctx.sourceCardText,
    sourceAgentId: ctx.sourceAgentId,
    sourceWorkstreamId: ctx.sourceWorkstreamId,
    missionBacklog: ctx.missionBacklog,
  });
}

const toast = Object.assign(appToast, {
  warning: (title: string) => appToast({ title, description: "Mediator activated." }),
});

export function useMissionEngine() {
  const engineRef = useRef<MissionEngine | null>(null);
  const { context, isRunning, initMission, setContext } = useMissionStore();
  const addHistory = useHistoryStore((s) => s.add);

  useEffect(() => {
    return () => {
      engineRef.current?.removeAllListeners();
      engineRef.current?.cancelMission();
    };
  }, []);

  const launch = useCallback(
    (brief: string, config?: Partial<MissionConfiguration>, relation?: Partial<Pick<MissionContext, "parentMissionId" | "sourceCardId" | "sourceCardText" | "sourceAgentId" | "sourceWorkstreamId">>) => {
      if (!hasUsableQwenKey()) {
        toast({ title: "Qwen API key required", description: "Go to Settings and paste your Qwen API key to run missions.", variant: "destructive" });
        return;
      }

      const currentStatus = useMissionStore.getState().context?.status;
      if (
        useMissionStore.getState().context &&
        currentStatus !== MissionState.Idle &&
        currentStatus !== MissionState.Completed &&
        currentStatus !== MissionState.Failed &&
        currentStatus !== MissionState.Cancelled
      ) return;

      const ctx = initMission(brief, config, relation);
      const engine = new MissionEngine();
      engineRef.current = engine;

      useMissionStore.setState({ isRunning: true });

      // Subscribe to key events
      engine.on(MissionEventType.MissionStarted, () => {
        toast({ title: "Mission launched" });
      });

      engine.on(MissionEventType.AgentStarted, (e) => {
        const { agentName } = e.payload as { agentName: string };
        toast({ title: `${agentName} is working...` });
      });

      engine.on(MissionEventType.ConflictDetected, () => {
        toast.warning("Conflict detected — Mediator activated");
      });

      engine.on(MissionEventType.ConflictResolved, () => {
        toast({ title: "Conflict resolved", description: "Mediator handled the disagreement." });
      });

      engine.on(MissionEventType.MissionCompleted, () => {
        useMissionStore.setState({ isRunning: false });
        toast({ title: "Mission completed successfully!" });

        const finalCtx = engine.getContext();
        if (finalCtx && getSavedSettingsOptions().preferences.autoSaveReports) {
          saveMissionHistory(finalCtx, addHistory);
        }
      });

      engine.on(MissionEventType.MissionFailed, (e) => {
        useMissionStore.setState({ isRunning: false });
        const payload = e.payload as { error?: string };
        toast({ title: payload.error ?? "Mission failed", variant: "destructive" });
      });

      engine.on(MissionEventType.MissionCancelled, () => {
        useMissionStore.setState({ isRunning: false });
        toast({
          title: "Mission cancelled",
          description: "Partial progress was saved to Mission History.",
          className: "border-red-300/25 bg-red-950/90 text-red-50 shadow-[0_22px_70px_rgba(239,68,68,0.24)] backdrop-blur-xl",
        });
        const partialCtx = engine.getContext();
        if (partialCtx && getSavedSettingsOptions().preferences.autoSaveReports) {
          saveMissionHistory(partialCtx, addHistory);
        }
      });

      // Start the engine
      engine.startMission(ctx, (updatedCtx: MissionContext) => {
        setContext(updatedCtx);
      });
    },
    [initMission, setContext, addHistory]
  );

  const cancel = useCallback(() => {
    engineRef.current?.cancelMission();
  }, []);

  return { context, isRunning, launch, cancel };
}
