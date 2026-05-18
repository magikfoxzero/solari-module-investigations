import { create } from 'zustand';
import { toast } from '@/store/toastStore';
import type {
  Investigation,
  InvestigationCreateInput,
  InvestigationUpdateInput,
  InvestigationNode,
  InvestigationNodeCreateInput,
  InvestigationNodeUpdateInput,
  NodePositionUpdate,
  BulkNodeInput,
  InvestigationConnection,
  InvestigationConnectionCreateInput,
  InvestigationConnectionUpdateInput,
  InvestigationDrawing,
  InvestigationDrawingCreateInput,
  InvestigationDrawingUpdateInput,
  BatchDrawingInput,
  CanvasState,
  CanvasTool,
  DrawingTool,
  InvestigationLayout,
  OnlineUser,
  CursorPosition,
  TimelineData,
  InvestigationStatistics,
} from './types';
import * as investigationsApi from './api';

// Generate random color for presence
const generateUserColor = (): string => {
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

interface InvestigationsState {
  // List View State
  investigations: Investigation[];
  listLoading: boolean;
  pagination: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
  };
  statistics: InvestigationStatistics | null;

  // Current Investigation (Canvas View)
  currentInvestigation: Investigation | null;
  nodes: InvestigationNode[];
  connections: InvestigationConnection[];
  drawings: InvestigationDrawing[];
  graphLoading: boolean;

  // Selection State
  selectedNodeIds: Set<string>;
  selectedConnectionId: string | null;
  selectedDrawingIds: Set<string>;

  // Canvas State
  viewport: { x: number; y: number };
  zoom: number;
  isPanning: boolean;

  // Tool State
  currentTool: CanvasTool;
  drawingTool: DrawingTool;
  drawColor: string;
  drawSize: number;

  // Connection Creation State
  connectFrom: { nodeId: string; anchor: string } | null;

  // Connection Defaults
  connectionStyle: 'solid' | 'dashed' | 'dotted';
  connectionColor: string;
  connectionThickness: number;
  connectionArrowType: 'none' | 'forward' | 'backward' | 'both';
  connectionPathType: 'curved' | 'straight' | 'orthogonal';

  // Presence State
  onlineUsers: OnlineUser[];
  cursors: Map<string, CursorPosition>;

  // Timeline State
  timelineData: TimelineData | null;
  timelineLoading: boolean;

  // UI State
  error: string | null;
  isSaving: boolean;

  // ============================================
  // List View Actions
  // ============================================
  loadInvestigations: (params?: { page?: number; per_page?: number; status?: string; folder_id?: string }) => Promise<void>;
  searchInvestigations: (query: string, page?: number, folderId?: string) => Promise<void>;
  loadStatistics: () => Promise<void>;
  createInvestigation: (data: InvestigationCreateInput) => Promise<Investigation | null>;
  updateInvestigation: (id: string, data: InvestigationUpdateInput) => Promise<Investigation | null>;
  deleteInvestigation: (id: string) => Promise<boolean>;

  // ============================================
  // Canvas View Actions
  // ============================================
  loadInvestigation: (id: string) => Promise<void>;
  loadGraph: (id: string) => Promise<void>;
  loadTimeline: (id: string, params?: { group_by?: 'day' | 'week' | 'month' | 'year' }) => Promise<void>;
  refreshGraphData: () => Promise<void>;
  clearCurrentInvestigation: () => void;

  // Canvas State Actions
  setViewport: (viewport: { x: number; y: number }) => void;
  setZoom: (zoom: number) => void;
  setIsPanning: (isPanning: boolean) => void;
  fitToContent: () => void;
  saveCanvasState: () => Promise<void>;
  applyLayout: (layoutType: InvestigationLayout) => Promise<void>;

  // Tool Actions
  setTool: (tool: CanvasTool) => void;
  setDrawingTool: (tool: DrawingTool) => void;
  setDrawColor: (color: string) => void;
  setDrawSize: (size: number) => void;
  setConnectionDefaults: (defaults: Partial<{
    style: 'solid' | 'dashed' | 'dotted';
    color: string;
    thickness: number;
    arrowType: 'none' | 'forward' | 'backward' | 'both';
    pathType: 'curved' | 'straight' | 'orthogonal';
  }>) => void;

  // Selection Actions
  selectNode: (nodeId: string, multiSelect?: boolean) => void;
  selectConnection: (connectionId: string) => void;
  selectDrawing: (drawingId: string, multiSelect?: boolean) => void;
  selectByMarquee: (bounds: { x1: number; y1: number; x2: number; y2: number }) => void;
  clearSelection: () => void;
  deleteSelected: () => Promise<void>;

  // Node Actions
  addNode: (data: InvestigationNodeCreateInput) => Promise<InvestigationNode | null>;
  updateNode: (nodeId: string, data: InvestigationNodeUpdateInput) => Promise<void>;
  updateNodePosition: (nodeId: string, x: number, y: number, zIndex?: number) => void;
  saveNodePositions: () => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;
  bulkAddNodes: (nodes: BulkNodeInput[]) => Promise<{ added: number; skipped: number }>;

  // Connection Actions
  startConnection: (nodeId: string, anchor: string) => void;
  cancelConnection: () => void;
  createConnection: (data: InvestigationConnectionCreateInput) => Promise<InvestigationConnection | null>;
  updateConnection: (connectionId: string, data: InvestigationConnectionUpdateInput) => Promise<void>;
  deleteConnection: (connectionId: string) => Promise<void>;

  // Drawing Actions
  addDrawing: (data: InvestigationDrawingCreateInput) => Promise<InvestigationDrawing | null>;
  updateDrawing: (drawingId: string, data: InvestigationDrawingUpdateInput) => Promise<void>;
  deleteDrawing: (drawingId: string) => Promise<void>;
  batchSaveDrawings: (drawings: BatchDrawingInput[]) => Promise<void>;

  // ============================================
  // WebSocket Event Handlers
  // ============================================
  handleNodeAdded: (node: InvestigationNode, userId: string) => void;
  handleNodeMoved: (nodeId: string, x: number, y: number, zIndex: number | null, userId: string) => void;
  handleNodeUpdated: (node: InvestigationNode, userId: string) => void;
  handleNodeRemoved: (nodeId: string, userId: string) => void;
  handleConnectionAdded: (connection: InvestigationConnection, userId: string) => void;
  handleConnectionUpdated: (connection: InvestigationConnection, userId: string) => void;
  handleConnectionRemoved: (connectionId: string, userId: string) => void;
  handleDrawingAdded: (drawing: InvestigationDrawing, userId: string) => void;
  handleDrawingUpdated: (drawing: InvestigationDrawing, userId: string) => void;
  handleDrawingRemoved: (drawingId: string, userId: string) => void;
  handleUserJoined: (user: { userId: string; username: string }) => void;
  handleUserLeft: (userId: string) => void;
  handleCursorMoved: (userId: string, position: CursorPosition) => void;
  handleCanvasStateUpdated: (canvasState: CanvasState, userId: string) => void;

  // Utility
  clearError: () => void;
}

// Track pending position updates for debounced save (using Map for O(1) lookups and immutable updates)
let pendingPositionUpdates: Map<string, NodePositionUpdate> = new Map();
let positionSaveTimeout: ReturnType<typeof setTimeout> | null = null;
// Mutex for connection creation to prevent race conditions
let isCreatingConnection = false;

export const useInvestigationsStore = create<InvestigationsState>((set, get) => ({
  // Initial List State
  investigations: [],
  listLoading: false,
  pagination: { total: 0, per_page: 20, current_page: 1, last_page: 1 },
  statistics: null,

  // Initial Canvas State
  currentInvestigation: null,
  nodes: [],
  connections: [],
  drawings: [],
  graphLoading: false,

  // Initial Selection State
  selectedNodeIds: new Set(),
  selectedConnectionId: null,
  selectedDrawingIds: new Set(),

  // Initial Viewport State
  viewport: { x: 0, y: 0 },
  zoom: 1,
  isPanning: false,

  // Initial Tool State
  currentTool: 'select',
  drawingTool: 'pencil',
  drawColor: '#000000',
  drawSize: 2,

  // Initial Connection State
  connectFrom: null,
  connectionStyle: 'solid',
  connectionColor: '#6b7280',
  connectionThickness: 2,
  connectionArrowType: 'forward',
  connectionPathType: 'curved',

  // Initial Presence State
  onlineUsers: [],
  cursors: new Map(),

  // Initial Timeline State
  timelineData: null,
  timelineLoading: false,

  // Initial UI State
  error: null,
  isSaving: false,

  // ============================================
  // List View Actions
  // ============================================

  loadInvestigations: async (params) => {
    set({ listLoading: true, error: null });
    try {
      const result = await investigationsApi.listInvestigations(params);
      set({
        investigations: result.investigations,
        pagination: result.pagination,
        listLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load investigations';
      set({ listLoading: false, error: message });
    }
  },

  searchInvestigations: async (query, page = 1, folderId) => {
    set({ listLoading: true, error: null });
    try {
      const result = await investigationsApi.searchInvestigations({
        q: query,
        page,
        ...(folderId && { folder_id: folderId }),
      });
      set({
        investigations: result.investigations,
        pagination: result.pagination,
        listLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to search investigations';
      set({ listLoading: false, error: message });
    }
  },

  loadStatistics: async () => {
    try {
      const statistics = await investigationsApi.getInvestigationStats();
      set({ statistics });
    } catch {
      console.error('Failed to load statistics');
    }
  },

  createInvestigation: async (data) => {
    set({ isSaving: true, error: null });
    try {
      const investigation = await investigationsApi.createInvestigation(data);
      set((state) => ({
        investigations: [investigation, ...state.investigations],
        isSaving: false,
      }));
      return investigation;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create investigation';
      set({ isSaving: false, error: message });
      return null;
    }
  },

  updateInvestigation: async (id, data) => {
    set({ isSaving: true, error: null });
    try {
      const investigation = await investigationsApi.updateInvestigation(id, data);
      set((state) => ({
        investigations: state.investigations.map((i) =>
          i.record_id === id ? investigation : i
        ),
        currentInvestigation:
          state.currentInvestigation?.record_id === id
            ? investigation
            : state.currentInvestigation,
        isSaving: false,
      }));
      return investigation;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update investigation';
      set({ isSaving: false, error: message });
      return null;
    }
  },

  deleteInvestigation: async (id) => {
    set({ error: null });
    try {
      await investigationsApi.deleteInvestigation(id);
      set((state) => ({
        investigations: state.investigations.filter((i) => i.record_id !== id),
        currentInvestigation:
          state.currentInvestigation?.record_id === id ? null : state.currentInvestigation,
      }));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete investigation';
      set({ error: message });
      return false;
    }
  },

  // ============================================
  // Canvas View Actions
  // ============================================

  loadInvestigation: async (id) => {
    // Clear selection state when switching investigations
    set({
      graphLoading: true,
      error: null,
      selectedNodeIds: new Set(),
      selectedConnectionId: null,
      selectedDrawingIds: new Set(),
      connectFrom: null,
    });
    try {
      const investigation = await investigationsApi.getInvestigation(id);
      const canvasState = investigation.canvas_state || {};

      // visible_nodes comes as [{ node: {...}, can_access, display_mode }, ...]
      // We need to unwrap the node property and merge access info
      let nodes = investigation.nodes || [];
      if (investigation.visible_nodes && Array.isArray(investigation.visible_nodes)) {
        nodes = investigation.visible_nodes.map((item: { node?: InvestigationNode; can_access?: boolean; display_mode?: string } | InvestigationNode) => {
          // Handle wrapped format: { node, can_access, display_mode }
          if (item && typeof item === 'object' && 'node' in item && item.node) {
            return {
              ...item.node,
              can_access: item.can_access ?? true,
              display_mode: item.display_mode ?? 'full',
            };
          }
          // Handle flat format: { record_id, entity_type, ... }
          return item as InvestigationNode;
        });
      }

      set({
        currentInvestigation: investigation,
        nodes,
        connections: investigation.connections || [],
        drawings: investigation.drawings || [],
        viewport: { x: canvasState.panX || 0, y: canvasState.panY || 0 },
        zoom: canvasState.zoom || 1,
        graphLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load investigation';
      set({ graphLoading: false, error: message });
    }
  },

  loadGraph: async (id) => {
    // Clear selection state when loading a new graph
    set({
      graphLoading: true,
      error: null,
      selectedNodeIds: new Set(),
      selectedConnectionId: null,
      selectedDrawingIds: new Set(),
    });
    try {
      const graph = await investigationsApi.getGraph(id);
      set({
        nodes: graph.nodes,
        connections: graph.connections,
        drawings: graph.drawings,
        graphLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load graph';
      set({ graphLoading: false, error: message });
    }
  },

  loadTimeline: async (id, params) => {
    set({ timelineLoading: true });
    try {
      const timelineData = await investigationsApi.getTimeline(id, params);
      set({ timelineData, timelineLoading: false });
    } catch {
      console.error('Failed to load timeline');
      set({ timelineLoading: false });
    }
  },

  refreshGraphData: async () => {
    const { currentInvestigation } = get();
    if (!currentInvestigation) return;

    // Silently refresh graph data without showing loading state to avoid UI flash
    try {
      const graph = await investigationsApi.getGraph(currentInvestigation.record_id);
      set({
        nodes: graph.nodes,
        connections: graph.connections,
        drawings: graph.drawings,
      });
    } catch (err) {
      console.error('Failed to refresh graph data');
      throw err; // Re-throw to let caller handle
    }
  },

  clearCurrentInvestigation: () => {
    // Clear any pending position save timeout to prevent memory leaks
    if (positionSaveTimeout) {
      clearTimeout(positionSaveTimeout);
      positionSaveTimeout = null;
    }
    pendingPositionUpdates = new Map();

    set({
      currentInvestigation: null,
      nodes: [],
      connections: [],
      drawings: [],
      selectedNodeIds: new Set(),
      selectedConnectionId: null,
      selectedDrawingIds: new Set(),
      onlineUsers: [],
      cursors: new Map(),
      timelineData: null,
    });
  },

  // Canvas State Actions
  setViewport: (viewport) => set({ viewport }),
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(4, zoom)) }),
  setIsPanning: (isPanning) => set({ isPanning }),

  fitToContent: () => {
    const { nodes, drawings } = get();
    if (nodes.length === 0 && drawings.length === 0) return;

    // Calculate bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    nodes.forEach((node) => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    });

    drawings.forEach((drawing) => {
      if (drawing.bounds) {
        minX = Math.min(minX, drawing.bounds.left);
        minY = Math.min(minY, drawing.bounds.top);
        maxX = Math.max(maxX, drawing.bounds.right);
        maxY = Math.max(maxY, drawing.bounds.bottom);
      }
    });

    if (!isFinite(minX)) return;

    // Add padding
    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    // Calculate zoom to fit (assuming 800x600 viewport for now)
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    // Guard against division by zero
    const zoom = Math.min(
      1,
      contentWidth > 0 ? 800 / contentWidth : 1,
      contentHeight > 0 ? 600 / contentHeight : 1
    );

    set({
      viewport: { x: -minX * zoom + padding, y: -minY * zoom + padding },
      zoom,
    });
  },

  saveCanvasState: async () => {
    const { currentInvestigation, viewport, zoom } = get();
    if (!currentInvestigation) return;

    try {
      await investigationsApi.updateCanvasState(currentInvestigation.record_id, {
        zoom,
        panX: viewport.x,
        panY: viewport.y,
      });
    } catch {
      console.error('Failed to save canvas state');
    }
  },

  applyLayout: async (layoutType) => {
    const { currentInvestigation } = get();
    if (!currentInvestigation) return;

    set({ isSaving: true });
    try {
      const result = await investigationsApi.applyLayout(currentInvestigation.record_id, layoutType);
      // Validate response before applying positions
      if (!result || !result.positions) {
        throw new Error('Invalid layout response from server');
      }
      // Apply positions to local nodes
      set((state) => ({
        nodes: state.nodes.map((node) => {
          const newPos = result.positions[node.record_id];
          return newPos ? { ...node, x: newPos.x, y: newPos.y } : node;
        }),
        isSaving: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to apply layout';
      set({ isSaving: false, error: message });
    }
  },

  // Tool Actions
  setTool: (tool) => {
    set({ currentTool: tool, connectFrom: null });
  },

  setDrawingTool: (tool) => set({ drawingTool: tool }),
  setDrawColor: (color) => {
    // Validate color is a valid hex color or named color
    const validHexColor = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    const validRgbColor = /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/;
    if (validHexColor.test(color) || validRgbColor.test(color)) {
      set({ drawColor: color });
    } else {
      // Invalid color format, silently use default
      set({ drawColor: '#000000' });
    }
  },
  setDrawSize: (size) => {
    // Validate size is within reasonable bounds (1-50)
    const clampedSize = Math.max(1, Math.min(50, Number.isFinite(size) ? size : 2));
    set({ drawSize: clampedSize });
  },

  setConnectionDefaults: (defaults) => {
    set((state) => ({
      connectionStyle: defaults.style ?? state.connectionStyle,
      connectionColor: defaults.color ?? state.connectionColor,
      connectionThickness: defaults.thickness ?? state.connectionThickness,
      connectionArrowType: defaults.arrowType ?? state.connectionArrowType,
      connectionPathType: defaults.pathType ?? state.connectionPathType,
    }));
  },

  // Selection Actions
  selectNode: (nodeId, multiSelect = false) => {
    set((state) => {
      const newSelection = new Set(multiSelect ? state.selectedNodeIds : []);
      if (newSelection.has(nodeId)) {
        newSelection.delete(nodeId);
      } else {
        newSelection.add(nodeId);
      }
      return {
        selectedNodeIds: newSelection,
        selectedConnectionId: null,
        selectedDrawingIds: new Set(),
      };
    });
  },

  selectConnection: (connectionId) => {
    set({
      selectedNodeIds: new Set(),
      selectedConnectionId: connectionId,
      selectedDrawingIds: new Set(),
    });
  },

  selectDrawing: (drawingId, multiSelect = false) => {
    set((state) => {
      const newSelection = new Set(multiSelect ? state.selectedDrawingIds : []);
      if (newSelection.has(drawingId)) {
        newSelection.delete(drawingId);
      } else {
        newSelection.add(drawingId);
      }
      return {
        selectedNodeIds: new Set(),
        selectedConnectionId: null,
        selectedDrawingIds: newSelection,
      };
    });
  },

  selectByMarquee: (bounds) => {
    const { nodes, drawings } = get();
    const selectedNodes = new Set<string>();
    const selectedDrawings = new Set<string>();

    const minX = Math.min(bounds.x1, bounds.x2);
    const maxX = Math.max(bounds.x1, bounds.x2);
    const minY = Math.min(bounds.y1, bounds.y2);
    const maxY = Math.max(bounds.y1, bounds.y2);

    // Select nodes that intersect with marquee
    nodes.forEach((node) => {
      const nodeRight = node.x + node.width;
      const nodeBottom = node.y + node.height;

      if (node.x < maxX && nodeRight > minX && node.y < maxY && nodeBottom > minY) {
        selectedNodes.add(node.record_id);
      }
    });

    // Select drawings whose bounding box intersects with marquee
    drawings.forEach((drawing) => {
      const points = drawing.points;
      if (!points || points.length === 0) return;

      // Calculate drawing's bounding box from its points
      let drawingMinX = Infinity, drawingMinY = Infinity;
      let drawingMaxX = -Infinity, drawingMaxY = -Infinity;

      points.forEach((p) => {
        drawingMinX = Math.min(drawingMinX, p.x);
        drawingMinY = Math.min(drawingMinY, p.y);
        drawingMaxX = Math.max(drawingMaxX, p.x);
        drawingMaxY = Math.max(drawingMaxY, p.y);
      });

      // Check if bounding boxes intersect (same logic as nodes)
      if (drawingMinX < maxX && drawingMaxX > minX &&
          drawingMinY < maxY && drawingMaxY > minY) {
        selectedDrawings.add(drawing.record_id);
      }
    });

    set({
      selectedNodeIds: selectedNodes,
      selectedDrawingIds: selectedDrawings,
      selectedConnectionId: null,
    });
  },

  clearSelection: () => {
    set({
      selectedNodeIds: new Set(),
      selectedConnectionId: null,
      selectedDrawingIds: new Set(),
    });
  },

  deleteSelected: async () => {
    const { selectedNodeIds, selectedConnectionId, selectedDrawingIds, currentInvestigation } = get();
    if (!currentInvestigation) return;

    // Clear selection immediately for responsive UI
    set({
      selectedNodeIds: new Set(),
      selectedConnectionId: null,
      selectedDrawingIds: new Set(),
    });

    // Build array of all delete promises
    const deletePromises: Promise<void>[] = [];

    // Delete selected nodes in parallel
    for (const nodeId of selectedNodeIds) {
      deletePromises.push(get().deleteNode(nodeId));
    }

    // Delete selected connection
    if (selectedConnectionId) {
      deletePromises.push(get().deleteConnection(selectedConnectionId));
    }

    // Delete selected drawings in parallel
    for (const drawingId of selectedDrawingIds) {
      deletePromises.push(get().deleteDrawing(drawingId));
    }

    // Execute all deletions in parallel
    await Promise.all(deletePromises);
  },

  // Node Actions
  addNode: async (data) => {
    const { currentInvestigation } = get();
    if (!currentInvestigation) throw new Error('No investigation selected');

    try {
      const node = await investigationsApi.addNode(currentInvestigation.record_id, data);
      set((state) => ({ nodes: [...state.nodes, node] }));
      return node;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add node';
      set({ error: message });
      throw err; // Rethrow so caller can handle (e.g., show specific error to user)
    }
  },

  updateNode: async (nodeId, data) => {
    const { currentInvestigation, nodes } = get();
    if (!currentInvestigation) return;

    // Store original node for rollback
    const originalNode = nodes.find(n => n.record_id === nodeId);
    if (!originalNode) return;

    // Optimistic update
    set((state) => ({
      nodes: state.nodes.map((n) => (n.record_id === nodeId ? { ...n, ...data } : n)),
    }));

    try {
      await investigationsApi.updateNode(currentInvestigation.record_id, nodeId, data);
    } catch {
      // Rollback on error
      set((state) => ({
        nodes: state.nodes.map((n) => (n.record_id === nodeId ? originalNode : n)),
        error: 'Failed to update node. Changes reverted.',
      }));
    }
  },

  updateNodePosition: (nodeId, x, y, zIndex) => {
    // Clamp positions to reasonable bounds to prevent overflow issues
    // Canvas bounds: -10000 to 10000 for both axes
    const MAX_POSITION = 10000;
    const MIN_POSITION = -10000;
    const clampedX = Math.max(MIN_POSITION, Math.min(MAX_POSITION, Number.isFinite(x) ? x : 0));
    const clampedY = Math.max(MIN_POSITION, Math.min(MAX_POSITION, Number.isFinite(y) ? y : 0));

    // Optimistic local update
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.record_id === nodeId ? { ...n, x: clampedX, y: clampedY, z_index: zIndex ?? n.z_index } : n
      ),
    }));

    // Track for debounced save (Map provides O(1) lookups and prevents duplicates)
    const update: NodePositionUpdate = { node_id: nodeId, x: clampedX, y: clampedY, z_index: zIndex };
    // Create new Map to avoid mutation issues (though Map.set is technically mutation,
    // we replace the entire Map when clearing to ensure clean state transitions)
    pendingPositionUpdates.set(nodeId, update);

    // Debounce save
    if (positionSaveTimeout) {
      clearTimeout(positionSaveTimeout);
    }
    positionSaveTimeout = setTimeout(() => {
      get().saveNodePositions();
    }, 300);
  },

  saveNodePositions: async () => {
    const { currentInvestigation, nodes } = get();
    if (!currentInvestigation || pendingPositionUpdates.size === 0) return;

    // Convert Map to array and create a fresh Map to avoid race conditions
    const updates = Array.from(pendingPositionUpdates.values());
    pendingPositionUpdates = new Map();

    // Store original positions for rollback
    const originalPositions = new Map<string, { x: number; y: number; z_index: number | null }>();
    for (const update of updates) {
      const node = nodes.find(n => n.record_id === update.node_id);
      if (node) {
        originalPositions.set(update.node_id, { x: node.x, y: node.y, z_index: node.z_index });
      }
    }

    try {
      await investigationsApi.updateNodePositions(currentInvestigation.record_id, updates);
    } catch {
      console.error('Failed to save node positions');
      // Rollback to original positions
      set((state) => ({
        nodes: state.nodes.map((n) => {
          const original = originalPositions.get(n.record_id);
          if (original) {
            return { ...n, x: original.x, y: original.y, z_index: original.z_index ?? n.z_index };
          }
          return n;
        }),
      }));
      toast.error('Failed to save node positions. Changes have been reverted.');
    }
  },

  deleteNode: async (nodeId) => {
    const { currentInvestigation, nodes, connections, selectedNodeIds } = get();
    if (!currentInvestigation) return;

    // Store original data for rollback
    const originalNode = nodes.find(n => n.record_id === nodeId);
    const originalConnections = connections.filter(
      c => c.from_node_id === nodeId || c.to_node_id === nodeId
    );
    const wasSelected = selectedNodeIds.has(nodeId);

    // Optimistic update - remove node and its connections
    set((state) => ({
      nodes: state.nodes.filter((n) => n.record_id !== nodeId),
      connections: state.connections.filter(
        (c) => c.from_node_id !== nodeId && c.to_node_id !== nodeId
      ),
      selectedNodeIds: new Set([...state.selectedNodeIds].filter((id) => id !== nodeId)),
    }));

    try {
      await investigationsApi.deleteNode(currentInvestigation.record_id, nodeId);
    } catch {
      // Rollback on error - restore node and connections
      if (originalNode) {
        set((state) => ({
          nodes: [...state.nodes, originalNode],
          connections: [...state.connections, ...originalConnections],
          selectedNodeIds: wasSelected
            ? new Set([...state.selectedNodeIds, nodeId])
            : state.selectedNodeIds,
          error: 'Failed to delete node. Changes reverted.',
        }));
      }
    }
  },

  bulkAddNodes: async (nodes) => {
    const { currentInvestigation } = get();
    if (!currentInvestigation) return { added: 0, skipped: 0 };

    try {
      const result = await investigationsApi.bulkAddNodes(currentInvestigation.record_id, nodes);
      set((state) => ({ nodes: [...state.nodes, ...result.nodes] }));
      return { added: result.added, skipped: result.skipped };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to bulk add nodes';
      set({ error: message });
      return { added: 0, skipped: 0 };
    }
  },

  // Connection Actions
  startConnection: (nodeId, anchor) => {
    set({ connectFrom: { nodeId, anchor } });
  },

  cancelConnection: () => {
    set({ connectFrom: null });
  },

  createConnection: async (data) => {
    const { currentInvestigation, connections, connectionStyle, connectionColor, connectionThickness, connectionArrowType, connectionPathType } = get();
    if (!currentInvestigation) return null;

    // Mutex check to prevent race condition on rapid clicks
    if (isCreatingConnection) {
      set({ connectFrom: null });
      return null;
    }
    isCreatingConnection = true;

    // Check for duplicate connection (same from/to nodes, regardless of direction)
    const isDuplicate = connections.some(c =>
      (c.from_node_id === data.from_node_id && c.to_node_id === data.to_node_id) ||
      (c.from_node_id === data.to_node_id && c.to_node_id === data.from_node_id)
    );

    if (isDuplicate) {
      isCreatingConnection = false;
      console.warn('Duplicate connection prevented');
      set({ connectFrom: null });
      toast.error('A connection already exists between these nodes.');
      return null;
    }

    const connectionData = {
      ...data,
      style: data.style ?? connectionStyle,
      color: data.color ?? connectionColor,
      thickness: data.thickness ?? connectionThickness,
      arrow_type: data.arrow_type ?? connectionArrowType,
      path_type: data.path_type ?? connectionPathType,
    };

    try {
      const connection = await investigationsApi.createConnection(
        currentInvestigation.record_id,
        connectionData
      );
      set((state) => ({
        connections: [...state.connections, connection],
        connectFrom: null,
      }));
      return connection;
    } catch {
      set({ error: 'Failed to create connection', connectFrom: null });
      return null;
    } finally {
      isCreatingConnection = false;
    }
  },

  updateConnection: async (connectionId, data) => {
    const { currentInvestigation, connections } = get();
    if (!currentInvestigation) return;

    // Store original connection for rollback
    const originalConnection = connections.find(c => c.record_id === connectionId);
    if (!originalConnection) return;

    // Optimistic update
    set((state) => ({
      connections: state.connections.map((c) =>
        c.record_id === connectionId ? { ...c, ...data } : c
      ),
    }));

    try {
      await investigationsApi.updateConnection(currentInvestigation.record_id, connectionId, data);
    } catch {
      // Rollback on error
      set((state) => ({
        connections: state.connections.map((c) =>
          c.record_id === connectionId ? originalConnection : c
        ),
        error: 'Failed to update connection. Changes reverted.',
      }));
    }
  },

  deleteConnection: async (connectionId) => {
    const { currentInvestigation, connections, selectedConnectionId } = get();
    if (!currentInvestigation) return;

    // Store original connection for rollback
    const originalConnection = connections.find(c => c.record_id === connectionId);
    const wasSelected = selectedConnectionId === connectionId;

    // Optimistic update
    set((state) => ({
      connections: state.connections.filter((c) => c.record_id !== connectionId),
      selectedConnectionId: state.selectedConnectionId === connectionId ? null : state.selectedConnectionId,
    }));

    try {
      await investigationsApi.deleteConnection(currentInvestigation.record_id, connectionId);
    } catch {
      // Rollback on error - restore connection
      if (originalConnection) {
        set((state) => ({
          connections: [...state.connections, originalConnection],
          selectedConnectionId: wasSelected ? connectionId : state.selectedConnectionId,
          error: 'Failed to delete connection. Changes reverted.',
        }));
      }
    }
  },

  // Drawing Actions
  addDrawing: async (data) => {
    const { currentInvestigation } = get();
    if (!currentInvestigation) return null;

    try {
      const drawing = await investigationsApi.addDrawing(currentInvestigation.record_id, data);
      set((state) => ({ drawings: [...state.drawings, drawing] }));
      return drawing;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add drawing';
      set({ error: message });
      return null;
    }
  },

  updateDrawing: async (drawingId, data) => {
    const { currentInvestigation, drawings } = get();
    if (!currentInvestigation) return;

    // Store original drawing for rollback
    const originalDrawing = drawings.find(d => d.record_id === drawingId);
    if (!originalDrawing) return;

    // Optimistic update
    set((state) => ({
      drawings: state.drawings.map((d) =>
        d.record_id === drawingId ? { ...d, ...data } : d
      ),
    }));

    try {
      await investigationsApi.updateDrawing(currentInvestigation.record_id, drawingId, data);
    } catch {
      // Rollback on error
      set((state) => ({
        drawings: state.drawings.map((d) =>
          d.record_id === drawingId ? originalDrawing : d
        ),
        error: 'Failed to update drawing. Changes reverted.',
      }));
    }
  },

  deleteDrawing: async (drawingId) => {
    const { currentInvestigation, drawings, selectedDrawingIds } = get();
    if (!currentInvestigation) return;

    // Store original drawing for rollback
    const originalDrawing = drawings.find(d => d.record_id === drawingId);
    const wasSelected = selectedDrawingIds.has(drawingId);

    // Optimistic update
    set((state) => ({
      drawings: state.drawings.filter((d) => d.record_id !== drawingId),
      selectedDrawingIds: new Set([...state.selectedDrawingIds].filter((id) => id !== drawingId)),
    }));

    try {
      await investigationsApi.deleteDrawing(currentInvestigation.record_id, drawingId);
    } catch {
      // Rollback on error - restore drawing
      if (originalDrawing) {
        set((state) => ({
          drawings: [...state.drawings, originalDrawing],
          selectedDrawingIds: wasSelected
            ? new Set([...state.selectedDrawingIds, drawingId])
            : state.selectedDrawingIds,
          error: 'Failed to delete drawing. Changes reverted.',
        }));
      }
    }
  },

  batchSaveDrawings: async (drawings) => {
    const { currentInvestigation } = get();
    if (!currentInvestigation) return;

    try {
      const result = await investigationsApi.batchUpdateDrawings(
        currentInvestigation.record_id,
        drawings
      );
      // Replace local drawings with server response
      set((state) => {
        const drawingIds = new Set(result.drawings.map((d) => d.record_id));
        const otherDrawings = state.drawings.filter((d) => !drawingIds.has(d.record_id));
        return { drawings: [...otherDrawings, ...result.drawings] };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save drawings';
      set({ error: message });
    }
  },

  // ============================================
  // WebSocket Event Handlers
  // ============================================

  handleNodeAdded: (node) => {
    set((state) => {
      // Avoid duplicates
      if (state.nodes.some((n) => n.record_id === node.record_id)) {
        return state;
      }
      return { nodes: [...state.nodes, node] };
    });
  },

  handleNodeMoved: (nodeId, x, y, zIndex) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.record_id === nodeId
          ? { ...n, x, y, z_index: zIndex ?? n.z_index }
          : n
      ),
    }));
  },

  handleNodeUpdated: (node) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.record_id === node.record_id ? { ...n, ...node } : n
      ),
    }));
  },

  handleNodeRemoved: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.record_id !== nodeId),
      connections: state.connections.filter(
        (c) => c.from_node_id !== nodeId && c.to_node_id !== nodeId
      ),
      selectedNodeIds: new Set([...state.selectedNodeIds].filter((id) => id !== nodeId)),
    }));
  },

  handleConnectionAdded: (connection) => {
    set((state) => {
      if (state.connections.some((c) => c.record_id === connection.record_id)) {
        return state;
      }
      return { connections: [...state.connections, connection] };
    });
  },

  handleConnectionUpdated: (connection) => {
    set((state) => ({
      connections: state.connections.map((c) =>
        c.record_id === connection.record_id ? { ...c, ...connection } : c
      ),
    }));
  },

  handleConnectionRemoved: (connectionId) => {
    set((state) => ({
      connections: state.connections.filter((c) => c.record_id !== connectionId),
      selectedConnectionId: state.selectedConnectionId === connectionId ? null : state.selectedConnectionId,
    }));
  },

  handleDrawingAdded: (drawing) => {
    set((state) => {
      if (state.drawings.some((d) => d.record_id === drawing.record_id)) {
        return state;
      }
      return { drawings: [...state.drawings, drawing] };
    });
  },

  handleDrawingUpdated: (drawing) => {
    set((state) => ({
      drawings: state.drawings.map((d) =>
        d.record_id === drawing.record_id ? { ...d, ...drawing } : d
      ),
    }));
  },

  handleDrawingRemoved: (drawingId) => {
    set((state) => ({
      drawings: state.drawings.filter((d) => d.record_id !== drawingId),
      selectedDrawingIds: new Set([...state.selectedDrawingIds].filter((id) => id !== drawingId)),
    }));
  },

  handleUserJoined: (user) => {
    set((state) => {
      if (state.onlineUsers.some((u) => u.userId === user.userId)) {
        return state;
      }
      return {
        onlineUsers: [
          ...state.onlineUsers,
          { ...user, color: generateUserColor() },
        ],
      };
    });
  },

  handleUserLeft: (userId) => {
    set((state) => ({
      onlineUsers: state.onlineUsers.filter((u) => u.userId !== userId),
      cursors: new Map([...state.cursors].filter(([id]) => id !== userId)),
    }));
  },

  handleCursorMoved: (userId, position) => {
    set((state) => {
      const newCursors = new Map(state.cursors);
      newCursors.set(userId, position);
      return { cursors: newCursors };
    });
  },

  handleCanvasStateUpdated: (canvasState) => {
    // Only update if different from current (avoid feedback loop)
    set((state) => ({
      viewport: {
        x: canvasState.panX ?? state.viewport.x,
        y: canvasState.panY ?? state.viewport.y,
      },
      zoom: canvasState.zoom ?? state.zoom,
    }));
  },

  // Utility
  clearError: () => set({ error: null }),
}));
