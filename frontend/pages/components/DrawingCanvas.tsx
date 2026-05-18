import { useRef, useState, useCallback, useEffect, memo } from 'react';
import { useInvestigationsStore } from '@/modules/investigations/store';
import type { DrawingPoint, InvestigationDrawing } from '@/modules/investigations/types';

interface DrawingCanvasProps {
  viewport: { x: number; y: number };
  zoom: number;
}

export const DrawingCanvas = memo(function DrawingCanvas({ viewport, zoom }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<DrawingPoint | null>(null);
  const [currentPoints, setCurrentPoints] = useState<DrawingPoint[]>([]);
  const [currentMousePos, setCurrentMousePos] = useState<DrawingPoint | null>(null);
  const lastPointRef = useRef<DrawingPoint | null>(null);

  const {
    currentTool,
    drawingTool,
    drawColor,
    drawSize,
    drawings,
    addDrawing,
    deleteDrawing,
  } = useInvestigationsStore();

  // Only active when in draw mode
  const isActive = currentTool === 'draw';

  // Convert screen coordinates to canvas coordinates
  // Uses the parent container's position since the canvas may be offset
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number) => {
      const canvas = canvasRef.current;
      const parent = canvas?.parentElement;
      if (!parent) return { x: 0, y: 0 };

      // Use parent's bounding rect as the reference point
      const parentRect = parent.getBoundingClientRect();

      return {
        x: (screenX - parentRect.left - viewport.x) / zoom,
        y: (screenY - parentRect.top - viewport.y) / zoom,
      };
    },
    [viewport, zoom]
  );

  // Check if eraser path intersects a drawing
  const isPointNearDrawing = useCallback(
    (point: DrawingPoint, drawing: InvestigationDrawing, threshold: number): boolean => {
      const points = drawing.points;
      if (!points || points.length === 0) return false;

      const start = points[0];
      const end = points[points.length - 1];

      // Helper to get bounds - from drawing.bounds or calculated from points
      const getBounds = () => {
        if (drawing.bounds) return drawing.bounds;
        if (points.length >= 2) {
          return {
            left: Math.min(start.x, end.x),
            top: Math.min(start.y, end.y),
            right: Math.max(start.x, end.x),
            bottom: Math.max(start.y, end.y),
          };
        }
        return null;
      };

      switch (drawing.tool) {
        case 'pencil':
          // Check distance to any point in the path
          return points.some((p) => {
            const dx = point.x - p.x;
            const dy = point.y - p.y;
            return Math.sqrt(dx * dx + dy * dy) < threshold;
          });

        case 'line':
        case 'arrow':
          // Check distance to line segment
          return distanceToLineSegment(point, start, end) < threshold;

        case 'rectangle': {
          const bounds = getBounds();
          if (!bounds) return false;
          const { left, top, right, bottom } = bounds;
          // Check distance to each edge
          return (
            distanceToLineSegment(point, { x: left, y: top }, { x: right, y: top }) < threshold ||
            distanceToLineSegment(point, { x: right, y: top }, { x: right, y: bottom }) < threshold ||
            distanceToLineSegment(point, { x: right, y: bottom }, { x: left, y: bottom }) < threshold ||
            distanceToLineSegment(point, { x: left, y: bottom }, { x: left, y: top }) < threshold
          );
        }

        case 'circle': {
          const bounds = getBounds();
          if (!bounds) return false;
          const cx = (bounds.left + bounds.right) / 2;
          const cy = (bounds.top + bounds.bottom) / 2;
          const rx = Math.max((bounds.right - bounds.left) / 2, 1);
          const ry = Math.max((bounds.bottom - bounds.top) / 2, 1);
          // Check if point is near the ellipse perimeter
          const dx = point.x - cx;
          const dy = point.y - cy;
          const normalizedDist = Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
          return Math.abs(normalizedDist - 1) < threshold / Math.min(rx, ry);
        }

        case 'diamond': {
          const bounds = getBounds();
          if (!bounds) return false;
          const dcx = (bounds.left + bounds.right) / 2;
          const dcy = (bounds.top + bounds.bottom) / 2;
          const halfW = (bounds.right - bounds.left) / 2;
          const halfH = (bounds.bottom - bounds.top) / 2;
          // Diamond has 4 edges
          const topPt = { x: dcx, y: dcy - halfH };
          const rightPt = { x: dcx + halfW, y: dcy };
          const bottomPt = { x: dcx, y: dcy + halfH };
          const leftPt = { x: dcx - halfW, y: dcy };
          return (
            distanceToLineSegment(point, topPt, rightPt) < threshold ||
            distanceToLineSegment(point, rightPt, bottomPt) < threshold ||
            distanceToLineSegment(point, bottomPt, leftPt) < threshold ||
            distanceToLineSegment(point, leftPt, topPt) < threshold
          );
        }

        case 'label': {
          // For labels, check if point is near the text position
          const labelPos = points[0];
          const textWidth = (drawing.text?.length || 1) * (drawing.size || 14) * 0.6;
          const textHeight = (drawing.size || 14) * 1.2;
          return (
            point.x >= labelPos.x - threshold &&
            point.x <= labelPos.x + textWidth + threshold &&
            point.y >= labelPos.y - textHeight &&
            point.y <= labelPos.y + threshold
          );
        }

        default:
          return false;
      }
    },
    []
  );

  // Convert canvas coordinates to screen coordinates for preview drawing
  const canvasToScreen = useCallback(
    (canvasX: number, canvasY: number) => ({
      x: canvasX * zoom + viewport.x,
      y: canvasY * zoom + viewport.y,
    }),
    [viewport, zoom]
  );

  // Draw the current stroke/shape preview in screen coordinates (no clipping)
  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!isDrawing || !startPoint) return;

    // Convert canvas coords to screen coords for preview
    const startScreen = canvasToScreen(startPoint.x, startPoint.y);
    const endCanvas = currentMousePos || startPoint;
    const endScreen = canvasToScreen(endCanvas.x, endCanvas.y);

    ctx.save();
    // Draw directly in screen coordinates - no transform needed
    ctx.strokeStyle = drawColor;
    ctx.fillStyle = drawColor;
    ctx.lineWidth = drawSize * zoom; // Scale line width with zoom
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (drawingTool) {
      case 'pencil':
        if (currentPoints.length >= 2) {
          ctx.beginPath();
          const firstScreen = canvasToScreen(currentPoints[0].x, currentPoints[0].y);
          ctx.moveTo(firstScreen.x, firstScreen.y);
          for (let i = 1; i < currentPoints.length; i++) {
            const ptScreen = canvasToScreen(currentPoints[i].x, currentPoints[i].y);
            ctx.lineTo(ptScreen.x, ptScreen.y);
          }
          ctx.stroke();
        }
        break;

      case 'line':
        ctx.beginPath();
        ctx.moveTo(startScreen.x, startScreen.y);
        ctx.lineTo(endScreen.x, endScreen.y);
        ctx.stroke();
        break;

      case 'arrow': {
        // Draw line
        ctx.beginPath();
        ctx.moveTo(startScreen.x, startScreen.y);
        ctx.lineTo(endScreen.x, endScreen.y);
        ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(endScreen.y - startScreen.y, endScreen.x - startScreen.x);
        const headLength = 15 * zoom;
        ctx.beginPath();
        ctx.moveTo(endScreen.x, endScreen.y);
        ctx.lineTo(
          endScreen.x - headLength * Math.cos(angle - Math.PI / 6),
          endScreen.y - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(endScreen.x, endScreen.y);
        ctx.lineTo(
          endScreen.x - headLength * Math.cos(angle + Math.PI / 6),
          endScreen.y - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
        break;
      }

      case 'rectangle': {
        const rectWidth = endScreen.x - startScreen.x;
        const rectHeight = endScreen.y - startScreen.y;
        ctx.strokeRect(startScreen.x, startScreen.y, rectWidth, rectHeight);
        break;
      }

      case 'circle': {
        const rx = Math.abs(endScreen.x - startScreen.x) / 2;
        const ry = Math.abs(endScreen.y - startScreen.y) / 2;
        const cx = (startScreen.x + endScreen.x) / 2;
        const cy = (startScreen.y + endScreen.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }

      case 'diamond': {
        // Diamond is a rotated square - 4 points
        const dcx = (startScreen.x + endScreen.x) / 2;
        const dcy = (startScreen.y + endScreen.y) / 2;
        const halfWidth = Math.abs(endScreen.x - startScreen.x) / 2;
        const halfHeight = Math.abs(endScreen.y - startScreen.y) / 2;
        ctx.beginPath();
        ctx.moveTo(dcx, dcy - halfHeight); // top
        ctx.lineTo(dcx + halfWidth, dcy); // right
        ctx.lineTo(dcx, dcy + halfHeight); // bottom
        ctx.lineTo(dcx - halfWidth, dcy); // left
        ctx.closePath();
        ctx.stroke();
        break;
      }

      case 'eraser':
        // Show eraser cursor/path
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.lineWidth = drawSize * zoom * 2;
        if (currentPoints.length >= 2) {
          ctx.beginPath();
          const firstScreen = canvasToScreen(currentPoints[0].x, currentPoints[0].y);
          ctx.moveTo(firstScreen.x, firstScreen.y);
          for (let i = 1; i < currentPoints.length; i++) {
            const ptScreen = canvasToScreen(currentPoints[i].x, currentPoints[i].y);
            ctx.lineTo(ptScreen.x, ptScreen.y);
          }
          ctx.stroke();
        }
        break;

      case 'label':
        // Show text cursor position
        ctx.font = `${drawSize * zoom * 2}px sans-serif`;
        ctx.fillStyle = drawColor;
        ctx.fillText('|', startScreen.x, startScreen.y);
        break;
    }

    ctx.restore();
  }, [isDrawing, startPoint, currentMousePos, currentPoints, drawingTool, drawColor, drawSize, zoom, canvasToScreen]);

  // Redraw preview when state changes
  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  // Handle mouse down
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isActive || e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();

      const point = screenToCanvas(e.clientX, e.clientY);

      // For label tool, prompt for text immediately
      if (drawingTool === 'label') {
        const text = window.prompt('Enter label text:');
        if (text && text.trim()) {
          // Sanitize text: strip HTML tags and limit length
          const sanitized = text
            .trim()
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/[<>]/g, '') // Remove any remaining angle brackets
            .slice(0, 500); // Limit length to 500 characters

          if (sanitized) {
            addDrawing({
              tool: 'label',
              points: [point],
              color: drawColor,
              size: drawSize * 2,
              thickness: drawSize,
              text: sanitized,
            });
          }
        }
        return;
      }

      setIsDrawing(true);
      setStartPoint(point);
      setCurrentMousePos(point);

      if (drawingTool === 'pencil' || drawingTool === 'eraser') {
        setCurrentPoints([point]);
        lastPointRef.current = point;
      }
    },
    [isActive, screenToCanvas, drawingTool, drawColor, drawSize, addDrawing]
  );

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing || !isActive) return;

      const point = screenToCanvas(e.clientX, e.clientY);
      setCurrentMousePos(point);

      if (drawingTool === 'pencil') {
        // Throttle point collection for performance
        const lastPoint = lastPointRef.current;
        if (lastPoint) {
          const dx = point.x - lastPoint.x;
          const dy = point.y - lastPoint.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 2) return;
        }

        setCurrentPoints((prev) => [...prev, point]);
        lastPointRef.current = point;
      } else if (drawingTool === 'eraser') {
        // Check for drawings to erase
        const eraserThreshold = drawSize * 2;
        const drawingsToDelete: string[] = [];

        drawings.forEach((drawing) => {
          if (isPointNearDrawing(point, drawing, eraserThreshold)) {
            drawingsToDelete.push(drawing.record_id);
          }
        });

        // Delete found drawings
        drawingsToDelete.forEach((id) => {
          deleteDrawing(id);
        });

        // Track eraser path for visual feedback
        const lastPoint = lastPointRef.current;
        if (lastPoint) {
          const dx = point.x - lastPoint.x;
          const dy = point.y - lastPoint.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= 2) {
            setCurrentPoints((prev) => [...prev, point]);
            lastPointRef.current = point;
          }
        } else {
          setCurrentPoints([point]);
          lastPointRef.current = point;
        }
      }
    },
    [isDrawing, isActive, screenToCanvas, drawingTool, drawSize, drawings, isPointNearDrawing, deleteDrawing]
  );

  const resetState = useCallback(() => {
    // Clear temporary canvas
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    setIsDrawing(false);
    setStartPoint(null);
    setCurrentMousePos(null);
    setCurrentPoints([]);
    lastPointRef.current = null;
  }, []);

  // Handle mouse up - save the drawing
  const handleMouseUp = useCallback(async () => {
    if (!isDrawing || !startPoint) {
      resetState();
      return;
    }

    const endPoint = currentMousePos || startPoint;

    // Don't save eraser strokes
    if (drawingTool === 'eraser') {
      resetState();
      return;
    }

    // Calculate bounds
    let points: DrawingPoint[] = [];

    switch (drawingTool) {
      case 'pencil':
        if (currentPoints.length < 2) {
          resetState();
          return;
        }
        points = currentPoints;
        break;

      case 'line':
      case 'arrow':
        points = [startPoint, endPoint];
        break;

      case 'rectangle':
      case 'circle':
      case 'diamond':
        points = [startPoint, endPoint];
        break;

      default:
        resetState();
        return;
    }

    // Don't save if too small (except for pencil which already has minimum points check)
    if (drawingTool !== 'pencil') {
      const dx = Math.abs(endPoint.x - startPoint.x);
      const dy = Math.abs(endPoint.y - startPoint.y);
      if (dx < 5 && dy < 5) {
        resetState();
        return;
      }
      // Validate drawing doesn't exceed maximum size (10000x10000)
      const MAX_DRAWING_SIZE = 10000;
      if (dx > MAX_DRAWING_SIZE || dy > MAX_DRAWING_SIZE) {
        console.warn('Drawing too large, limiting size');
        resetState();
        return;
      }
    }

    try {
      await addDrawing({
        tool: drawingTool,
        points,
        color: drawColor,
        size: drawSize,
        thickness: drawSize,
      });
    } catch (error) {
      console.error('Failed to save drawing:', error);
    }

    resetState();
  }, [isDrawing, startPoint, currentMousePos, currentPoints, drawingTool, drawColor, drawSize, addDrawing, resetState]);

  // Handle mouse leave - save drawing and reset state to prevent stuck drawing state
  const handleMouseLeave = useCallback(() => {
    if (isDrawing) {
      // Save the drawing before resetting state
      handleMouseUp();
    }
  }, [isDrawing, handleMouseUp]);

  // Global mouseup listener to handle mouse release outside canvas
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDrawing) {
        resetState();
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDrawing, resetState]);

  // Cleanup on unmount - ensure drawing state is reset
  useEffect(() => {
    return () => {
      setIsDrawing(false);
      setStartPoint(null);
      setCurrentMousePos(null);
      setCurrentPoints([]);
    };
  }, []);

  // Update canvas size to match parent
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Get cursor style based on tool
  const getCursor = () => {
    if (!isActive) return 'default';
    switch (drawingTool) {
      case 'eraser':
        return 'crosshair';
      case 'label':
        return 'text';
      default:
        return 'crosshair';
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 ${isActive ? '' : 'pointer-events-none'}`}
      style={{
        zIndex: isActive ? 25 : -1,
        cursor: getCursor(),
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    />
  );
});

// Helper: Distance from point to line segment
function distanceToLineSegment(
  point: DrawingPoint,
  lineStart: DrawingPoint,
  lineEnd: DrawingPoint
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    // Line segment is a point
    const px = point.x - lineStart.x;
    const py = point.y - lineStart.y;
    return Math.sqrt(px * px + py * py);
  }

  // Project point onto line segment
  let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;

  const px = point.x - projX;
  const py = point.y - projY;
  return Math.sqrt(px * px + py * py);
}
