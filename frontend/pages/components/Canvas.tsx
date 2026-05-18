import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import type { RefObject } from 'react';
import { useInvestigationsStore } from '@/modules/investigations/store';
import { InvestigationNode } from './InvestigationNode';
import { ConnectionLine } from './ConnectionLine';
import { DrawingLayer } from './DrawingLayer';
import { DrawingCanvas } from './DrawingCanvas';
import { SelectionMarquee } from './SelectionMarquee';

interface CanvasProps {
  containerRef: RefObject<HTMLDivElement | null>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Canvas({ containerRef: _containerRef }: CanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null);

  // Refs for stable event handler references (avoids memory leak from constant add/remove)
  const zoomRef = useRef(1);
  const handlersRef = useRef<{
    cancelConnection: () => void;
    clearSelection: () => void;
    setZoom: (zoom: number) => void;
    setViewport: (viewport: { x: number; y: number }) => void;
  } | null>(null);

  const {
    nodes,
    connections,
    drawings,
    viewport,
    zoom,
    currentTool,
    isPanning,
    connectFrom,
    setViewport,
    setZoom,
    setIsPanning,
    clearSelection,
    selectByMarquee,
    cancelConnection,
  } = useInvestigationsStore();

  // Keep refs updated for stable event handlers
  // eslint-disable-next-line react-hooks/refs
  zoomRef.current = zoom;
  // eslint-disable-next-line react-hooks/refs
  handlersRef.current = { cancelConnection, clearSelection, setZoom, setViewport };

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };

      return {
        x: (screenX - rect.left - viewport.x) / zoom,
        y: (screenY - rect.top - viewport.y) / zoom,
      };
    },
    [viewport, zoom]
  );

  // Handle mouse wheel for zoom
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Get mouse position relative to canvas
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Calculate zoom factor
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(4, zoom * zoomFactor));

      // Zoom towards mouse position
      const zoomRatio = newZoom / zoom;
      const newViewportX = mouseX - (mouseX - viewport.x) * zoomRatio;
      const newViewportY = mouseY - (mouseY - viewport.y) * zoomRatio;

      setZoom(newZoom);
      setViewport({ x: newViewportX, y: newViewportY });
    },
    [zoom, viewport, setZoom, setViewport]
  );

  // Add wheel event listener
  useEffect(() => {
    const svg = svgRef.current;
    if (svg) {
      svg.addEventListener('wheel', handleWheel, { passive: false });
      return () => svg.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  // Handle mouse down
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Ignore if clicking on a node or connection
      if ((e.target as HTMLElement).closest('[data-node]') ||
          (e.target as HTMLElement).closest('[data-connection]')) {
        return;
      }

      const startPos = { x: e.clientX, y: e.clientY };

      // Middle mouse button, space+click, or pan tool for panning
      if (e.button === 1 || (e.button === 0 && e.shiftKey) || (e.button === 0 && currentTool === 'pan')) {
        e.preventDefault();
        setIsDragging(true);
        setDragStart(startPos);
        setIsPanning(true);
        return;
      }

      // Left click with select tool
      if (e.button === 0 && currentTool === 'select') {
        // Start marquee selection
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        setMarqueeStart(canvasPos);
        setMarqueeEnd(canvasPos);
        setIsDragging(true);
        setDragStart(startPos);

        // Clear selection if not holding shift
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          clearSelection();
        }
      }

      // Cancel connection if clicking on empty space while connecting
      if (connectFrom) {
        cancelConnection();
      }
    },
    [currentTool, connectFrom, screenToCanvas, clearSelection, cancelConnection, setIsPanning]
  );

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !dragStart) return;

      if (isPanning) {
        // Pan the canvas
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        setViewport({
          x: viewport.x + dx,
          y: viewport.y + dy,
        });
        setDragStart({ x: e.clientX, y: e.clientY });
      } else if (marqueeStart) {
        // Update marquee selection
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        setMarqueeEnd(canvasPos);
      }
    },
    [isDragging, dragStart, isPanning, marqueeStart, viewport, screenToCanvas, setViewport]
  );

  // Handle mouse up
  const handleMouseUp = useCallback(
    () => {
      if (marqueeStart && marqueeEnd) {
        // Apply marquee selection
        selectByMarquee({
          x1: marqueeStart.x,
          y1: marqueeStart.y,
          x2: marqueeEnd.x,
          y2: marqueeEnd.y,
        });
      }

      setIsDragging(false);
      setDragStart(null);
      setMarqueeStart(null);
      setMarqueeEnd(null);
      setIsPanning(false);
    },
    [marqueeStart, marqueeEnd, selectByMarquee, setIsPanning]
  );

  // Handle keyboard shortcuts - use refs for stable listener (no constant add/remove)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if focus is in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const handlers = handlersRef.current;
      if (!handlers) return;

      // Delete selected nodes/connections/drawings
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useInvestigationsStore.getState();
        if (state.selectedNodeIds.size > 0 || state.selectedConnectionId || state.selectedDrawingIds.size > 0) {
          e.preventDefault();
          state.deleteSelected();
        }
      }

      // Escape to cancel current operation
      if (e.key === 'Escape') {
        handlers.cancelConnection();
        handlers.clearSelection();
        setMarqueeStart(null);
        setMarqueeEnd(null);
      }

      // Zoom shortcuts - use ref for current zoom value
      const currentZoom = zoomRef.current;
      if ((e.metaKey || e.ctrlKey) && e.key === '=') {
        e.preventDefault();
        handlers.setZoom(Math.min(4, currentZoom * 1.2));
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        handlers.setZoom(Math.max(0.1, currentZoom / 1.2));
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        handlers.setZoom(1);
        handlers.setViewport({ x: 0, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // Empty deps - handlers accessed via refs

  // Get the transform string
  const transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${zoom})`;

  // Virtualization: Calculate visible viewport bounds with buffer
  const visibleNodes = useMemo(() => {
    /* eslint-disable react-hooks/refs */
    const svg = svgRef.current;
    if (!svg) return nodes;

    // Get container dimensions
    const containerWidth = svg.clientWidth || 1920;
    const containerHeight = svg.clientHeight || 1080;

    // Buffer zone for smooth scrolling (render nodes just outside viewport)
    const buffer = 200;

    // Convert viewport to canvas coordinates
    const visibleLeft = (-viewport.x / zoom) - buffer;
    const visibleTop = (-viewport.y / zoom) - buffer;
    const visibleRight = ((containerWidth - viewport.x) / zoom) + buffer;
    const visibleBottom = ((containerHeight - viewport.y) / zoom) + buffer;
    /* eslint-enable react-hooks/refs */

    // Filter nodes to only those in or near the visible area
    return nodes.filter((node) => {
      if (!node || !node.record_id || !node.entity_type) return false;

      // Node dimensions (approximate - nodes are typically 180x80)
      const nodeWidth = 200;
      const nodeHeight = 100;

      // Check if node overlaps with visible area
      const nodeRight = node.x + nodeWidth;
      const nodeBottom = node.y + nodeHeight;

      return (
        nodeRight >= visibleLeft &&
        node.x <= visibleRight &&
        nodeBottom >= visibleTop &&
        node.y <= visibleBottom
      );
    });
  }, [nodes, viewport.x, viewport.y, zoom]);

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        cursor: isPanning
          ? 'grabbing'
          : currentTool === 'pan'
          ? 'grab'
          : currentTool === 'select'
          ? 'default'
          : 'crosshair',
      }}
    >
      {/* SVG Layer for connections and selection */}
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Grid Pattern */}
        <defs>
          <pattern
            id="grid"
            width={20 * zoom}
            height={20 * zoom}
            patternUnits="userSpaceOnUse"
            x={viewport.x % (20 * zoom)}
            y={viewport.y % (20 * zoom)}
          >
            <circle
              cx={1}
              cy={1}
              r={1}
              className="fill-space-700/50"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" className="pointer-events-none" />

        {/* Transformed group for connections */}
        <g style={{ transform, transformOrigin: '0 0' }}>
          {/* Connections */}
          {connections.map((connection) => (
            <ConnectionLine
              key={connection.record_id}
              connection={connection}
              nodes={nodes}
            />
          ))}

          {/* Connection preview line when creating new connection */}
          {connectFrom && (
            <ConnectionPreview
              fromNodeId={connectFrom.nodeId}
              fromAnchor={connectFrom.anchor}
              nodes={nodes}
              svgRef={svgRef}
              viewport={viewport}
              zoom={zoom}
            />
          )}
        </g>

        {/* Selection Marquee */}
        {marqueeStart && marqueeEnd && (
          <SelectionMarquee
            start={marqueeStart}
            end={marqueeEnd}
            viewport={viewport}
            zoom={zoom}
          />
        )}
      </svg>

      {/* Drawing Layer (HTML5 Canvas) - Renders saved drawings */}
      <div style={{ transform, transformOrigin: '0 0' }} className="absolute pointer-events-none">
        <DrawingLayer drawings={drawings} />
      </div>

      {/* Interactive Drawing Canvas - Captures new drawings */}
      <DrawingCanvas viewport={viewport} zoom={zoom} />

      {/* Nodes Layer (DOM elements for better interaction) - Virtualized */}
      <div
        style={{ transform, transformOrigin: '0 0' }}
        className="absolute"
      >
        {visibleNodes.map((node) => (
          <InvestigationNode
            key={node.record_id}
            node={node}
          />
        ))}
      </div>
    </div>
  );
}

// Connection preview component when drawing new connection
function ConnectionPreview({
  fromNodeId,
  fromAnchor,
  nodes,
  svgRef,
  viewport,
  zoom,
}: {
  fromNodeId: string;
  fromAnchor: string;
  nodes: { record_id: string; x: number; y: number; width: number; height: number }[];
  svgRef: RefObject<SVGSVGElement | null>;
  viewport: { x: number; y: number };
  zoom: number;
}) {
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;

      setMousePos({
        x: (e.clientX - rect.left - viewport.x) / zoom,
        y: (e.clientY - rect.top - viewport.y) / zoom,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [svgRef, viewport, zoom]);

  const fromNode = nodes.find((n) => n.record_id === fromNodeId);
  if (!fromNode || !mousePos) return null;

  // Calculate anchor position on node
  const anchorPos = getAnchorPosition(fromNode, fromAnchor);

  return (
    <line
      x1={anchorPos.x}
      y1={anchorPos.y}
      x2={mousePos.x}
      y2={mousePos.y}
      stroke="#6366f1"
      strokeWidth={2}
      strokeDasharray="5,5"
      className="pointer-events-none"
    />
  );
}

// Helper to get anchor position on a node
function getAnchorPosition(
  node: { x: number; y: number; width: number; height: number },
  anchor: string
): { x: number; y: number } {
  // Ensure all values are numbers (API may return strings)
  const x = Number(node.x) || 0;
  const y = Number(node.y) || 0;
  const width = Number(node.width) || 200;
  const height = Number(node.height) || 80;
  const cx = x + width / 2;
  const cy = y + height / 2;

  switch (anchor) {
    case 'top':
      return { x: cx, y };
    case 'top-right':
      return { x: x + width, y };
    case 'right':
      return { x: x + width, y: cy };
    case 'bottom-right':
      return { x: x + width, y: y + height };
    case 'bottom':
      return { x: cx, y: y + height };
    case 'bottom-left':
      return { x, y: y + height };
    case 'left':
      return { x, y: cy };
    case 'top-left':
      return { x, y };
    default:
      return { x: cx, y: cy };
  }
}
