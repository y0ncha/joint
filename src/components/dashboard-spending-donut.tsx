"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type DonutSegment = { color: string; id: string; label: string; value: number };

function donutSegmentPath(startAngle: number, endAngle: number) {
  const point = (radius: number, angle: number) => {
    const radians = ((angle - 90) * Math.PI) / 180;
    return [100 + radius * Math.cos(radians), 100 + radius * Math.sin(radians)];
  };
  const [outerStartX, outerStartY] = point(96, startAngle);
  const [outerEndX, outerEndY] = point(96, endAngle);
  const [innerEndX, innerEndY] = point(62, endAngle);
  const [innerStartX, innerStartY] = point(62, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${outerStartX} ${outerStartY} A 96 96 0 ${largeArc} 1 ${outerEndX} ${outerEndY} L ${innerEndX} ${innerEndY} A 62 62 0 ${largeArc} 0 ${innerStartX} ${innerStartY} Z`;
}

export function DashboardSpendingDonut({ ariaLabel, segments, total }: { ariaLabel: string; segments: DonutSegment[]; total: string }) {
  const totalValue = segments.reduce((sum, segment) => sum + segment.value, 0);
  const transitionKey = segments.map((segment) => `${segment.id}:${segment.value}:${segment.color}`).join("|");
  const segmentsWithPaths = segments.reduce<Array<DonutSegment & { endAngle: number; path: string }>>((values, segment) => {
    const startAngle = values.at(-1)?.endAngle ?? 0;
    const endAngle = totalValue > 0 ? startAngle + (segment.value / totalValue) * 360 : startAngle;
    return [...values, { ...segment, endAngle, path: donutSegmentPath(startAngle, endAngle) }];
  }, []);

  return (
    <TooltipProvider>
      <div aria-label={ariaLabel} className="relative aspect-square w-56 justify-self-center md:h-full md:w-auto md:max-w-full">
        <svg viewBox="0 0 200 200" className="size-full" role="img" aria-label="Spending breakdown">
          {segments.length === 1 ? (
            <Tooltip key={transitionKey}>
              <TooltipTrigger asChild>
                <circle
                  cx="100"
                  cy="100"
                  r="79"
                  fill="none"
                  stroke={segments[0].color}
                  strokeWidth="34"
                  className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200 motion-reduce:animate-none"
                  aria-label={segments[0].label}
                />
              </TooltipTrigger>
              <TooltipContent>{segments[0].label}</TooltipContent>
            </Tooltip>
          ) : (
            segmentsWithPaths.map((segment, index) => (
              <Tooltip key={`${transitionKey}-${segment.id}-${index}`}>
                <TooltipTrigger asChild>
                  <path
                    d={segment.path}
                    fill={segment.color}
                    className="transition-opacity hover:opacity-70 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200 motion-reduce:animate-none"
                    aria-label={segment.label}
                  />
                </TooltipTrigger>
                <TooltipContent>{segment.label}</TooltipContent>
              </Tooltip>
            ))
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <span className="font-mono text-4xl font-semibold sm:text-5xl">{total}</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
