import { memo } from 'react';
import type { ConnectionAnchor } from '@/modules/investigations/types';

interface ConnectionAnchorsProps {
  nodeId: string; // Used for identification but not directly in component
  width: number;
  height: number;
  onAnchorClick: (anchor: ConnectionAnchor) => void;
  isConnecting: boolean;
  isSource: boolean;
}

// nodeId is passed for potential future use (e.g., accessibility)

// 8-point anchor positions
const ANCHORS: { id: ConnectionAnchor; x: number; y: number }[] = [
  { id: 'top', x: 0.5, y: 0 },
  { id: 'top-right', x: 1, y: 0 },
  { id: 'right', x: 1, y: 0.5 },
  { id: 'bottom-right', x: 1, y: 1 },
  { id: 'bottom', x: 0.5, y: 1 },
  { id: 'bottom-left', x: 0, y: 1 },
  { id: 'left', x: 0, y: 0.5 },
  { id: 'top-left', x: 0, y: 0 },
];

export const ConnectionAnchors = memo(function ConnectionAnchors({
  width,
  height,
  onAnchorClick,
  isConnecting,
  isSource,
}: ConnectionAnchorsProps) {
  return (
    <>
      {ANCHORS.map((anchor) => {
        const x = anchor.x * width;
        const y = anchor.y * height;

        // Don't show anchors on source node when connecting
        if (isSource) return null;

        return (
          <button
            key={anchor.id}
            className={`
              absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2
              rounded-full border-2 border-accent
              transition-all duration-150
              ${isConnecting
                ? 'bg-accent/80 scale-125 animate-pulse'
                : 'bg-space-800 hover:bg-accent hover:scale-150'
              }
            `}
            style={{
              left: x,
              top: y,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onAnchorClick(anchor.id);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            title={`Connect from ${anchor.id}`}
          />
        );
      })}
    </>
  );
});
