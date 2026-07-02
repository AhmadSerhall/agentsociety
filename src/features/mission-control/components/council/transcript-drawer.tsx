"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useRuntimeSettingsStore } from "@/store";
import type { AgentDialogueEntry } from "@/types";
import { sanitizeUserFacingText } from "@/utils";
import { normalizeDialogueEntry } from "./agent-output-formatter";

export function TranscriptDrawer({ dialogue, open, onOpenChange, focusEntry }: { dialogue: AgentDialogueEntry[]; open: boolean; onOpenChange: (open: boolean) => void; focusEntry?: AgentDialogueEntry | null }) {
  const debugMode = useRuntimeSettingsStore((s) => s.developerDebugMode);
  const [query, setQuery] = useState("");
  const [agent, setAgent] = useState("all");
  const [type, setType] = useState("all");

  const rows = useMemo(() => {
    return dialogue
      .map((entry) => ({ entry, output: normalizeDialogueEntry(entry) }))
      .filter(({ entry, output }) => agent === "all" || entry.agentRole === agent)
      .filter(({ output }) => type === "all" || output.type === type)
      .filter(({ entry, output }) => {
        const haystack = `${entry.displayRole ?? entry.agentName} ${entry.agentRole} ${output.summary} ${output.bullets.join(" ")}`.toLowerCase();
        return haystack.includes(query.toLowerCase());
      });
  }, [agent, dialogue, query, type]);

  const focusKey = focusEntry ? `${focusEntry.agentId}-${focusEntry.timestamp}` : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full border-cyan-200/15 bg-[#07111f]/95 p-0 text-white shadow-[0_0_90px_rgba(34,211,238,0.18)] backdrop-blur-2xl sm:max-w-2xl">
        <SheetHeader className="sticky top-0 z-10 border-b border-cyan-200/10 bg-[#07111f]/90 p-5 backdrop-blur-2xl">
          <SheetTitle className="pr-8 text-white">Full Transcript</SheetTitle>
          <div className="grid gap-2 pt-3 md:grid-cols-[1fr_150px_150px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search transcript" className="h-10 border-white/10 bg-black/25 pl-9 text-white placeholder:text-white/30" />
            </div>
            <Select value={agent} onValueChange={setAgent}>
              <SelectTrigger className="h-10 border-white/10 bg-black/25 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {[...new Map(dialogue.map((entry) => [entry.agentRole, entry.displayRole ?? entry.agentRole.replace(/-/g, " ")])).entries()].map(([role, label]) => <SelectItem key={role} value={role}>{sanitizeUserFacingText(label)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-10 border-white/10 bg-black/25 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["all", "planning", "question", "answer", "challenge", "agreement", "conflict", "mediation", "synthesis"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </SheetHeader>
        <div className="space-y-3 overflow-y-auto p-5 [scrollbar-color:rgba(34,211,238,0.65)_transparent] [scrollbar-width:thin]">
          {rows.map(({ entry, output }) => {
            const highlighted = focusKey === `${entry.agentId}-${entry.timestamp}`;
            return (
              <article key={`${entry.agentId}-${entry.timestamp}`} className={`rounded-2xl border p-4 ${highlighted ? "border-cyan-200/45 bg-cyan-300/[0.08]" : "border-white/10 bg-white/[0.035]"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-white">{sanitizeUserFacingText(entry.displayRole || entry.agentName)}</span>
                  <span className="text-xs capitalize text-cyan-100/70">{output.type}</span>
                  <span className="text-xs text-white/35">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/66">{output.summary}</p>
                {output.bullets.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm text-white/56">
                    {output.bullets.map((bullet) => <li key={bullet}>- {bullet}</li>)}
                  </ul>
                )}
                {output.workstreams.length > 0 && (
                  <div className="mt-3 grid gap-2">
                    {output.workstreams.map((stream) => (
                      <div key={stream.title} className="rounded-xl border border-cyan-200/10 bg-cyan-300/[0.045] p-3">
                        <p className="text-sm font-medium text-white">{stream.title}</p>
                        {stream.description && <p className="mt-1 text-xs leading-relaxed text-white/50">{stream.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {debugMode && (
                  <details className="mt-3 rounded-xl border border-purple-200/10 bg-purple-300/[0.045] p-3">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-purple-100">Raw Output</summary>
                    <pre className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap break-words text-xs text-white/58">{output.raw}</pre>
                  </details>
                )}
              </article>
            );
          })}
          {rows.length === 0 && <p className="text-sm italic text-white/45">No transcript messages match these filters.</p>}
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full border-white/10 bg-white/[0.04] text-white/70">Close Transcript</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
