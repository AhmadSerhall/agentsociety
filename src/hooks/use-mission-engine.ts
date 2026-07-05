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
import { toast } from "sonner";

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
  });
}

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
    (brief: string, config?: Partial<MissionConfiguration>) => {
      if (!hasUsableQwenKey()) {
        toast.error("Qwen API key required", { description: "Go to Settings and paste your Qwen API key to run missions." });
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

      const ctx = initMission(brief, config);
      const engine = new MissionEngine();
      engineRef.current = engine;

      useMissionStore.setState({ isRunning: true });

      // Subscribe to key events
      engine.on(MissionEventType.MissionStarted, () => {
        toast.info("Mission launched");
      });

      engine.on(MissionEventType.AgentStarted, (e) => {
        const { agentName } = e.payload as { agentName: string };
        toast.info(`${agentName} is working...`);
      });

      engine.on(MissionEventType.ConflictDetected, () => {
        toast.warning("Conflict detected — Mediator activated");
      });

      engine.on(MissionEventType.ConflictResolved, () => {
        toast.success("Conflict resolved by Mediator");
      });

      engine.on(MissionEventType.MissionCompleted, () => {
        useMissionStore.setState({ isRunning: false });
        toast.success("Mission completed successfully!");

        const finalCtx = engine.getContext();
        if (finalCtx && getSavedSettingsOptions().preferences.autoSaveReports) {
          saveMissionHistory(finalCtx, addHistory);
        }
      });

      engine.on(MissionEventType.MissionFailed, (e) => {
        useMissionStore.setState({ isRunning: false });
        const payload = e.payload as { error?: string };
        toast.error(payload.error ?? "Mission failed");
      });

      engine.on(MissionEventType.MissionCancelled, () => {
        useMissionStore.setState({ isRunning: false });
        toast.info("Mission cancelled");
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
