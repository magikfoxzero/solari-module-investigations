import { memo } from 'react';

interface SelectionMarqueeProps {
  start: { x: number; y: number };
  end: { x: number; y: number };
  viewport: { x: number; y: number };
  zoom: number;
}

export const SelectionMarquee = memo(function SelectionMarquee({
  start,
  end,
  viewport,
  zoom,
}: SelectionMarqueeProps) {
  // Convert canvas coordinates to screen coordinates
  const screenStart = {
    x: start.x * zoom + viewport.x,
    y: start.y * zoom + viewport.y,
  };
  const screenEnd = {
    x: end.x * zoom + viewport.x,
    y: end.y * zoom + viewport.y,
  };

  // Calculate rectangle bounds
  const x = Math.min(screenStart.x, screenEnd.x);
  const y = Math.min(screenStart.y, screenEnd.y);
  const width = Math.abs(screenEnd.x - screenStart.x);
  const height = Math.abs(screenEnd.y - screenStart.y);

  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill="rgba(99, 102, 241, 0.1)"
      stroke="#6366f1"
      strokeWidth={1}
      strokeDasharray="4,4"
      className="pointer-events-none"
    />
  );
});
