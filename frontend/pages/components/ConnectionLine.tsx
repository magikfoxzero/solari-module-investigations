import { memo, useMemo } from 'react';
import { useInvestigationsStore } from '@/modules/investigations/store';
import type { InvestigationConnection, InvestigationNode } from '@/modules/investigations/types';

interface ConnectionLineProps {
  connection: InvestigationConnection;
  nodes: InvestigationNode[];
}

type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };

// Padding around nodes for path routing
const NODE_PADDING = 35;
// Extra clearance when routing around obstacles
const BYPASS_PADDING = 50;
// Grid cell size for spatial indexing (performance optimization)
const SPATIAL_GRID_SIZE = 200;
// Maximum candidate routes to evaluate (prevents explosion with many obstacles)
const MAX_CANDIDATE_ROUTES = 20;

// ============================================
// Spatial Index for O(1) obstacle lookups
// ============================================
interface SpatialIndex {
  cellSize: number;
  cells: Map<string, Rect[]>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

function createSpatialIndex(obstacles: Rect[]): SpatialIndex {
  const cells = new Map<string, Rect[]>();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const rect of obstacles) {
    // Track bounds
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);

    // Add to grid cells
    const startCellX = Math.floor(rect.x / SPATIAL_GRID_SIZE);
    const endCellX = Math.floor((rect.x + rect.width) / SPATIAL_GRID_SIZE);
    const startCellY = Math.floor(rect.y / SPATIAL_GRID_SIZE);
    const endCellY = Math.floor((rect.y + rect.height) / SPATIAL_GRID_SIZE);

    for (let cx = startCellX; cx <= endCellX; cx++) {
      for (let cy = startCellY; cy <= endCellY; cy++) {
        const key = `${cx},${cy}`;
        const cell = cells.get(key) || [];
        cell.push(rect);
        cells.set(key, cell);
      }
    }
  }

  return {
    cellSize: SPATIAL_GRID_SIZE,
    cells,
    bounds: { minX, minY, maxX, maxY },
  };
}

// Get obstacles that might intersect a line segment using spatial index
function getRelevantObstacles(index: SpatialIndex, p1: Point, p2: Point): Rect[] {
  const seen = new Set<Rect>();
  const result: Rect[] = [];

  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);

  const startCellX = Math.floor(minX / index.cellSize);
  const endCellX = Math.floor(maxX / index.cellSize);
  const startCellY = Math.floor(minY / index.cellSize);
  const endCellY = Math.floor(maxY / index.cellSize);

  for (let cx = startCellX; cx <= endCellX; cx++) {
    for (let cy = startCellY; cy <= endCellY; cy++) {
      const cell = index.cells.get(`${cx},${cy}`);
      if (cell) {
        for (const rect of cell) {
          if (!seen.has(rect)) {
            seen.add(rect);
            result.push(rect);
          }
        }
      }
    }
  }

  return result;
}

// Get node bounds with padding
function getNodeBounds(node: InvestigationNode, padding = NODE_PADDING): Rect {
  return {
    x: Number(node.x) - padding,
    y: Number(node.y) - padding,
    width: (Number(node.width) || 200) + padding * 2,
    height: (Number(node.height) || 80) + padding * 2,
  };
}

// Check if a point is inside a rectangle
function pointInRect(p: Point, rect: Rect): boolean {
  return p.x >= rect.x && p.x <= rect.x + rect.width &&
         p.y >= rect.y && p.y <= rect.y + rect.height;
}

// Line segment intersection check - returns true if segments cross
function segmentsIntersect(
  p1: Point, p2: Point,
  p3: Point, p4: Point
): boolean {
  const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(d) < 0.0001) return false;

  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
  const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / d;

  // Exclude endpoint touches (t and u strictly between 0 and 1)
  return t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99;
}

// Check if a line segment intersects a rectangle
function lineIntersectsRect(p1: Point, p2: Point, rect: Rect): boolean {
  // Check if either endpoint is inside the rect
  if (pointInRect(p1, rect) || pointInRect(p2, rect)) return true;

  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;

  // Check against all 4 edges
  return segmentsIntersect(p1, p2, { x: left, y: top }, { x: right, y: top }) ||
         segmentsIntersect(p1, p2, { x: left, y: bottom }, { x: right, y: bottom }) ||
         segmentsIntersect(p1, p2, { x: left, y: top }, { x: left, y: bottom }) ||
         segmentsIntersect(p1, p2, { x: right, y: top }, { x: right, y: bottom });
}

// Check if a path (array of points) intersects any node - uses spatial index for O(log n) lookups
function pathIntersectsNodesIndexed(path: Point[], spatialIndex: SpatialIndex): number {
  let count = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const relevantRects = getRelevantObstacles(spatialIndex, path[i], path[i + 1]);
    for (const rect of relevantRects) {
      if (lineIntersectsRect(path[i], path[i + 1], rect)) {
        count++;
      }
    }
  }
  return count;
}

// Check if a path passes behind any node - uses spatial index and reduced sampling
function pathBehindNodesIndexed(path: Point[], spatialIndex: SpatialIndex): number {
  let count = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];
    const relevantRects = getRelevantObstacles(spatialIndex, p1, p2);

    for (const rect of relevantRects) {
      // Reduced sampling: check 5 points instead of 10
      for (let t = 0.2; t < 1; t += 0.2) {
        const px = p1.x + (p2.x - p1.x) * t;
        const py = p1.y + (p2.y - p1.y) * t;
        if (pointInRect({ x: px, y: py }, rect)) {
          count++;
          break; // Only count once per segment per node
        }
      }
    }
  }
  return count;
}

// Count self-intersections in a path
function countSelfIntersections(path: Point[]): number {
  let count = 0;
  for (let i = 0; i < path.length - 1; i++) {
    for (let j = i + 2; j < path.length - 1; j++) {
      if (segmentsIntersect(path[i], path[i + 1], path[j], path[j + 1])) {
        count++;
      }
    }
  }
  return count;
}

// Calculate total path length
function pathLength(path: Point[]): number {
  let length = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const dx = path[i + 1].x - path[i].x;
    const dy = path[i + 1].y - path[i].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

// Score a route - lower is better (uses spatial index for performance)
// Priority 1: Don't go behind nodes (weight: 10000)
// Priority 2: Don't go through nodes (weight: 1000)
// Priority 3: Minimize crossings (weight: 100)
// Priority 4: Shortest path (weight: 1)
function scoreRouteIndexed(
  path: Point[],
  spatialIndex: SpatialIndex,
): number {
  const behindCount = pathBehindNodesIndexed(path, spatialIndex);
  const throughCount = pathIntersectsNodesIndexed(path, spatialIndex);
  const selfCrossings = countSelfIntersections(path);
  const length = pathLength(path);

  return (
    behindCount * 10000 +
    throughCount * 1000 +
    selfCrossings * 100 +
    length * 0.01 // Normalize path length to not dominate
  );
}

// Generate all obstacle bounds for routing
function getAllObstacles(
  nodes: InvestigationNode[],
  excludeIds: string[]
): Rect[] {
  return nodes
    .filter(n => !excludeIds.includes(n.record_id))
    .map(n => getNodeBounds(n, NODE_PADDING));
}

// Generate candidate orthogonal routes around obstacles
function generateOrthogonalCandidates(
  from: Point,
  to: Point,
  fromAnchor: string,
  toAnchor: string,
  obstacles: Rect[]
): Point[][] {
  const candidates: Point[][] = [];

  const isHorizontalFrom = ['left', 'right'].includes(fromAnchor);
  const isHorizontalTo = ['left', 'right'].includes(toAnchor);

  // Calculate bounding box of all obstacles plus from/to points
  let minX = Math.min(from.x, to.x);
  let maxX = Math.max(from.x, to.x);
  let minY = Math.min(from.y, to.y);
  let maxY = Math.max(from.y, to.y);

  for (const obs of obstacles) {
    minX = Math.min(minX, obs.x - BYPASS_PADDING);
    maxX = Math.max(maxX, obs.x + obs.width + BYPASS_PADDING);
    minY = Math.min(minY, obs.y - BYPASS_PADDING);
    maxY = Math.max(maxY, obs.y + obs.height + BYPASS_PADDING);
  }

  // Generate key Y-levels and X-levels for routing
  const yLevels = [minY - BYPASS_PADDING, maxY + BYPASS_PADDING];
  const xLevels = [minX - BYPASS_PADDING, maxX + BYPASS_PADDING];

  for (const obs of obstacles) {
    yLevels.push(obs.y - BYPASS_PADDING); // above obstacle
    yLevels.push(obs.y + obs.height + BYPASS_PADDING); // below obstacle
    xLevels.push(obs.x - BYPASS_PADDING); // left of obstacle
    xLevels.push(obs.x + obs.width + BYPASS_PADDING); // right of obstacle
  }

  // Remove duplicates and sort
  const uniqueYLevels = [...new Set(yLevels)].sort((a, b) => a - b);
  const uniqueXLevels = [...new Set(xLevels)].sort((a, b) => a - b);

  // Generate routes based on anchor types
  if (isHorizontalFrom && isHorizontalTo) {
    // Both horizontal anchors: try different mid-X positions and bypass Y levels
    const midXOptions = [
      (from.x + to.x) / 2,
      ...uniqueXLevels.filter(x => x > Math.min(from.x, to.x) && x < Math.max(from.x, to.x))
    ];

    for (const midX of midXOptions) {
      // Direct route
      candidates.push([from, { x: midX, y: from.y }, { x: midX, y: to.y }, to]);

      // Routes going around via different Y levels
      for (const bypassY of uniqueYLevels) {
        if (bypassY !== from.y && bypassY !== to.y) {
          candidates.push([
            from,
            { x: from.x + (from.x < to.x ? BYPASS_PADDING : -BYPASS_PADDING), y: from.y },
            { x: from.x + (from.x < to.x ? BYPASS_PADDING : -BYPASS_PADDING), y: bypassY },
            { x: to.x + (from.x < to.x ? -BYPASS_PADDING : BYPASS_PADDING), y: bypassY },
            { x: to.x + (from.x < to.x ? -BYPASS_PADDING : BYPASS_PADDING), y: to.y },
            to
          ]);
        }
      }
    }
  } else if (!isHorizontalFrom && !isHorizontalTo) {
    // Both vertical anchors: try different mid-Y positions and bypass X levels
    const midYOptions = [
      (from.y + to.y) / 2,
      ...uniqueYLevels.filter(y => y > Math.min(from.y, to.y) && y < Math.max(from.y, to.y))
    ];

    for (const midY of midYOptions) {
      // Direct route
      candidates.push([from, { x: from.x, y: midY }, { x: to.x, y: midY }, to]);

      // Routes going around via different X levels
      for (const bypassX of uniqueXLevels) {
        if (bypassX !== from.x && bypassX !== to.x) {
          candidates.push([
            from,
            { x: from.x, y: from.y + (from.y < to.y ? BYPASS_PADDING : -BYPASS_PADDING) },
            { x: bypassX, y: from.y + (from.y < to.y ? BYPASS_PADDING : -BYPASS_PADDING) },
            { x: bypassX, y: to.y + (from.y < to.y ? -BYPASS_PADDING : BYPASS_PADDING) },
            { x: to.x, y: to.y + (from.y < to.y ? -BYPASS_PADDING : BYPASS_PADDING) },
            to
          ]);
        }
      }
    }
  } else if (isHorizontalFrom) {
    // Horizontal from, vertical to
    // Direct L-shape
    candidates.push([from, { x: to.x, y: from.y }, to]);

    // Alternative L-shape going the other way
    candidates.push([from, { x: from.x, y: to.y }, to]);

    // Routes with bypass
    for (const bypassY of uniqueYLevels) {
      if (bypassY !== from.y && bypassY !== to.y) {
        candidates.push([
          from,
          { x: from.x + (from.x < to.x ? BYPASS_PADDING : -BYPASS_PADDING), y: from.y },
          { x: from.x + (from.x < to.x ? BYPASS_PADDING : -BYPASS_PADDING), y: bypassY },
          { x: to.x, y: bypassY },
          to
        ]);
      }
    }
    for (const bypassX of uniqueXLevels) {
      if (bypassX !== from.x && bypassX !== to.x) {
        candidates.push([
          from,
          { x: bypassX, y: from.y },
          { x: bypassX, y: to.y + (from.y < to.y ? -BYPASS_PADDING : BYPASS_PADDING) },
          { x: to.x, y: to.y + (from.y < to.y ? -BYPASS_PADDING : BYPASS_PADDING) },
          to
        ]);
      }
    }
  } else {
    // Vertical from, horizontal to
    // Direct L-shape
    candidates.push([from, { x: from.x, y: to.y }, to]);

    // Alternative L-shape
    candidates.push([from, { x: to.x, y: from.y }, to]);

    // Routes with bypass
    for (const bypassX of uniqueXLevels) {
      if (bypassX !== from.x && bypassX !== to.x) {
        candidates.push([
          from,
          { x: from.x, y: from.y + (from.y < to.y ? BYPASS_PADDING : -BYPASS_PADDING) },
          { x: bypassX, y: from.y + (from.y < to.y ? BYPASS_PADDING : -BYPASS_PADDING) },
          { x: bypassX, y: to.y },
          to
        ]);
      }
    }
    for (const bypassY of uniqueYLevels) {
      if (bypassY !== from.y && bypassY !== to.y) {
        candidates.push([
          from,
          { x: from.x, y: bypassY },
          { x: to.x + (from.x < to.x ? -BYPASS_PADDING : BYPASS_PADDING), y: bypassY },
          { x: to.x + (from.x < to.x ? -BYPASS_PADDING : BYPASS_PADDING), y: to.y },
          to
        ]);
      }
    }
  }

  // Also add some "wide" bypass routes that go completely around
  const farLeft = minX - BYPASS_PADDING * 2;
  const farRight = maxX + BYPASS_PADDING * 2;
  const farTop = minY - BYPASS_PADDING * 2;
  const farBottom = maxY + BYPASS_PADDING * 2;

  // Route going far left
  candidates.push([from, { x: farLeft, y: from.y }, { x: farLeft, y: to.y }, to]);
  // Route going far right
  candidates.push([from, { x: farRight, y: from.y }, { x: farRight, y: to.y }, to]);
  // Route going far top
  candidates.push([from, { x: from.x, y: farTop }, { x: to.x, y: farTop }, to]);
  // Route going far bottom
  candidates.push([from, { x: from.x, y: farBottom }, { x: to.x, y: farBottom }, to]);

  return candidates;
}

// Find the best route from candidates (uses spatial index, limits evaluation count)
function findBestRouteIndexed(
  candidates: Point[][],
  spatialIndex: SpatialIndex
): Point[] {
  if (candidates.length === 0) return [];

  let bestRoute = candidates[0];
  let bestScore = Infinity;

  // Limit candidates to prevent explosion with many obstacles
  const limitedCandidates = candidates.slice(0, MAX_CANDIDATE_ROUTES);

  for (const route of limitedCandidates) {
    const score = scoreRouteIndexed(route, spatialIndex);
    if (score < bestScore) {
      bestScore = score;
      bestRoute = route;
    }
    // Early exit if we found a perfect route (no intersections)
    if (bestScore === 0) break;
  }

  return bestRoute;
}

// Simplify path by removing redundant collinear points
function simplifyPath(path: Point[]): Point[] {
  if (path.length <= 2) return path;

  const result: Point[] = [path[0]];

  for (let i = 1; i < path.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = path[i];
    const next = path[i + 1];

    // Check if current point is collinear with prev and next
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    // If not collinear (direction changes), keep the point
    const isCollinear = Math.abs(dx1 * dy2 - dy1 * dx2) < 0.1;
    if (!isCollinear) {
      result.push(curr);
    }
  }

  result.push(path[path.length - 1]);
  return result;
}

// Get anchor position on a node
function getAnchorPosition(
  node: InvestigationNode,
  anchor: string
): Point {
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

// Distance to extend from anchor before routing (stub/lead-out)
const ANCHOR_STUB_LENGTH = 15;

// Check if an anchor type exits vertically (top/bottom) or horizontally (left/right)
function isVerticalAnchor(anchorType: string): boolean {
  return ['top', 'top-right', 'top-left', 'bottom', 'bottom-right', 'bottom-left'].includes(anchorType);
}

// Get the lead-out point from an anchor (extends outward from the node)
// Always uses 90-degree angles (horizontal or vertical) for clean orthogonal paths
function getAnchorLeadOut(anchor: Point, anchorType: string): Point {
  switch (anchorType) {
    case 'top':
    case 'top-right':
    case 'top-left':
      return { x: anchor.x, y: anchor.y - ANCHOR_STUB_LENGTH };
    case 'right':
      return { x: anchor.x + ANCHOR_STUB_LENGTH, y: anchor.y };
    case 'bottom':
    case 'bottom-right':
    case 'bottom-left':
      return { x: anchor.x, y: anchor.y + ANCHOR_STUB_LENGTH };
    case 'left':
      return { x: anchor.x - ANCHOR_STUB_LENGTH, y: anchor.y };
    default:
      return anchor;
  }
}

// Remove duplicate consecutive points and collinear points from a path
function cleanupPath(path: Point[]): Point[] {
  if (path.length <= 2) return path;

  // First pass: remove duplicate consecutive points
  const deduplicated: Point[] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const prev = deduplicated[deduplicated.length - 1];
    const curr = path[i];
    // Skip if same position (within tolerance)
    if (Math.abs(curr.x - prev.x) > 0.1 || Math.abs(curr.y - prev.y) > 0.1) {
      deduplicated.push(curr);
    }
  }

  if (deduplicated.length <= 2) return deduplicated;

  // Second pass: remove collinear points
  const result: Point[] = [deduplicated[0]];
  for (let i = 1; i < deduplicated.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = deduplicated[i];
    const next = deduplicated[i + 1];

    // Check if current point is collinear with prev and next
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    // Cross product - if zero, points are collinear
    const cross = Math.abs(dx1 * dy2 - dy1 * dx2);
    if (cross > 0.1) {
      result.push(curr);
    }
  }
  result.push(deduplicated[deduplicated.length - 1]);

  return result;
}

// Build an orthogonal path with stubs and proper 90-degree transitions
function buildOrthogonalPathWithStubs(
  from: Point,
  to: Point,
  fromAnchor: string,
  toAnchor: string,
  waypoints: Point[]
): string {
  const fromStub = getAnchorLeadOut(from, fromAnchor);
  const toStub = getAnchorLeadOut(to, toAnchor);
  const fromVertical = isVerticalAnchor(fromAnchor);
  const toVertical = isVerticalAnchor(toAnchor);

  const pathPoints: Point[] = [from, fromStub];

  // Get the first waypoint after 'from' (if any middle waypoints exist)
  const middleWaypoints = waypoints.slice(1, -1);

  if (middleWaypoints.length > 0) {
    const firstWaypoint = middleWaypoints[0];
    const lastWaypoint = middleWaypoints[middleWaypoints.length - 1];

    // Add transition point after fromStub to ensure 90-degree turn
    // If stub is vertical, we need to turn horizontal first (match waypoint's X)
    // If stub is horizontal, we need to turn vertical first (match waypoint's Y)
    if (fromVertical) {
      // Stub goes up/down, so next segment should be horizontal
      if (Math.abs(firstWaypoint.x - fromStub.x) > 0.1) {
        pathPoints.push({ x: firstWaypoint.x, y: fromStub.y });
      }
    } else {
      // Stub goes left/right, so next segment should be vertical
      if (Math.abs(firstWaypoint.y - fromStub.y) > 0.1) {
        pathPoints.push({ x: fromStub.x, y: firstWaypoint.y });
      }
    }

    // Add all middle waypoints
    pathPoints.push(...middleWaypoints);

    // Add transition point before toStub to ensure 90-degree turn
    if (toVertical) {
      // toStub goes up/down, so previous segment should be horizontal
      if (Math.abs(lastWaypoint.x - toStub.x) > 0.1) {
        pathPoints.push({ x: lastWaypoint.x, y: toStub.y });
      }
    } else {
      // toStub goes left/right, so previous segment should be vertical
      if (Math.abs(lastWaypoint.y - toStub.y) > 0.1) {
        pathPoints.push({ x: toStub.x, y: lastWaypoint.y });
      }
    }
  } else {
    // No middle waypoints - direct connection between stubs
    // Need to add intermediate points for 90-degree path
    if (fromVertical && toVertical) {
      // Both vertical: add horizontal segment in the middle
      const midY = (fromStub.y + toStub.y) / 2;
      pathPoints.push({ x: fromStub.x, y: midY });
      pathPoints.push({ x: toStub.x, y: midY });
    } else if (!fromVertical && !toVertical) {
      // Both horizontal: add vertical segment in the middle
      const midX = (fromStub.x + toStub.x) / 2;
      pathPoints.push({ x: midX, y: fromStub.y });
      pathPoints.push({ x: midX, y: toStub.y });
    } else if (fromVertical) {
      // From vertical, to horizontal: L-shape
      pathPoints.push({ x: toStub.x, y: fromStub.y });
    } else {
      // From horizontal, to vertical: L-shape
      pathPoints.push({ x: fromStub.x, y: toStub.y });
    }
  }

  pathPoints.push(toStub, to);

  // Clean up redundant points
  const cleanedPath = cleanupPath(pathPoints);

  // Build the path string
  return cleanedPath.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

// Calculate path with priority-based obstacle avoidance (optimized with spatial indexing)
// Priority 1: Don't go behind nodes
// Priority 2: Don't go through nodes
// Priority 3: Minimize line crossings (including self)
// Priority 4: Shortest path
function calculatePathWithObstacleAvoidance(
  from: Point,
  to: Point,
  fromAnchor: string,
  toAnchor: string,
  pathType: string,
  nodes: InvestigationNode[],
  excludeIds: string[]
): string {
  // Get all obstacle bounds (excluding source and target nodes)
  const obstacles = getAllObstacles(nodes, excludeIds);

  // Early exit for no obstacles - just draw direct path
  if (obstacles.length === 0) {
    if (pathType === 'curved') {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const offset = Math.min(dist * 0.5, 100);
      const getOffset = (anchor: string, isFrom: boolean) => {
        const sign = isFrom ? 1 : -1;
        switch (anchor) {
          case 'top': return { x: 0, y: -offset * sign };
          case 'bottom': return { x: 0, y: offset * sign };
          case 'left': return { x: -offset * sign, y: 0 };
          case 'right': return { x: offset * sign, y: 0 };
          default: return { x: offset * sign, y: 0 };
        }
      };
      const cp1Offset = getOffset(fromAnchor, true);
      const cp2Offset = getOffset(toAnchor, false);
      const cp1 = { x: from.x + cp1Offset.x, y: from.y + cp1Offset.y };
      const cp2 = { x: to.x + cp2Offset.x, y: to.y + cp2Offset.y };
      return `M ${from.x} ${from.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${to.x} ${to.y}`;
    }
    return buildOrthogonalPathWithStubs(from, to, fromAnchor, toAnchor, [from, to]);
  }

  // Create spatial index for efficient lookups
  const spatialIndex = createSpatialIndex(obstacles);

  if (pathType === 'straight') {
    // For straight paths, check if direct line is clear using spatial index
    const relevantObs = getRelevantObstacles(spatialIndex, from, to);
    let pathClear = true;
    for (const obs of relevantObs) {
      if (lineIntersectsRect(from, to, obs)) {
        pathClear = false;
        break;
      }
    }

    if (pathClear) {
      // Direct path - use orthogonal stubs for clean 90-degree angles
      return buildOrthogonalPathWithStubs(from, to, fromAnchor, toAnchor, [from, to]);
    }

    // Generate candidate routes using only nearby obstacles (limit explosion)
    const candidates: Point[][] = [];
    candidates.push([from, to]);

    // Only generate routes for nearby obstacles
    const nearbyObs = relevantObs.slice(0, 5); // Limit to 5 nearest obstacles
    for (const obs of nearbyObs) {
      const obsLeft = obs.x - BYPASS_PADDING;
      const obsRight = obs.x + obs.width + BYPASS_PADDING;
      const obsTop = obs.y - BYPASS_PADDING;
      const obsBottom = obs.y + obs.height + BYPASS_PADDING;

      candidates.push([from, { x: from.x, y: obsTop }, { x: to.x, y: obsTop }, to]);
      candidates.push([from, { x: from.x, y: obsBottom }, { x: to.x, y: obsBottom }, to]);
      candidates.push([from, { x: obsLeft, y: from.y }, { x: obsLeft, y: to.y }, to]);
      candidates.push([from, { x: obsRight, y: from.y }, { x: obsRight, y: to.y }, to]);
    }

    const bestRoute = findBestRouteIndexed(candidates, spatialIndex);
    const simplified = simplifyPath(bestRoute);

    return buildOrthogonalPathWithStubs(from, to, fromAnchor, toAnchor, simplified);
  }

  if (pathType === 'orthogonal') {
    // Generate candidate routes (already limited by MAX_CANDIDATE_ROUTES in findBestRouteIndexed)
    const candidates = generateOrthogonalCandidates(from, to, fromAnchor, toAnchor, obstacles);

    const bestRoute = findBestRouteIndexed(candidates, spatialIndex);
    const simplified = simplifyPath(bestRoute);

    return buildOrthogonalPathWithStubs(from, to, fromAnchor, toAnchor, simplified);
  }

  // Default: curved bezier path with obstacle avoidance
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  let offset = Math.min(dist * 0.5, 100);

  // Check if any obstacles are in the way using spatial index
  let hasObstacleInWay = false;
  let obstacleInWay: Rect | null = null;
  const relevantObs = getRelevantObstacles(spatialIndex, from, to);

  for (const obs of relevantObs) {
    if (lineIntersectsRect(from, to, obs)) {
      hasObstacleInWay = true;
      obstacleInWay = obs;
      break;
    }
  }

  if (hasObstacleInWay && obstacleInWay) {
    offset = Math.min(dist * 0.7, 150);
  }

  // Calculate control points based on anchor directions
  const getOffset = (anchor: string, isFrom: boolean) => {
    const sign = isFrom ? 1 : -1;
    switch (anchor) {
      case 'top':
        return { x: 0, y: -offset * sign };
      case 'bottom':
        return { x: 0, y: offset * sign };
      case 'left':
        return { x: -offset * sign, y: 0 };
      case 'right':
        return { x: offset * sign, y: 0 };
      case 'top-left':
        return { x: -offset * sign * 0.7, y: -offset * sign * 0.7 };
      case 'top-right':
        return { x: offset * sign * 0.7, y: -offset * sign * 0.7 };
      case 'bottom-left':
        return { x: -offset * sign * 0.7, y: offset * sign * 0.7 };
      case 'bottom-right':
        return { x: offset * sign * 0.7, y: offset * sign * 0.7 };
      default:
        return { x: offset * sign, y: 0 };
    }
  };

  let cp1Offset = getOffset(fromAnchor, true);
  let cp2Offset = getOffset(toAnchor, false);

  // If there's an obstacle in the way, adjust control points to curve around it
  if (hasObstacleInWay && obstacleInWay) {
    const obstacleCenter = {
      x: obstacleInWay.x + obstacleInWay.width / 2,
      y: obstacleInWay.y + obstacleInWay.height / 2,
    };

    // Determine which direction to curve around
    const midY = (from.y + to.y) / 2;
    const midX = (from.x + to.x) / 2;

    // Choose direction that takes us further from obstacle center
    const goAbove = midY > obstacleCenter.y;
    const goLeft = midX > obstacleCenter.x;

    // Adjust control points to curve around the obstacle
    const curveAmountY = obstacleInWay.height / 2 + BYPASS_PADDING;
    const curveAmountX = obstacleInWay.width / 2 + BYPASS_PADDING;

    if (Math.abs(dy) > Math.abs(dx)) {
      // More vertical movement - curve horizontally
      const curveDirection = goLeft ? -1 : 1;
      cp1Offset = { x: cp1Offset.x + curveDirection * curveAmountX, y: cp1Offset.y };
      cp2Offset = { x: cp2Offset.x + curveDirection * curveAmountX, y: cp2Offset.y };
    } else {
      // More horizontal movement - curve vertically
      const curveDirection = goAbove ? -1 : 1;
      cp1Offset = { x: cp1Offset.x, y: cp1Offset.y + curveDirection * curveAmountY };
      cp2Offset = { x: cp2Offset.x, y: cp2Offset.y + curveDirection * curveAmountY };
    }
  }

  const cp1 = { x: from.x + cp1Offset.x, y: from.y + cp1Offset.y };
  const cp2 = { x: to.x + cp2Offset.x, y: to.y + cp2Offset.y };

  return `M ${from.x} ${from.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${to.x} ${to.y}`;
}

// Get dash array for line style
function getDashArray(style: string): string | undefined {
  switch (style) {
    case 'dashed':
      return '8,4';
    case 'dotted':
      return '2,4';
    default:
      return undefined;
  }
}

// Create a stable cache key for obstacle nodes - only update when positions change significantly
function getObstaclesCacheKey(nodes: InvestigationNode[], excludeIds: string[]): string {
  return nodes
    .filter(n => !excludeIds.includes(n.record_id))
    .map(n => `${n.record_id}:${Math.round(n.x)}:${Math.round(n.y)}:${n.width}:${n.height}`)
    .sort()
    .join('|');
}

export const ConnectionLine = memo(function ConnectionLine({
  connection,
  nodes,
}: ConnectionLineProps) {
  const { selectedConnectionId, selectConnection } = useInvestigationsStore();
  const isSelected = selectedConnectionId === connection.record_id;

  // Find the source and target nodes
  const fromNode = nodes.find((n) => n.record_id === connection.from_node_id);
  const toNode = nodes.find((n) => n.record_id === connection.to_node_id);

  // Stable exclude IDs for source/target nodes
  const excludeIds = useMemo(
    () => fromNode && toNode ? [fromNode.record_id, toNode.record_id] : [],
    [fromNode?.record_id, toNode?.record_id]
  );

  // Create stable cache key for obstacles (excluding source/target)
  const obstaclesCacheKey = useMemo(
    () => getObstaclesCacheKey(nodes, excludeIds),
    [nodes, excludeIds]
  );

  // Create stable position keys for source/target nodes
  const fromNodeKey = fromNode
    ? `${Math.round(fromNode.x)}:${Math.round(fromNode.y)}:${fromNode.width}:${fromNode.height}`
    : '';
  const toNodeKey = toNode
    ? `${Math.round(toNode.x)}:${Math.round(toNode.y)}:${toNode.width}:${toNode.height}`
    : '';

  // Calculate path with obstacle avoidance - memoized by position keys, not object refs
  const pathData = useMemo(() => {
    if (!fromNode || !toNode) return null;

    const fromAnchor = connection.from_side || 'right';
    const toAnchor = connection.to_side || 'left';
    const pathType = connection.path_type || 'curved';

    const from = getAnchorPosition(fromNode, fromAnchor);
    const to = getAnchorPosition(toNode, toAnchor);

    return {
      path: calculatePathWithObstacleAvoidance(from, to, fromAnchor, toAnchor, pathType, nodes, excludeIds),
      midpoint: {
        x: (from.x + to.x) / 2,
        y: (from.y + to.y) / 2,
      },
    };
    // Use stable keys instead of object references for better memoization
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromNodeKey, toNodeKey, connection.from_side, connection.to_side, connection.path_type, obstaclesCacheKey]);

  if (!pathData) return null;

  const color = connection.color || '#6b7280';
  const thickness = connection.thickness || 2;
  const style = connection.style || 'solid';
  const arrowType = connection.arrow_type || 'forward';
  // Sanitize label to prevent XSS - strip HTML and limit length
  const rawLabel = connection.relationship_label || '';
  const label = String(rawLabel).replace(/<[^>]*>/g, '').slice(0, 100);

  // Generate unique marker IDs for this connection
  const markerId = `arrow-${connection.record_id}`;

  return (
    <g
      data-connection={connection.record_id}
      className="cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        selectConnection(connection.record_id);
      }}
    >
      {/* Arrow marker definitions */}
      <defs>
        {(arrowType === 'forward' || arrowType === 'both') && (
          <marker
            id={`${markerId}-end`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth={6}
            markerHeight={6}
            orient="auto-start-reverse"
          >
            <path
              d="M 0 0 L 10 5 L 0 10 z"
              fill={color}
            />
          </marker>
        )}
        {(arrowType === 'backward' || arrowType === 'both') && (
          <marker
            id={`${markerId}-start`}
            viewBox="0 0 10 10"
            refX="1"
            refY="5"
            markerWidth={6}
            markerHeight={6}
            orient="auto"
          >
            <path
              d="M 10 0 L 0 5 L 10 10 z"
              fill={color}
            />
          </marker>
        )}
      </defs>

      {/* Invisible wider path for easier clicking */}
      <path
        d={pathData.path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="pointer-events-stroke"
      />

      {/* Selection highlight */}
      {isSelected && (
        <path
          d={pathData.path}
          fill="none"
          stroke="#6366f1"
          strokeWidth={thickness + 4}
          strokeDasharray={getDashArray(style)}
          strokeLinecap="round"
          strokeOpacity={0.5}
          className="pointer-events-none"
        />
      )}

      {/* Main connection path */}
      <path
        d={pathData.path}
        fill="none"
        stroke={color}
        strokeWidth={thickness}
        strokeDasharray={getDashArray(style)}
        strokeLinecap="round"
        markerEnd={(arrowType === 'forward' || arrowType === 'both') ? `url(#${markerId}-end)` : undefined}
        markerStart={(arrowType === 'backward' || arrowType === 'both') ? `url(#${markerId}-start)` : undefined}
        className="pointer-events-none"
      />

      {/* Relationship label */}
      {label && (
        <g className="pointer-events-none">
          {/* Label background */}
          <rect
            x={pathData.midpoint.x - label.length * 4}
            y={pathData.midpoint.y - 10}
            width={label.length * 8}
            height={20}
            rx={4}
            className="fill-space-800"
            opacity={0.9}
          />
          {/* Label text */}
          <text
            x={pathData.midpoint.x}
            y={pathData.midpoint.y + 4}
            textAnchor="middle"
            className="fill-space-200 text-xs"
            fontSize={11}
          >
            {label}
          </text>
        </g>
      )}

      {/* Weight indicator (if weight != default) */}
      {connection.weight && connection.weight !== 5 && !label && (
        <circle
          cx={pathData.midpoint.x}
          cy={pathData.midpoint.y}
          r={8}
          className="fill-space-700 stroke-space-500"
          strokeWidth={1}
        />
      )}
    </g>
  );
});
