"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type DonutSegment = { color: string; id: string; label: string; path?: string };

export function DashboardSpendingDonut({ ariaLabel, segments, total }: { ariaLabel: string; segments: DonutSegment[]; total: string }) {
  return (
    <TooltipProvider>
      <div aria-label={ariaLabel} className="relative aspect-square w-56 justify-self-center">
        <svg viewBox="0 0 200 200" className="size-full" role="img" aria-label="Spending breakdown">
          {segments.length === 1 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <circle cx="100" cy="100" r="79" fill="none" stroke={segments[0].color} strokeWidth="34" aria-label={segments[0].label} />
              </TooltipTrigger>
              <TooltipContent>{segments[0].label}</TooltipContent>
            </Tooltip>
          ) : (
            segments.map((segment, index) => (
              <Tooltip key={`${segment.id}-${index}`}>
                <TooltipTrigger asChild>
                  <path d={segment.path} fill={segment.color} className="transition-opacity hover:opacity-70" aria-label={segment.label} />
                </TooltipTrigger>
                <TooltipContent>{segment.label}</TooltipContent>
              </Tooltip>
            ))
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <span className="font-mono text-lg font-semibold">{total}</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
