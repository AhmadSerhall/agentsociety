import type { MissionEventType } from "@/types";
import type { MissionEvent } from "@/types";

export type EventListener = (event: MissionEvent) => void;