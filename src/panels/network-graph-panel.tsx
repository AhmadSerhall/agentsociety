"use client";

export function NetworkGraphPanel() {
  return (
    <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
      <div className="text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <circle cx="4" cy="6" r="2" />
            <circle cx="20" cy="6" r="2" />
            <circle cx="4" cy="18" r="2" />
            <circle cx="20" cy="18" r="2" />
            <line x1="10" y1="10" x2="6" y2="8" />
            <line x1="14" y1="10" x2="18" y2="8" />
            <line x1="10" y1="14" x2="6" y2="16" />
            <line x1="14" y1="14" x2="18" y2="16" />
          </svg>
        </div>
        <p className="text-xs text-muted-foreground">Agent Network Graph</p>
        <p className="text-[10px] text-muted-foreground/60">Coming soon</p>
      </div>
    </div>
  );
}