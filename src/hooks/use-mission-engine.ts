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
import { MissionState, MissionEventType } from "@/types";
import type { MissionContext, MissionConfiguration } from "@/types";
import { toast } from "sonner";

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

        // Save to history
        const finalCtx = engine.getContext();
        if (finalCtx) {
          addHistory({
            id: finalCtx.missionId,
            missionBrief: finalCtx.missionBrief,
            configuration: finalCtx.configuration,
            timestamp: finalCtx.completedAt ?? new Date().toISOString(),
            workstreams: finalCtx.workstreams,
            dialogue: finalCtx.dialogue.map((d) => ({ agentName: d.agentName, content: d.content.slice(0, 200) })),
            conflicts: finalCtx.conflicts.map((c) => ({ description: c.description, resolution: c.resolution })),
            finalReport: finalCtx.finalReport,
            efficiencyMetrics: finalCtx.efficiencyMetrics,
          });
        }
      });

      engine.on(MissionEventType.MissionFailed, (e) => {
        useMissionStore.setState({ isRunning: false });
        toast.error("Mission failed");
      });

      engine.on(MissionEventType.MissionCancelled, () => {
        useMissionStore.setState({ isRunning: false });
        toast.info("Mission cancelled");
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
