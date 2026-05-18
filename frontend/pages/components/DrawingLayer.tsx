import { memo, useRef, useEffect, useMemo } from 'react';
import type { InvestigationDrawing, DrawingPoint } from '@/modules/investigations/types';
import { useInvestigationsStore } from '@/modules/investigations/store';

interface DrawingLayerProps {
  drawings: InvestigationDrawing[];
}

// Calculate bounds from points
function calculateBounds(points: DrawingPoint[]): { left: number; top: number; right: number; bottom: number } | null {
  if (!points || points.length === 0) return null;

  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  points.forEach((p) => {
    left = Math.min(left, p.x);
    top = Math.min(top, p.y);
    right = Math.max(right, p.x);
    bottom = Math.max(bottom, p.y);
  });

  return { left, top, right, bottom };
}

// Generate a hash for drawing to detect changes
function getDrawingHash(drawing: InvestigationDrawing): string {
  return `${drawing.record_id}:${drawing.updated_at || ''}:${drawing.z_index || 0}:${drawing.color}:${drawing.thickness || drawing.size}:${drawing.line_style}:${drawing.points?.length || 0}`;
}

// Cache for off-screen canvases per drawing
interface DrawingCache {
  hash: string;
  canvas: HTMLCanvasElement;
  bounds: { left: number; top: number; right: number; bottom: number };
}

export const DrawingLayer = memo(function DrawingLayer({ drawings }: DrawingLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectedDrawingIds = useInvestigationsStore((state) => state.selectedDrawingIds);

  // Cache for individual drawing canvases - persists across renders
  const drawingCacheRef = useRef<Map<string, DrawingCache>>(new Map());

  // Calculate full canvas bounds including negative coordinates
  const canvasBounds = useMemo(() => {
    return drawings.reduce(
      (acc, drawing) => {
        const bounds = drawing.bounds || calculateBounds(drawing.points);
        if (bounds) {
          return {
            left: Math.min(acc.left, bounds.left - 50),
            top: Math.min(acc.top, bounds.top - 50),
            right: Math.max(acc.right, bounds.right + 50),
            bottom: Math.max(acc.bottom, bounds.bottom + 50),
          };
        }
        return acc;
      },
      { left: 0, top: 0, right: 4000, bottom: 4000 }
    );
  }, [drawings]);

  // Canvas dimensions (must be positive)
  const canvasWidth = canvasBounds.right - canvasBounds.left;
  const canvasHeight = canvasBounds.bottom - canvasBounds.top;

  // Memoize sorted drawings to avoid re-sorting on every render
  const sortedDrawings = useMemo(() => {
    return [...drawings].sort((a, b) => (a.z_index || 0) - (b.z_index || 0));
  }, [drawings]);

  // Render individual drawing to off-screen canvas (cached)
  const renderDrawingToCache = (drawing: InvestigationDrawing): DrawingCache | null => {
    const cache = drawingCacheRef.current;
    const hash = getDrawingHash(drawing);
    const existing = cache.get(drawing.record_id);

    // Return cached version if unchanged
    if (existing && existing.hash === hash) {
      return existing;
    }

    // Calculate bounds for this drawing
    const drawingBounds = drawing.bounds || calculateBounds(drawing.points);
    if (!drawingBounds) return null;

    // Add padding for selection highlight and stroke width
    const padding = Math.max((drawing.thickness || drawing.size || 2) + 20, 30);
    const bounds = {
      left: drawingBounds.left - padding,
      top: drawingBounds.top - padding,
      right: drawingBounds.right + padding,
      bottom: drawingBounds.bottom + padding,
    };

    const width = bounds.right - bounds.left;
    const height = bounds.bottom - bounds.top;

    // Create or reuse off-screen canvas
    const offscreen = existing?.canvas || document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;

    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;

    // Clear and render
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(-bounds.left, -bounds.top);

    // Draw the actual drawing
    ctx.strokeStyle = drawing.color || '#000000';
    ctx.fillStyle = drawing.color || '#000000';
    ctx.lineWidth = drawing.thickness || drawing.size || 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Apply line style
    if (drawing.line_style === 'dashed') {
      ctx.setLineDash([8, 4]);
    } else if (drawing.line_style === 'dotted') {
      ctx.setLineDash([2, 4]);
    } else {
      ctx.setLineDash([]);
    }

    renderDrawingShape(ctx, drawing);
    ctx.restore();

    const newCache: DrawingCache = { hash, canvas: offscreen, bounds };
    cache.set(drawing.record_id, newCache);

    return newCache;
  };

  // Clean up stale cache entries
  useEffect(() => {
    const cache = drawingCacheRef.current;
    const currentIds = new Set(drawings.map((d) => d.record_id));

    // Remove cache entries for deleted drawings
    for (const id of cache.keys()) {
      if (!currentIds.has(id)) {
        cache.delete(id);
      }
    }
  }, [drawings]);

  // Render drawings to canvas using cached off-screen canvases
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Offset context to handle negative coordinates
    ctx.save();
    ctx.translate(-canvasBounds.left, -canvasBounds.top);

    // Render each drawing from cache
    sortedDrawings.forEach((drawing) => {
      const isSelected = selectedDrawingIds.has(drawing.record_id);

      // Draw selection highlight first (behind the drawing)
      if (isSelected) {
        ctx.save();
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
        ctx.lineWidth = (drawing.thickness || drawing.size || 2) + 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(59, 130, 246, 0.6)';
        ctx.shadowBlur = 12;
        ctx.setLineDash([]);

        renderDrawingShape(ctx, drawing);
        ctx.restore();
      }

      // Draw from cached off-screen canvas
      const cached = renderDrawingToCache(drawing);
      if (cached) {
        ctx.drawImage(
          cached.canvas,
          cached.bounds.left,
          cached.bounds.top
        );
      }
    });

    ctx.restore();
  }, [sortedDrawings, selectedDrawingIds, canvasBounds.left, canvasBounds.top]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      className="absolute pointer-events-none"
      style={{
        imageRendering: 'auto',
        left: canvasBounds.left,
        top: canvasBounds.top,
      }}
    />
  );
});

// Unified render function for drawing shapes
function renderDrawingShape(ctx: CanvasRenderingContext2D, drawing: InvestigationDrawing) {
  switch (drawing.tool) {
    case 'pencil':
      renderPencil(ctx, drawing);
      break;
    case 'line':
      renderLine(ctx, drawing);
      break;
    case 'rectangle':
      renderRectangle(ctx, drawing);
      break;
    case 'circle':
      renderCircle(ctx, drawing);
      break;
    case 'diamond':
      renderDiamond(ctx, drawing);
      break;
    case 'arrow':
      renderArrow(ctx, drawing);
      break;
    case 'label':
      renderLabel(ctx, drawing);
      break;
    default:
      renderPencil(ctx, drawing);
  }
}

// Render pencil path (freehand)
function renderPencil(ctx: CanvasRenderingContext2D, drawing: InvestigationDrawing) {
  const points = drawing.points;
  if (!points || points.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }

  ctx.stroke();
}

// Render line
function renderLine(ctx: CanvasRenderingContext2D, drawing: InvestigationDrawing) {
  const points = drawing.points;
  if (!points || points.length < 2) return;

  const start = points[0];
  const end = points[points.length - 1];

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
}

// Render rectangle
function renderRectangle(ctx: CanvasRenderingContext2D, drawing: InvestigationDrawing) {
  let bounds = drawing.bounds;

  if (!bounds && drawing.points && drawing.points.length >= 2) {
    const start = drawing.points[0];
    const end = drawing.points[drawing.points.length - 1];
    bounds = {
      left: Math.min(start.x, end.x),
      top: Math.min(start.y, end.y),
      right: Math.max(start.x, end.x),
      bottom: Math.max(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    };
  }

  if (!bounds) return;

  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;

  ctx.strokeRect(bounds.left, bounds.top, width, height);
}

// Render circle/ellipse
function renderCircle(ctx: CanvasRenderingContext2D, drawing: InvestigationDrawing) {
  let bounds = drawing.bounds;

  if (!bounds && drawing.points && drawing.points.length >= 2) {
    const start = drawing.points[0];
    const end = drawing.points[drawing.points.length - 1];
    bounds = {
      left: Math.min(start.x, end.x),
      top: Math.min(start.y, end.y),
      right: Math.max(start.x, end.x),
      bottom: Math.max(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    };
  }

  if (!bounds) return;

  const cx = (bounds.left + bounds.right) / 2;
  const cy = (bounds.top + bounds.bottom) / 2;
  const rx = Math.max((bounds.right - bounds.left) / 2, 1);
  const ry = Math.max((bounds.bottom - bounds.top) / 2, 1);

  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
}

// Render diamond
function renderDiamond(ctx: CanvasRenderingContext2D, drawing: InvestigationDrawing) {
  let bounds = drawing.bounds;

  if (!bounds && drawing.points && drawing.points.length >= 2) {
    const start = drawing.points[0];
    const end = drawing.points[drawing.points.length - 1];
    bounds = {
      left: Math.min(start.x, end.x),
      top: Math.min(start.y, end.y),
      right: Math.max(start.x, end.x),
      bottom: Math.max(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    };
  }

  if (!bounds) return;

  const cx = (bounds.left + bounds.right) / 2;
  const cy = (bounds.top + bounds.bottom) / 2;
  const halfW = (bounds.right - bounds.left) / 2;
  const halfH = (bounds.bottom - bounds.top) / 2;

  ctx.beginPath();
  ctx.moveTo(cx, cy - halfH); // top
  ctx.lineTo(cx + halfW, cy); // right
  ctx.lineTo(cx, cy + halfH); // bottom
  ctx.lineTo(cx - halfW, cy); // left
  ctx.closePath();
  ctx.stroke();
}

// Render arrow
function renderArrow(ctx: CanvasRenderingContext2D, drawing: InvestigationDrawing) {
  const points = drawing.points;
  if (!points || points.length < 2) return;

  const start = points[0];
  const end = points[points.length - 1];

  // Draw line
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  // Draw arrowhead
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const headLength = 15;

  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(
    end.x - headLength * Math.cos(angle - Math.PI / 6),
    end.y - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(
    end.x - headLength * Math.cos(angle + Math.PI / 6),
    end.y - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();

  // Check for two-way arrow
  if (drawing.arrow_type === 'two-way') {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(
      start.x + headLength * Math.cos(angle - Math.PI / 6),
      start.y + headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(
      start.x + headLength * Math.cos(angle + Math.PI / 6),
      start.y + headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  }
}

// Render text label
function renderLabel(ctx: CanvasRenderingContext2D, drawing: InvestigationDrawing) {
  const labelText = drawing.text;
  if (!labelText) return;

  let x = 0, y = 0;

  if (drawing.points && drawing.points.length > 0) {
    x = drawing.points[0].x;
    y = drawing.points[0].y;
  } else if (drawing.bounds) {
    x = drawing.bounds.left;
    y = drawing.bounds.top;
  } else {
    return;
  }

  const fontSize = drawing.size || 14;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillStyle = drawing.color || '#000000';
  ctx.textBaseline = 'top';
  ctx.fillText(labelText, x, y);
}
