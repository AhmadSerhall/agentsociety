"use client";

import { Badge } from "@/components/ui/badge";
import { useMissionStore } from "@/store";
import { useShallow } from "zustand/react/shallow";

export function WorkstreamsPanel() {
  const workstreams = useMissionStore(useShallow((s) => s.context?.workstreams ?? []));

  if (workstreams.length === 0) {
    return <p className="text-sm text-muted-foreground italic">Workstreams will appear once the Planner finishes.</p>;
  }

  return (
    <div className="space-y-2">
      {workstreams.map((ws) => (
        <div key={ws.id} className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium">{ws.title}</h4>
            <Badge variant={ws.status === "completed" ? "default" : ws.status === "in_progress" ? "secondary" : "outline"} className="shrink-0 text-xs capitalize">
              {ws.status.replace("_", " ")}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{ws.description}</p>
          {ws.deliverables.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {ws.deliverables.slice(0, 3).map((d, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-1">
                  <span className="text-emerald-500">&#x2022;</span> {d}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}