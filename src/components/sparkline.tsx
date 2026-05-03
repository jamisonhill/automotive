import { cn } from "@/lib/utils";

/*
 * Sparkline — minimal SVG line chart, no deps.
 *
 * Renders a single line through {x, y} points. Y-axis auto-scales to data,
 * X-axis is index-based (we don't draw axis labels — this is a sparkline,
 * not a full chart). Designed to fit anywhere; pass width/height or let it
 * fill the container via the className.
 *
 * Used by the fuel page for MPG-over-time. Future phases can reuse for
 * cost/mile, tread depth, etc.
 */

export interface SparklinePoint {
  /** Timestamp or sequence position — only used for ordering */
  x: number;
  y: number;
}

interface SparklineProps {
  data: SparklinePoint[];
  /** SVG viewBox dimensions; the SVG itself scales to its container */
  width?: number;
  height?: number;
  className?: string;
  /** Show a small dot for each data point */
  dots?: boolean;
  /** Stroke color override (defaults to accent) */
  stroke?: string;
}

export function Sparkline({
  data,
  width = 320,
  height = 80,
  className,
  dots = true,
  stroke = "var(--color-accent)",
}: SparklineProps) {
  if (data.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-xs text-fg-muted",
          className
        )}
        style={{ height }}
      >
        Not enough data yet
      </div>
    );
  }

  const padding = 6;
  const sorted = [...data].sort((a, b) => a.x - b.x);

  const ys = sorted.map((d) => d.y);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  // Avoid divide-by-zero when every value is identical — flatline at mid-height.
  const yRange = yMax - yMin || 1;

  const xMin = sorted[0].x;
  const xMax = sorted[sorted.length - 1].x;
  const xRange = xMax - xMin || 1;

  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const points = sorted.map((d) => {
    const x = padding + ((d.x - xMin) / xRange) * innerW;
    const y =
      padding + innerH - ((d.y - yMin) / yRange) * innerH; // flip Y for SVG
    return { x, y };
  });

  // For a single point, just show a dot in the middle.
  const path =
    points.length === 1
      ? ""
      : "M " +
        points.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("w-full", className)}
      preserveAspectRatio="none"
      role="img"
      aria-label="Trend line"
    >
      {/* Subtle baseline at the average for visual context */}
      <line
        x1={padding}
        y1={padding + innerH * 0.5}
        x2={padding + innerW}
        y2={padding + innerH * 0.5}
        stroke="var(--color-border-subtle)"
        strokeWidth={1}
        strokeDasharray="2 3"
      />
      {path && (
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {dots &&
        points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={2.5}
            fill={stroke}
          />
        ))}
    </svg>
  );
}
