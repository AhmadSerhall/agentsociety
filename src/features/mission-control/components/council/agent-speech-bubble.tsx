"use client";

import { motion } from "framer-motion";
import { Maximize2, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentDialogueEntry } from "@/types";
import { normalizeDialogueEntry } from "./agent-output-formatter";

export function AgentSpeechBubble({ entry, onExpand }: { entry: AgentDialogueEntry; onExpand: (entry: AgentDialogueEntry) => void }) {
  const output = normalizeDialogueEntry(entry);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      className="rounded-2xl border border-cyan-200/15 bg-[#081324]/82 p-3 shadow-[0_18px_54px_rgba(0,0,0,0.35)] backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white">{entry.agentName}</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.14em] text-cyan-100/70">
              {output.type}
            </span>
            {entry.targetAgentRole && (
              <span className="text-xs text-white/38">to {entry.targetAgentRole.replace(/-/g, " ")}</span>
            )}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-white/70">{output.summary}</p>
          {entry.referencedWorkstreamIds?.length ? (
            <p className="mt-2 text-xs text-white/40">Related workstream context attached</p>
          ) : null}
        </div>
        {(output.truncated || output.bullets.length > 0 || output.workstreams.length > 0 || output.wasJson) && (
          <Button size="icon" variant="outline" onClick={() => onExpand(entry)} className="h-8 w-8 shrink-0 border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white">
            <Maximize2 className="h-3.5 w-3.5" />
            <span className="sr-only">Expand agent output</span>
          </Button>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-white/35">
        <MessageSquareText className="h-3.5 w-3.5 text-cyan-200/70" />
        <span>{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
      </div>
    </motion.article>
  );
}
