import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useInvestigationsStore } from '../store';
import type {
  Investigation,
  InvestigationNode,
  InvestigationConnection,
  InvestigationDrawing,
  InvestigationStatistics,
} from '../types';

// Mock the investigations API
vi.mock('@/modules/investigations/api', () => ({
  listInvestigations: vi.fn(),
  createInvestigation: vi.fn(),
  getInvestigation: vi.fn(),
  updateInvestigation: vi.fn(),
  deleteInvestigation: vi.fn(),
  searchInvestigations: vi.fn(),
  getInvestigationStats: vi.fn(),
  updateCanvasState: vi.fn(),
  addNode: vi.fn(),
  updateNode: vi.fn(),
  deleteNode: vi.fn(),
  bulkAddNodes: vi.fn(),
  updateNodePositions: vi.fn(),
  createConnection: vi.fn(),
  updateConnection: vi.fn(),
  deleteConnection: vi.fn(),
  addDrawing: vi.fn(),
  updateDrawing: vi.fn(),
  deleteDrawing: vi.fn(),
  batchUpdateDrawings: vi.fn(),
  getTimeline: vi.fn(),
  getGraph: vi.fn(),
  applyLayout: vi.fn(),
}));

import * as investigationsApi from '@/modules/investigations/api';

// Mock data factories
const createMockInvestigation = (overrides: Partial<Investigation> = {}): Investigation => ({
  record_id: 'inv-1',
  partition_id: 'partition-1',
  title: 'Test Investigation',
  description: 'A test investigation',
  status: 'open',
  priority: 'medium',
  case_number: 'CASE-001',
  is_public: false,
  canvas_state: null,
  assigned_to: null,
  due_date: null,
  created_by: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  deleted_at: null,
  nodes: [],
  connections: [],
  drawings: [],
  ...overrides,
});

const createMockNode = (overrides: Partial<InvestigationNode> = {}): InvestigationNode => ({
  record_id: 'node-1',
  partition_id: 'partition-1',
  investigation_id: 'inv-1',
  entity_type: 'person',
  entity_id: 'person-1',
  x: 100,
  y: 100,
  width: 200,
  height: 80,
  z_index: 0,
  settings: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  deleted_at: null,
  ...overrides,
});

const createMockConnection = (overrides: Partial<InvestigationConnection> = {}): InvestigationConnection => ({
  record_id: 'conn-1',
  partition_id: 'partition-1',
  investigation_id: 'inv-1',
  from_node_id: 'node-1',
  to_node_id: 'node-2',
  from_anchor: 'right',
  to_anchor: 'left',
  label: null,
  color: '#6366f1',
  style: 'solid',
  thickness: 2,
  arrow_type: 'forward',
  path_type: 'curved',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  deleted_at: null,
  ...overrides,
});

const createMockDrawing = (overrides: Partial<InvestigationDrawing> = {}): InvestigationDrawing => ({
  record_id: 'draw-1',
  partition_id: 'partition-1',
  investigation_id: 'inv-1',
  tool: 'pencil',
  points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
  color: '#ef4444',
  size: 4,
  thickness: 4,
  bounds: { left: 0, top: 0, right: 100, bottom: 100 },
  z_index: 0,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  deleted_at: null,
  ...overrides,
});

describe('investigationsStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useInvestigationsStore.setState({
      investigations: [],
      listLoading: false,
      pagination: { total: 0, per_page: 20, current_page: 1, last_page: 1 },
      statistics: null,
      currentInvestigation: null,
      nodes: [],
      connections: [],
      drawings: [],
      graphLoading: false,
      selectedNodeIds: new Set(),
      selectedConnectionId: null,
      selectedDrawingIds: new Set(),
      viewport: { x: 0, y: 0 },
      zoom: 1,
      isPanning: false,
      currentTool: 'select',
      drawingTool: 'pencil',
      drawColor: '#ef4444',
      drawSize: 4,
      connectFrom: null,
      connectionStyle: 'solid',
      connectionColor: '#6366f1',
      connectionThickness: 2,
      connectionArrowType: 'forward',
      connectionPathType: 'curved',
      onlineUsers: [],
      cursors: new Map(),
      timelineData: null,
      timelineLoading: false,
      error: null,
      isSaving: false,
    });
    vi.clearAllMocks();
  });

  // ============================================
  // List View Tests
  // ============================================

  describe('loadInvestigations', () => {
    it('should load investigations successfully', async () => {
      const mockInvestigations = [createMockInvestigation()];
      const mockPagination = { total: 1, per_page: 20, current_page: 1, last_page: 1, from: 1, to: 1 };

      vi.mocked(investigationsApi.listInvestigations).mockResolvedValue({
        investigations: mockInvestigations,
        pagination: mockPagination,
      });

      const { loadInvestigations } = useInvestigationsStore.getState();
      await loadInvestigations();

      const state = useInvestigationsStore.getState();
      expect(state.investigations).toEqual(mockInvestigations);
      expect(state.pagination).toEqual(mockPagination);
      expect(state.listLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle load error', async () => {
      vi.mocked(investigationsApi.listInvestigations).mockRejectedValue(new Error('Network error'));

      const { loadInvestigations } = useInvestigationsStore.getState();
      await loadInvestigations();

      const state = useInvestigationsStore.getState();
      expect(state.investigations).toEqual([]);
      expect(state.listLoading).toBe(false);
      expect(state.error).toBe('Network error');
    });
  });

  describe('createInvestigation', () => {
    it('should create investigation and add to list', async () => {
      const newInvestigation = createMockInvestigation({ record_id: 'inv-new' });
      vi.mocked(investigationsApi.createInvestigation).mockResolvedValue(newInvestigation);

      const { createInvestigation } = useInvestigationsStore.getState();
      const result = await createInvestigation({
        title: 'New Investigation',
        description: 'Test',
        status: 'open',
        priority: 'medium',
      });

      const state = useInvestigationsStore.getState();
      expect(result).toEqual(newInvestigation);
      expect(state.investigations).toContainEqual(newInvestigation);
    });

    it('should return null on error', async () => {
      vi.mocked(investigationsApi.createInvestigation).mockRejectedValue(new Error('Failed'));

      const { createInvestigation } = useInvestigationsStore.getState();
      const result = await createInvestigation({
        title: 'New Investigation',
        status: 'open',
        priority: 'medium',
      });

      expect(result).toBeNull();
      expect(useInvestigationsStore.getState().error).toBe('Failed');
    });
  });

  describe('deleteInvestigation', () => {
    it('should remove investigation from list', async () => {
      const investigation = createMockInvestigation();
      useInvestigationsStore.setState({ investigations: [investigation] });

      vi.mocked(investigationsApi.deleteInvestigation).mockResolvedValue(undefined);

      const { deleteInvestigation } = useInvestigationsStore.getState();
      const result = await deleteInvestigation('inv-1');

      expect(result).toBe(true);
      expect(useInvestigationsStore.getState().investigations).toEqual([]);
    });
  });

  // ============================================
  // Canvas View Tests
  // ============================================

  describe('loadInvestigation', () => {
    it('should load investigation with nodes and connections', async () => {
      const mockNodes = [createMockNode()];
      const mockConnections = [createMockConnection()];
      const mockDrawings = [createMockDrawing()];
      const investigation = createMockInvestigation({
        nodes: mockNodes,
        connections: mockConnections,
        drawings: mockDrawings,
      });

      vi.mocked(investigationsApi.getInvestigation).mockResolvedValue(investigation);

      const { loadInvestigation } = useInvestigationsStore.getState();
      await loadInvestigation('inv-1');

      const state = useInvestigationsStore.getState();
      expect(state.currentInvestigation).toEqual(investigation);
      expect(state.nodes).toEqual(mockNodes);
      expect(state.connections).toEqual(mockConnections);
      expect(state.drawings).toEqual(mockDrawings);
      expect(state.graphLoading).toBe(false);
    });
  });

  describe('clearCurrentInvestigation', () => {
    it('should clear all canvas state', () => {
      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
        nodes: [createMockNode()],
        connections: [createMockConnection()],
        drawings: [createMockDrawing()],
        selectedNodeIds: new Set(['node-1']),
      });

      const { clearCurrentInvestigation } = useInvestigationsStore.getState();
      clearCurrentInvestigation();

      const state = useInvestigationsStore.getState();
      expect(state.currentInvestigation).toBeNull();
      expect(state.nodes).toEqual([]);
      expect(state.connections).toEqual([]);
      expect(state.drawings).toEqual([]);
      expect(state.selectedNodeIds.size).toBe(0);
    });
  });

  // ============================================
  // Canvas State Tests
  // ============================================

  describe('setViewport', () => {
    it('should update viewport', () => {
      const { setViewport } = useInvestigationsStore.getState();
      setViewport({ x: 100, y: 200 });

      expect(useInvestigationsStore.getState().viewport).toEqual({ x: 100, y: 200 });
    });
  });

  describe('setZoom', () => {
    it('should update zoom within bounds', () => {
      const { setZoom } = useInvestigationsStore.getState();

      setZoom(2);
      expect(useInvestigationsStore.getState().zoom).toBe(2);

      setZoom(0.05); // Below min
      expect(useInvestigationsStore.getState().zoom).toBe(0.1);

      setZoom(5); // Above max
      expect(useInvestigationsStore.getState().zoom).toBe(4);
    });
  });

  describe('fitToContent', () => {
    it('should adjust viewport to fit content', () => {
      useInvestigationsStore.setState({
        nodes: [
          createMockNode({ x: 100, y: 100, width: 200, height: 80 }),
          createMockNode({ x: 400, y: 300, width: 200, height: 80, record_id: 'node-2' }),
        ],
      });

      const { fitToContent } = useInvestigationsStore.getState();
      fitToContent();

      const state = useInvestigationsStore.getState();
      expect(state.zoom).toBeLessThanOrEqual(1);
      expect(state.viewport).toBeDefined();
    });

    it('should do nothing with no content', () => {
      const initialState = useInvestigationsStore.getState();
      const { fitToContent } = useInvestigationsStore.getState();
      fitToContent();

      expect(useInvestigationsStore.getState().viewport).toEqual(initialState.viewport);
    });
  });

  // ============================================
  // Tool State Tests
  // ============================================

  describe('setTool', () => {
    it('should change current tool and cancel connection', () => {
      useInvestigationsStore.setState({ connectFrom: { nodeId: 'node-1', anchor: 'right' } });

      const { setTool } = useInvestigationsStore.getState();
      setTool('draw');

      const state = useInvestigationsStore.getState();
      expect(state.currentTool).toBe('draw');
      expect(state.connectFrom).toBeNull();
    });
  });

  describe('setDrawingTool', () => {
    it('should change drawing tool', () => {
      const { setDrawingTool } = useInvestigationsStore.getState();
      setDrawingTool('rectangle');

      expect(useInvestigationsStore.getState().drawingTool).toBe('rectangle');
    });
  });

  describe('setDrawColor', () => {
    it('should change draw color', () => {
      const { setDrawColor } = useInvestigationsStore.getState();
      setDrawColor('#3b82f6');

      expect(useInvestigationsStore.getState().drawColor).toBe('#3b82f6');
    });
  });

  describe('setDrawSize', () => {
    it('should change draw size', () => {
      const { setDrawSize } = useInvestigationsStore.getState();
      setDrawSize(8);

      expect(useInvestigationsStore.getState().drawSize).toBe(8);
    });
  });

  // ============================================
  // Selection Tests
  // ============================================

  describe('selectNode', () => {
    it('should select a single node', () => {
      const { selectNode } = useInvestigationsStore.getState();
      selectNode('node-1');

      expect(useInvestigationsStore.getState().selectedNodeIds).toContain('node-1');
    });

    it('should toggle selection with multiSelect', () => {
      useInvestigationsStore.setState({ selectedNodeIds: new Set(['node-1']) });

      const { selectNode } = useInvestigationsStore.getState();
      selectNode('node-2', true);

      const selected = useInvestigationsStore.getState().selectedNodeIds;
      expect(selected).toContain('node-1');
      expect(selected).toContain('node-2');
    });

    it('should deselect when clicking selected node with multiSelect', () => {
      useInvestigationsStore.setState({ selectedNodeIds: new Set(['node-1', 'node-2']) });

      const { selectNode } = useInvestigationsStore.getState();
      selectNode('node-1', true);

      expect(useInvestigationsStore.getState().selectedNodeIds).not.toContain('node-1');
    });
  });

  describe('selectByMarquee', () => {
    it('should select nodes within bounds', () => {
      useInvestigationsStore.setState({
        nodes: [
          createMockNode({ x: 50, y: 50, width: 100, height: 50, record_id: 'node-1' }),
          createMockNode({ x: 200, y: 200, width: 100, height: 50, record_id: 'node-2' }),
        ],
      });

      const { selectByMarquee } = useInvestigationsStore.getState();
      selectByMarquee({ x1: 0, y1: 0, x2: 180, y2: 180 });

      const selected = useInvestigationsStore.getState().selectedNodeIds;
      expect(selected).toContain('node-1');
      expect(selected).not.toContain('node-2');
    });
  });

  describe('clearSelection', () => {
    it('should clear all selections', () => {
      useInvestigationsStore.setState({
        selectedNodeIds: new Set(['node-1']),
        selectedConnectionId: 'conn-1',
        selectedDrawingIds: new Set(['draw-1']),
      });

      const { clearSelection } = useInvestigationsStore.getState();
      clearSelection();

      const state = useInvestigationsStore.getState();
      expect(state.selectedNodeIds.size).toBe(0);
      expect(state.selectedConnectionId).toBeNull();
      expect(state.selectedDrawingIds.size).toBe(0);
    });
  });

  // ============================================
  // Node Actions Tests
  // ============================================

  describe('addNode', () => {
    it('should add node to canvas', async () => {
      const mockNode = createMockNode();
      useInvestigationsStore.setState({ currentInvestigation: createMockInvestigation() });
      vi.mocked(investigationsApi.addNode).mockResolvedValue(mockNode);

      const { addNode } = useInvestigationsStore.getState();
      const result = await addNode({
        entity_type: 'person',
        entity_id: 'person-1',
        x: 100,
        y: 100,
        width: 200,
        height: 80,
      });

      expect(result).toEqual(mockNode);
      expect(useInvestigationsStore.getState().nodes).toContainEqual(mockNode);
    });

    it('should throw error when no investigation is loaded', async () => {
      const { addNode } = useInvestigationsStore.getState();

      await expect(addNode({
        entity_type: 'person',
        entity_id: 'person-1',
        x: 100,
        y: 100,
        width: 200,
        height: 80,
      })).rejects.toThrow('No investigation selected');
    });
  });

  describe('deleteNode', () => {
    it('should remove node and its connections', async () => {
      const node1 = createMockNode({ record_id: 'node-1' });
      const node2 = createMockNode({ record_id: 'node-2' });
      const connection = createMockConnection({ from_node_id: 'node-1', to_node_id: 'node-2' });

      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
        nodes: [node1, node2],
        connections: [connection],
      });

      vi.mocked(investigationsApi.deleteNode).mockResolvedValue(undefined);

      const { deleteNode } = useInvestigationsStore.getState();
      await deleteNode('node-1');

      const state = useInvestigationsStore.getState();
      expect(state.nodes).not.toContainEqual(node1);
      expect(state.nodes).toContainEqual(node2);
      expect(state.connections).toEqual([]);
    });
  });

  describe('updateNodePosition', () => {
    it('should update node position locally', () => {
      useInvestigationsStore.setState({
        nodes: [createMockNode({ x: 0, y: 0 })],
      });

      const { updateNodePosition } = useInvestigationsStore.getState();
      updateNodePosition('node-1', 200, 300);

      const node = useInvestigationsStore.getState().nodes[0];
      expect(node.x).toBe(200);
      expect(node.y).toBe(300);
    });
  });

  // ============================================
  // Connection Actions Tests
  // ============================================

  describe('startConnection', () => {
    it('should set connectFrom state', () => {
      const { startConnection } = useInvestigationsStore.getState();
      startConnection('node-1', 'right');

      expect(useInvestigationsStore.getState().connectFrom).toEqual({
        nodeId: 'node-1',
        anchor: 'right',
      });
    });
  });

  describe('cancelConnection', () => {
    it('should clear connectFrom state', () => {
      useInvestigationsStore.setState({ connectFrom: { nodeId: 'node-1', anchor: 'right' } });

      const { cancelConnection } = useInvestigationsStore.getState();
      cancelConnection();

      expect(useInvestigationsStore.getState().connectFrom).toBeNull();
    });
  });

  describe('createConnection', () => {
    it('should create connection with default styles', async () => {
      const mockConnection = createMockConnection();
      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
        connectFrom: { nodeId: 'node-1', anchor: 'right' },
      });
      vi.mocked(investigationsApi.createConnection).mockResolvedValue(mockConnection);

      const { createConnection } = useInvestigationsStore.getState();
      const result = await createConnection({
        from_node_id: 'node-1',
        to_node_id: 'node-2',
        from_anchor: 'right',
        to_anchor: 'left',
      });

      expect(result).toEqual(mockConnection);
      expect(useInvestigationsStore.getState().connections).toContainEqual(mockConnection);
      expect(useInvestigationsStore.getState().connectFrom).toBeNull();
    });
  });

  // ============================================
  // Drawing Actions Tests
  // ============================================

  describe('addDrawing', () => {
    it('should add drawing to canvas', async () => {
      const mockDrawing = createMockDrawing();
      useInvestigationsStore.setState({ currentInvestigation: createMockInvestigation() });
      vi.mocked(investigationsApi.addDrawing).mockResolvedValue(mockDrawing);

      const { addDrawing } = useInvestigationsStore.getState();
      const result = await addDrawing({
        tool: 'pencil',
        points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
        color: '#ef4444',
        size: 4,
        thickness: 4,
      });

      expect(result).toEqual(mockDrawing);
      expect(useInvestigationsStore.getState().drawings).toContainEqual(mockDrawing);
    });
  });

  // ============================================
  // WebSocket Handler Tests
  // ============================================

  describe('handleNodeAdded', () => {
    it('should add node from WebSocket event', () => {
      const node = createMockNode();

      const { handleNodeAdded } = useInvestigationsStore.getState();
      handleNodeAdded(node, 'other-user');

      expect(useInvestigationsStore.getState().nodes).toContainEqual(node);
    });

    it('should not duplicate existing node', () => {
      const node = createMockNode();
      useInvestigationsStore.setState({ nodes: [node] });

      const { handleNodeAdded } = useInvestigationsStore.getState();
      handleNodeAdded(node, 'other-user');

      expect(useInvestigationsStore.getState().nodes).toHaveLength(1);
    });
  });

  describe('handleNodeMoved', () => {
    it('should update node position from WebSocket event', () => {
      useInvestigationsStore.setState({ nodes: [createMockNode()] });

      const { handleNodeMoved } = useInvestigationsStore.getState();
      handleNodeMoved('node-1', 500, 600, 5, 'other-user');

      const node = useInvestigationsStore.getState().nodes[0];
      expect(node.x).toBe(500);
      expect(node.y).toBe(600);
      expect(node.z_index).toBe(5);
    });
  });

  describe('handleUserJoined', () => {
    it('should add user to online users', () => {
      const { handleUserJoined } = useInvestigationsStore.getState();
      handleUserJoined({ userId: 'user-2', username: 'TestUser' });

      const users = useInvestigationsStore.getState().onlineUsers;
      expect(users).toHaveLength(1);
      expect(users[0].userId).toBe('user-2');
      expect(users[0].username).toBe('TestUser');
      expect(users[0].color).toBeDefined();
    });
  });

  describe('handleUserLeft', () => {
    it('should remove user from online users', () => {
      useInvestigationsStore.setState({
        onlineUsers: [{ userId: 'user-2', username: 'TestUser', color: '#ef4444' }],
      });

      const { handleUserLeft } = useInvestigationsStore.getState();
      handleUserLeft('user-2');

      expect(useInvestigationsStore.getState().onlineUsers).toHaveLength(0);
    });
  });

  describe('handleCursorMoved', () => {
    it('should update cursor position', () => {
      const { handleCursorMoved } = useInvestigationsStore.getState();
      handleCursorMoved('user-2', { x: 100, y: 200 });

      const cursor = useInvestigationsStore.getState().cursors.get('user-2');
      expect(cursor).toEqual({ x: 100, y: 200 });
    });
  });

  // ============================================
  // Statistics Tests
  // ============================================

  describe('loadStatistics', () => {
    it('should load statistics successfully', async () => {
      const mockStats: InvestigationStatistics = {
        total_investigations: 10,
        by_status: { open: 5, closed: 3, archived: 2 },
        by_priority: { high: 3, medium: 4, low: 3 },
        recent_activity: [],
      };

      vi.mocked(investigationsApi.getInvestigationStats).mockResolvedValue(mockStats);

      const { loadStatistics } = useInvestigationsStore.getState();
      await loadStatistics();

      expect(useInvestigationsStore.getState().statistics).toEqual(mockStats);
    });
  });

  // ============================================
  // Error Handling Tests
  // ============================================

  describe('clearError', () => {
    it('should clear error state', () => {
      useInvestigationsStore.setState({ error: 'Some error' });

      const { clearError } = useInvestigationsStore.getState();
      clearError();

      expect(useInvestigationsStore.getState().error).toBeNull();
    });
  });

  // ============================================
  // Additional Tests for Coverage
  // ============================================

  describe('searchInvestigations', () => {
    it('should search investigations successfully', async () => {
      const mockInvestigations = [createMockInvestigation()];
      const mockPagination = { total: 1, per_page: 20, current_page: 1, last_page: 1, from: 1, to: 1 };

      vi.mocked(investigationsApi.searchInvestigations).mockResolvedValue({
        investigations: mockInvestigations,
        pagination: mockPagination,
      });

      const { searchInvestigations } = useInvestigationsStore.getState();
      await searchInvestigations('test query');

      const state = useInvestigationsStore.getState();
      expect(state.investigations).toEqual(mockInvestigations);
      expect(state.listLoading).toBe(false);
    });

    it('should search with folder filter', async () => {
      vi.mocked(investigationsApi.searchInvestigations).mockResolvedValue({
        investigations: [],
        pagination: { total: 0, per_page: 20, current_page: 1, last_page: 1, from: 0, to: 0 },
      });

      const { searchInvestigations } = useInvestigationsStore.getState();
      await searchInvestigations('test', 1, 'folder-1');

      expect(investigationsApi.searchInvestigations).toHaveBeenCalledWith({
        q: 'test',
        page: 1,
        folder_id: 'folder-1',
      });
    });

    it('should handle search error', async () => {
      vi.mocked(investigationsApi.searchInvestigations).mockRejectedValue(new Error('Search failed'));

      const { searchInvestigations } = useInvestigationsStore.getState();
      await searchInvestigations('test');

      expect(useInvestigationsStore.getState().error).toBe('Search failed');
    });
  });

  describe('updateInvestigation', () => {
    it('should update investigation successfully', async () => {
      const investigation = createMockInvestigation();
      const updatedInvestigation = { ...investigation, title: 'Updated Title' };

      useInvestigationsStore.setState({
        investigations: [investigation],
        currentInvestigation: investigation,
      });

      vi.mocked(investigationsApi.updateInvestigation).mockResolvedValue(updatedInvestigation);

      const { updateInvestigation } = useInvestigationsStore.getState();
      const result = await updateInvestigation('inv-1', { title: 'Updated Title' });

      expect(result?.title).toBe('Updated Title');
      expect(useInvestigationsStore.getState().investigations[0].title).toBe('Updated Title');
      expect(useInvestigationsStore.getState().currentInvestigation?.title).toBe('Updated Title');
    });

    it('should return null on update error', async () => {
      vi.mocked(investigationsApi.updateInvestigation).mockRejectedValue(new Error('Update failed'));

      const { updateInvestigation } = useInvestigationsStore.getState();
      const result = await updateInvestigation('inv-1', { title: 'Updated' });

      expect(result).toBeNull();
      expect(useInvestigationsStore.getState().error).toBe('Update failed');
    });

    it('should handle non-Error exceptions', async () => {
      vi.mocked(investigationsApi.updateInvestigation).mockRejectedValue('String error');

      const { updateInvestigation } = useInvestigationsStore.getState();
      await updateInvestigation('inv-1', { title: 'Test' });

      expect(useInvestigationsStore.getState().error).toBe('Failed to update investigation');
    });
  });

  describe('loadGraph', () => {
    it('should load graph data successfully', async () => {
      const mockNodes = [createMockNode()];
      const mockConnections = [createMockConnection()];
      const mockDrawings = [createMockDrawing()];

      vi.mocked(investigationsApi.getGraph).mockResolvedValue({
        nodes: mockNodes,
        connections: mockConnections,
        drawings: mockDrawings,
      });

      const { loadGraph } = useInvestigationsStore.getState();
      await loadGraph('inv-1');

      const state = useInvestigationsStore.getState();
      expect(state.nodes).toEqual(mockNodes);
      expect(state.connections).toEqual(mockConnections);
      expect(state.drawings).toEqual(mockDrawings);
      expect(state.graphLoading).toBe(false);
    });

    it('should clear selection when loading graph', async () => {
      useInvestigationsStore.setState({
        selectedNodeIds: new Set(['node-1']),
        selectedConnectionId: 'conn-1',
        selectedDrawingIds: new Set(['draw-1']),
      });

      vi.mocked(investigationsApi.getGraph).mockResolvedValue({
        nodes: [],
        connections: [],
        drawings: [],
      });

      const { loadGraph } = useInvestigationsStore.getState();
      await loadGraph('inv-1');

      const state = useInvestigationsStore.getState();
      expect(state.selectedNodeIds.size).toBe(0);
      expect(state.selectedConnectionId).toBeNull();
      expect(state.selectedDrawingIds.size).toBe(0);
    });

    it('should handle load graph error', async () => {
      vi.mocked(investigationsApi.getGraph).mockRejectedValue(new Error('Failed'));

      const { loadGraph } = useInvestigationsStore.getState();
      await loadGraph('inv-1');

      expect(useInvestigationsStore.getState().error).toBe('Failed');
    });
  });

  describe('loadTimeline', () => {
    it('should load timeline data successfully', async () => {
      const mockTimeline = {
        events: [{ date: '2024-01-01', items: [] }],
        total: 1,
      };

      vi.mocked(investigationsApi.getTimeline).mockResolvedValue(mockTimeline);

      const { loadTimeline } = useInvestigationsStore.getState();
      await loadTimeline('inv-1', { group_by: 'day' });

      expect(useInvestigationsStore.getState().timelineData).toEqual(mockTimeline);
      expect(useInvestigationsStore.getState().timelineLoading).toBe(false);
    });

    it('should handle timeline error silently', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(investigationsApi.getTimeline).mockRejectedValue(new Error('Timeline failed'));

      const { loadTimeline } = useInvestigationsStore.getState();
      await loadTimeline('inv-1');

      expect(useInvestigationsStore.getState().timelineLoading).toBe(false);
      consoleError.mockRestore();
    });
  });

  describe('refreshGraphData', () => {
    it('should refresh graph data when investigation is loaded', async () => {
      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
      });

      vi.mocked(investigationsApi.getGraph).mockResolvedValue({
        nodes: [createMockNode()],
        connections: [],
        drawings: [],
      });

      const { refreshGraphData } = useInvestigationsStore.getState();
      await refreshGraphData();

      expect(useInvestigationsStore.getState().nodes).toHaveLength(1);
    });

    it('should do nothing when no investigation is loaded', async () => {
      const { refreshGraphData } = useInvestigationsStore.getState();
      await refreshGraphData();

      expect(investigationsApi.getGraph).not.toHaveBeenCalled();
    });

    it('should throw error on failure', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
      });

      vi.mocked(investigationsApi.getGraph).mockRejectedValue(new Error('Refresh failed'));

      const { refreshGraphData } = useInvestigationsStore.getState();
      await expect(refreshGraphData()).rejects.toThrow('Refresh failed');
      consoleError.mockRestore();
    });
  });

  describe('saveCanvasState', () => {
    it('should save canvas state when investigation is loaded', async () => {
      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
        viewport: { x: 100, y: 200 },
        zoom: 1.5,
      });

      vi.mocked(investigationsApi.updateCanvasState).mockResolvedValue(undefined);

      const { saveCanvasState } = useInvestigationsStore.getState();
      await saveCanvasState();

      expect(investigationsApi.updateCanvasState).toHaveBeenCalledWith('inv-1', {
        zoom: 1.5,
        panX: 100,
        panY: 200,
      });
    });

    it('should do nothing when no investigation is loaded', async () => {
      const { saveCanvasState } = useInvestigationsStore.getState();
      await saveCanvasState();

      expect(investigationsApi.updateCanvasState).not.toHaveBeenCalled();
    });

    it('should handle error silently', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
      });

      vi.mocked(investigationsApi.updateCanvasState).mockRejectedValue(new Error('Failed'));

      const { saveCanvasState } = useInvestigationsStore.getState();
      await saveCanvasState();

      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe('applyLayout', () => {
    it('should apply layout and update node positions', async () => {
      const node1 = createMockNode({ record_id: 'node-1', x: 0, y: 0 });
      const node2 = createMockNode({ record_id: 'node-2', x: 0, y: 0 });

      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
        nodes: [node1, node2],
      });

      vi.mocked(investigationsApi.applyLayout).mockResolvedValue({
        positions: {
          'node-1': { x: 100, y: 100 },
          'node-2': { x: 200, y: 200 },
        },
      });

      const { applyLayout } = useInvestigationsStore.getState();
      await applyLayout('force');

      const state = useInvestigationsStore.getState();
      expect(state.nodes.find(n => n.record_id === 'node-1')?.x).toBe(100);
      expect(state.nodes.find(n => n.record_id === 'node-2')?.x).toBe(200);
    });

    it('should handle invalid layout response', async () => {
      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
      });

      vi.mocked(investigationsApi.applyLayout).mockResolvedValue(null as unknown as Awaited<ReturnType<typeof investigationsApi.applyLayout>>);

      const { applyLayout } = useInvestigationsStore.getState();
      await applyLayout('force');

      expect(useInvestigationsStore.getState().error).toBe('Invalid layout response from server');
    });

    it('should do nothing when no investigation is loaded', async () => {
      const { applyLayout } = useInvestigationsStore.getState();
      await applyLayout('force');

      expect(investigationsApi.applyLayout).not.toHaveBeenCalled();
    });
  });

  describe('setConnectionDefaults', () => {
    it('should update connection defaults', () => {
      const { setConnectionDefaults } = useInvestigationsStore.getState();
      setConnectionDefaults({
        style: 'dashed',
        color: '#ff0000',
        thickness: 4,
        arrowType: 'both',
        pathType: 'straight',
      });

      const state = useInvestigationsStore.getState();
      expect(state.connectionStyle).toBe('dashed');
      expect(state.connectionColor).toBe('#ff0000');
      expect(state.connectionThickness).toBe(4);
      expect(state.connectionArrowType).toBe('both');
      expect(state.connectionPathType).toBe('straight');
    });

    it('should partially update connection defaults', () => {
      const { setConnectionDefaults } = useInvestigationsStore.getState();
      setConnectionDefaults({ color: '#00ff00' });

      const state = useInvestigationsStore.getState();
      expect(state.connectionColor).toBe('#00ff00');
      expect(state.connectionStyle).toBe('solid'); // Unchanged
    });
  });

  describe('setIsPanning', () => {
    it('should set panning state', () => {
      const { setIsPanning } = useInvestigationsStore.getState();
      setIsPanning(true);

      expect(useInvestigationsStore.getState().isPanning).toBe(true);
    });
  });

  describe('setDrawColor validation', () => {
    it('should accept valid hex colors', () => {
      const { setDrawColor } = useInvestigationsStore.getState();
      setDrawColor('#abc');
      expect(useInvestigationsStore.getState().drawColor).toBe('#abc');

      setDrawColor('#AABBCC');
      expect(useInvestigationsStore.getState().drawColor).toBe('#AABBCC');
    });

    it('should accept valid rgb colors', () => {
      const { setDrawColor } = useInvestigationsStore.getState();
      setDrawColor('rgb(255, 128, 0)');
      expect(useInvestigationsStore.getState().drawColor).toBe('rgb(255, 128, 0)');
    });

    it('should default invalid colors to black', () => {
      const { setDrawColor } = useInvestigationsStore.getState();
      setDrawColor('invalid-color');
      expect(useInvestigationsStore.getState().drawColor).toBe('#000000');
    });
  });

  describe('setDrawSize bounds', () => {
    it('should clamp size to minimum 1', () => {
      const { setDrawSize } = useInvestigationsStore.getState();
      setDrawSize(0);
      expect(useInvestigationsStore.getState().drawSize).toBe(1);

      setDrawSize(-5);
      expect(useInvestigationsStore.getState().drawSize).toBe(1);
    });

    it('should clamp size to maximum 50', () => {
      const { setDrawSize } = useInvestigationsStore.getState();
      setDrawSize(100);
      expect(useInvestigationsStore.getState().drawSize).toBe(50);
    });

    it('should handle non-finite values', () => {
      const { setDrawSize } = useInvestigationsStore.getState();
      setDrawSize(NaN);
      expect(useInvestigationsStore.getState().drawSize).toBe(2);

      // Infinity is treated as non-finite and defaults to 2, then clamped
      setDrawSize(Infinity);
      // Number.isFinite(Infinity) is false, so it defaults to 2
      expect(useInvestigationsStore.getState().drawSize).toBe(2);
    });
  });

  describe('selectConnection', () => {
    it('should select connection and clear other selections', () => {
      useInvestigationsStore.setState({
        selectedNodeIds: new Set(['node-1']),
        selectedDrawingIds: new Set(['draw-1']),
      });

      const { selectConnection } = useInvestigationsStore.getState();
      selectConnection('conn-1');

      const state = useInvestigationsStore.getState();
      expect(state.selectedConnectionId).toBe('conn-1');
      expect(state.selectedNodeIds.size).toBe(0);
      expect(state.selectedDrawingIds.size).toBe(0);
    });
  });

  describe('selectDrawing', () => {
    it('should select drawing and clear other selections', () => {
      useInvestigationsStore.setState({
        selectedNodeIds: new Set(['node-1']),
        selectedConnectionId: 'conn-1',
      });

      const { selectDrawing } = useInvestigationsStore.getState();
      selectDrawing('draw-1');

      const state = useInvestigationsStore.getState();
      expect(state.selectedDrawingIds).toContain('draw-1');
      expect(state.selectedNodeIds.size).toBe(0);
      expect(state.selectedConnectionId).toBeNull();
    });

    it('should toggle drawing selection with multiSelect', () => {
      useInvestigationsStore.setState({
        selectedDrawingIds: new Set(['draw-1']),
      });

      const { selectDrawing } = useInvestigationsStore.getState();
      selectDrawing('draw-2', true);

      const state = useInvestigationsStore.getState();
      expect(state.selectedDrawingIds).toContain('draw-1');
      expect(state.selectedDrawingIds).toContain('draw-2');
    });
  });

  describe('deleteSelected', () => {
    it('should delete all selected items', async () => {
      const node = createMockNode();
      const connection = createMockConnection();
      const drawing = createMockDrawing();

      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
        nodes: [node],
        connections: [connection],
        drawings: [drawing],
        selectedNodeIds: new Set(['node-1']),
        selectedConnectionId: 'conn-1',
        selectedDrawingIds: new Set(['draw-1']),
      });

      vi.mocked(investigationsApi.deleteNode).mockResolvedValue(undefined);
      vi.mocked(investigationsApi.deleteConnection).mockResolvedValue(undefined);
      vi.mocked(investigationsApi.deleteDrawing).mockResolvedValue(undefined);

      const { deleteSelected } = useInvestigationsStore.getState();
      await deleteSelected();

      const state = useInvestigationsStore.getState();
      expect(state.selectedNodeIds.size).toBe(0);
      expect(state.selectedConnectionId).toBeNull();
      expect(state.selectedDrawingIds.size).toBe(0);
    });

    it('should do nothing when no investigation is loaded', async () => {
      const { deleteSelected } = useInvestigationsStore.getState();
      await deleteSelected();

      expect(investigationsApi.deleteNode).not.toHaveBeenCalled();
    });
  });

  describe('updateNode', () => {
    it('should update node with optimistic update', async () => {
      const node = createMockNode();
      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
        nodes: [node],
      });

      vi.mocked(investigationsApi.updateNode).mockResolvedValue(undefined);

      const { updateNode } = useInvestigationsStore.getState();
      await updateNode('node-1', { x: 500, y: 600 });

      const state = useInvestigationsStore.getState();
      expect(state.nodes[0].x).toBe(500);
      expect(state.nodes[0].y).toBe(600);
    });

    it('should rollback on error', async () => {
      const node = createMockNode({ x: 100, y: 100 });
      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
        nodes: [node],
      });

      vi.mocked(investigationsApi.updateNode).mockRejectedValue(new Error('Failed'));

      const { updateNode } = useInvestigationsStore.getState();
      await updateNode('node-1', { x: 500, y: 600 });

      const state = useInvestigationsStore.getState();
      expect(state.nodes[0].x).toBe(100);
      expect(state.nodes[0].y).toBe(100);
    });

    it('should do nothing when no investigation is loaded', async () => {
      const { updateNode } = useInvestigationsStore.getState();
      await updateNode('node-1', { x: 500 });

      expect(investigationsApi.updateNode).not.toHaveBeenCalled();
    });
  });

  describe('updateNodePosition bounds', () => {
    it('should clamp positions to bounds', () => {
      useInvestigationsStore.setState({
        nodes: [createMockNode()],
      });

      const { updateNodePosition } = useInvestigationsStore.getState();

      // Test exceeding max bounds
      updateNodePosition('node-1', 20000, 20000);
      let node = useInvestigationsStore.getState().nodes[0];
      expect(node.x).toBe(10000);
      expect(node.y).toBe(10000);

      // Test exceeding min bounds
      updateNodePosition('node-1', -20000, -20000);
      node = useInvestigationsStore.getState().nodes[0];
      expect(node.x).toBe(-10000);
      expect(node.y).toBe(-10000);
    });

    it('should handle NaN positions', () => {
      useInvestigationsStore.setState({
        nodes: [createMockNode()],
      });

      const { updateNodePosition } = useInvestigationsStore.getState();
      updateNodePosition('node-1', NaN, NaN);

      const node = useInvestigationsStore.getState().nodes[0];
      expect(node.x).toBe(0);
      expect(node.y).toBe(0);
    });
  });

  describe('bulkAddNodes', () => {
    it('should bulk add nodes successfully', async () => {
      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
      });

      const newNodes = [createMockNode(), createMockNode({ record_id: 'node-2' })];
      vi.mocked(investigationsApi.bulkAddNodes).mockResolvedValue({
        nodes: newNodes,
        added: 2,
        skipped: 0,
      });

      const { bulkAddNodes } = useInvestigationsStore.getState();
      const result = await bulkAddNodes([
        { entity_type: 'person', entity_id: 'p1', x: 0, y: 0 },
        { entity_type: 'person', entity_id: 'p2', x: 100, y: 100 },
      ]);

      expect(result.added).toBe(2);
      expect(result.skipped).toBe(0);
      expect(useInvestigationsStore.getState().nodes).toHaveLength(2);
    });

    it('should return zeros when no investigation is loaded', async () => {
      const { bulkAddNodes } = useInvestigationsStore.getState();
      const result = await bulkAddNodes([]);

      expect(result).toEqual({ added: 0, skipped: 0 });
    });

    it('should handle bulk add error', async () => {
      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
      });

      vi.mocked(investigationsApi.bulkAddNodes).mockRejectedValue(new Error('Bulk add failed'));

      const { bulkAddNodes } = useInvestigationsStore.getState();
      const result = await bulkAddNodes([]);

      expect(result).toEqual({ added: 0, skipped: 0 });
      expect(useInvestigationsStore.getState().error).toBe('Bulk add failed');
    });
  });

  describe('updateConnection', () => {
    it('should update connection with optimistic update', async () => {
      const connection = createMockConnection();
      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
        connections: [connection],
      });

      vi.mocked(investigationsApi.updateConnection).mockResolvedValue(undefined);

      const { updateConnection } = useInvestigationsStore.getState();
      await updateConnection('conn-1', { color: '#ff0000' });

      expect(useInvestigationsStore.getState().connections[0].color).toBe('#ff0000');
    });

    it('should rollback on error', async () => {
      const connection = createMockConnection({ color: '#000000' });
      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
        connections: [connection],
      });

      vi.mocked(investigationsApi.updateConnection).mockRejectedValue(new Error('Failed'));

      const { updateConnection } = useInvestigationsStore.getState();
      await updateConnection('conn-1', { color: '#ff0000' });

      expect(useInvestigationsStore.getState().connections[0].color).toBe('#000000');
    });
  });

  describe('deleteConnection', () => {
    it('should delete connection with optimistic update', async () => {
      const connection = createMockConnection();
      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
        connections: [connection],
        selectedConnectionId: 'conn-1',
      });

      vi.mocked(investigationsApi.deleteConnection).mockResolvedValue(undefined);

      const { deleteConnection } = useInvestigationsStore.getState();
      await deleteConnection('conn-1');

      const state = useInvestigationsStore.getState();
      expect(state.connections).toHaveLength(0);
      expect(state.selectedConnectionId).toBeNull();
    });

    it('should rollback on error', async () => {
      const connection = createMockConnection();
      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
        connections: [connection],
        selectedConnectionId: 'conn-1',
      });

      vi.mocked(investigationsApi.deleteConnection).mockRejectedValue(new Error('Failed'));

      const { deleteConnection } = useInvestigationsStore.getState();
      await deleteConnection('conn-1');

      const state = useInvestigationsStore.getState();
      expect(state.connections).toHaveLength(1);
      expect(state.selectedConnectionId).toBe('conn-1');
    });
  });

  describe('updateDrawing', () => {
    it('should update drawing with optimistic update', async () => {
      const drawing = createMockDrawing();
      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
        drawings: [drawing],
      });

      vi.mocked(investigationsApi.updateDrawing).mockResolvedValue(undefined);

      const { updateDrawing } = useInvestigationsStore.getState();
      await updateDrawing('draw-1', { color: '#00ff00' });

      expect(useInvestigationsStore.getState().drawings[0].color).toBe('#00ff00');
    });

    it('should rollback on error', async () => {
      const drawing = createMockDrawing({ color: '#ff0000' });
      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
        drawings: [drawing],
      });

      vi.mocked(investigationsApi.updateDrawing).mockRejectedValue(new Error('Failed'));

      const { updateDrawing } = useInvestigationsStore.getState();
      await updateDrawing('draw-1', { color: '#00ff00' });

      expect(useInvestigationsStore.getState().drawings[0].color).toBe('#ff0000');
    });
  });

  describe('deleteDrawing', () => {
    it('should delete drawing with optimistic update', async () => {
      const drawing = createMockDrawing();
      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
        drawings: [drawing],
        selectedDrawingIds: new Set(['draw-1']),
      });

      vi.mocked(investigationsApi.deleteDrawing).mockResolvedValue(undefined);

      const { deleteDrawing } = useInvestigationsStore.getState();
      await deleteDrawing('draw-1');

      const state = useInvestigationsStore.getState();
      expect(state.drawings).toHaveLength(0);
      expect(state.selectedDrawingIds.has('draw-1')).toBe(false);
    });

    it('should rollback on error', async () => {
      const drawing = createMockDrawing();
      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
        drawings: [drawing],
        selectedDrawingIds: new Set(['draw-1']),
      });

      vi.mocked(investigationsApi.deleteDrawing).mockRejectedValue(new Error('Failed'));

      const { deleteDrawing } = useInvestigationsStore.getState();
      await deleteDrawing('draw-1');

      const state = useInvestigationsStore.getState();
      expect(state.drawings).toHaveLength(1);
      expect(state.selectedDrawingIds.has('draw-1')).toBe(true);
    });
  });

  describe('batchSaveDrawings', () => {
    it('should batch save drawings successfully', async () => {
      const existingDrawing = createMockDrawing({ record_id: 'draw-existing' });
      const updatedDrawing = createMockDrawing({ record_id: 'draw-1', color: '#00ff00' });

      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
        drawings: [existingDrawing],
      });

      vi.mocked(investigationsApi.batchUpdateDrawings).mockResolvedValue({
        drawings: [updatedDrawing],
      });

      const { batchSaveDrawings } = useInvestigationsStore.getState();
      await batchSaveDrawings([{ record_id: 'draw-1', color: '#00ff00' }]);

      const state = useInvestigationsStore.getState();
      expect(state.drawings).toContainEqual(expect.objectContaining({ record_id: 'draw-1' }));
    });

    it('should handle batch save error', async () => {
      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
      });

      vi.mocked(investigationsApi.batchUpdateDrawings).mockRejectedValue(new Error('Batch failed'));

      const { batchSaveDrawings } = useInvestigationsStore.getState();
      await batchSaveDrawings([]);

      expect(useInvestigationsStore.getState().error).toBe('Batch failed');
    });
  });

  describe('WebSocket connection handlers', () => {
    it('handleConnectionAdded should add connection', () => {
      const connection = createMockConnection();

      const { handleConnectionAdded } = useInvestigationsStore.getState();
      handleConnectionAdded(connection, 'other-user');

      expect(useInvestigationsStore.getState().connections).toContainEqual(connection);
    });

    it('handleConnectionAdded should not duplicate existing connection', () => {
      const connection = createMockConnection();
      useInvestigationsStore.setState({ connections: [connection] });

      const { handleConnectionAdded } = useInvestigationsStore.getState();
      handleConnectionAdded(connection, 'other-user');

      expect(useInvestigationsStore.getState().connections).toHaveLength(1);
    });

    it('handleConnectionUpdated should update connection', () => {
      const connection = createMockConnection({ color: '#000000' });
      useInvestigationsStore.setState({ connections: [connection] });

      const updatedConnection = { ...connection, color: '#ff0000' };
      const { handleConnectionUpdated } = useInvestigationsStore.getState();
      handleConnectionUpdated(updatedConnection, 'other-user');

      expect(useInvestigationsStore.getState().connections[0].color).toBe('#ff0000');
    });

    it('handleConnectionRemoved should remove connection', () => {
      const connection = createMockConnection();
      useInvestigationsStore.setState({
        connections: [connection],
        selectedConnectionId: 'conn-1',
      });

      const { handleConnectionRemoved } = useInvestigationsStore.getState();
      handleConnectionRemoved('conn-1', 'other-user');

      const state = useInvestigationsStore.getState();
      expect(state.connections).toHaveLength(0);
      expect(state.selectedConnectionId).toBeNull();
    });
  });

  describe('WebSocket drawing handlers', () => {
    it('handleDrawingAdded should add drawing', () => {
      const drawing = createMockDrawing();

      const { handleDrawingAdded } = useInvestigationsStore.getState();
      handleDrawingAdded(drawing, 'other-user');

      expect(useInvestigationsStore.getState().drawings).toContainEqual(drawing);
    });

    it('handleDrawingAdded should not duplicate existing drawing', () => {
      const drawing = createMockDrawing();
      useInvestigationsStore.setState({ drawings: [drawing] });

      const { handleDrawingAdded } = useInvestigationsStore.getState();
      handleDrawingAdded(drawing, 'other-user');

      expect(useInvestigationsStore.getState().drawings).toHaveLength(1);
    });

    it('handleDrawingUpdated should update drawing', () => {
      const drawing = createMockDrawing({ color: '#000000' });
      useInvestigationsStore.setState({ drawings: [drawing] });

      const updatedDrawing = { ...drawing, color: '#ff0000' };
      const { handleDrawingUpdated } = useInvestigationsStore.getState();
      handleDrawingUpdated(updatedDrawing, 'other-user');

      expect(useInvestigationsStore.getState().drawings[0].color).toBe('#ff0000');
    });

    it('handleDrawingRemoved should remove drawing', () => {
      const drawing = createMockDrawing();
      useInvestigationsStore.setState({
        drawings: [drawing],
        selectedDrawingIds: new Set(['draw-1']),
      });

      const { handleDrawingRemoved } = useInvestigationsStore.getState();
      handleDrawingRemoved('draw-1', 'other-user');

      const state = useInvestigationsStore.getState();
      expect(state.drawings).toHaveLength(0);
      expect(state.selectedDrawingIds.has('draw-1')).toBe(false);
    });
  });

  describe('handleNodeUpdated', () => {
    it('should update node from WebSocket event', () => {
      const node = createMockNode();
      useInvestigationsStore.setState({ nodes: [node] });

      const updatedNode = { ...node, x: 500, y: 600 };
      const { handleNodeUpdated } = useInvestigationsStore.getState();
      handleNodeUpdated(updatedNode, 'other-user');

      const stateNode = useInvestigationsStore.getState().nodes[0];
      expect(stateNode.x).toBe(500);
      expect(stateNode.y).toBe(600);
    });
  });

  describe('handleNodeRemoved', () => {
    it('should remove node and its connections', () => {
      const node1 = createMockNode({ record_id: 'node-1' });
      const node2 = createMockNode({ record_id: 'node-2' });
      const connection = createMockConnection({ from_node_id: 'node-1', to_node_id: 'node-2' });

      useInvestigationsStore.setState({
        nodes: [node1, node2],
        connections: [connection],
        selectedNodeIds: new Set(['node-1']),
      });

      const { handleNodeRemoved } = useInvestigationsStore.getState();
      handleNodeRemoved('node-1', 'other-user');

      const state = useInvestigationsStore.getState();
      expect(state.nodes).toHaveLength(1);
      expect(state.connections).toHaveLength(0);
      expect(state.selectedNodeIds.has('node-1')).toBe(false);
    });
  });

  describe('handleCanvasStateUpdated', () => {
    it('should update viewport and zoom from WebSocket event', () => {
      const { handleCanvasStateUpdated } = useInvestigationsStore.getState();
      handleCanvasStateUpdated({ zoom: 2, panX: 100, panY: 200 }, 'other-user');

      const state = useInvestigationsStore.getState();
      expect(state.zoom).toBe(2);
      expect(state.viewport).toEqual({ x: 100, y: 200 });
    });
  });

  describe('loadInvestigation with visible_nodes', () => {
    it('should unwrap visible_nodes format', async () => {
      const investigation = createMockInvestigation({
        visible_nodes: [
          {
            node: createMockNode({ record_id: 'node-1' }),
            can_access: true,
            display_mode: 'full',
          },
        ] as unknown as InvestigationNode[],
      });

      vi.mocked(investigationsApi.getInvestigation).mockResolvedValue(investigation);

      const { loadInvestigation } = useInvestigationsStore.getState();
      await loadInvestigation('inv-1');

      const state = useInvestigationsStore.getState();
      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].record_id).toBe('node-1');
      expect((state.nodes[0] as unknown as Record<string, unknown>).can_access).toBe(true);
    });

    it('should handle flat node format in visible_nodes', async () => {
      const flatNode = createMockNode({ record_id: 'node-1' });
      const investigation = createMockInvestigation({
        visible_nodes: [flatNode],
      });

      vi.mocked(investigationsApi.getInvestigation).mockResolvedValue(investigation);

      const { loadInvestigation } = useInvestigationsStore.getState();
      await loadInvestigation('inv-1');

      expect(useInvestigationsStore.getState().nodes[0].record_id).toBe('node-1');
    });
  });

  describe('createConnection duplicate prevention', () => {
    it('should prevent duplicate connections', async () => {
      const existingConnection = createMockConnection({
        from_node_id: 'node-1',
        to_node_id: 'node-2',
      });

      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
        connections: [existingConnection],
      });

      const { createConnection } = useInvestigationsStore.getState();
      const result = await createConnection({
        from_node_id: 'node-1',
        to_node_id: 'node-2',
        from_anchor: 'right',
        to_anchor: 'left',
      });

      expect(result).toBeNull();
      expect(investigationsApi.createConnection).not.toHaveBeenCalled();
    });

    it('should prevent reverse duplicate connections', async () => {
      const existingConnection = createMockConnection({
        from_node_id: 'node-1',
        to_node_id: 'node-2',
      });

      useInvestigationsStore.setState({
        currentInvestigation: createMockInvestigation(),
        connections: [existingConnection],
      });

      const { createConnection } = useInvestigationsStore.getState();
      const result = await createConnection({
        from_node_id: 'node-2',
        to_node_id: 'node-1',
        from_anchor: 'left',
        to_anchor: 'right',
      });

      expect(result).toBeNull();
    });
  });

  describe('deleteInvestigation error handling', () => {
    it('should return false on error', async () => {
      vi.mocked(investigationsApi.deleteInvestigation).mockRejectedValue(new Error('Delete failed'));

      const { deleteInvestigation } = useInvestigationsStore.getState();
      const result = await deleteInvestigation('inv-1');

      expect(result).toBe(false);
      expect(useInvestigationsStore.getState().error).toBe('Delete failed');
    });
  });

  describe('fitToContent with drawings', () => {
    it('should include drawings in bounds calculation', () => {
      useInvestigationsStore.setState({
        nodes: [],
        drawings: [
          createMockDrawing({
            bounds: { left: 0, top: 0, right: 500, bottom: 500 },
          }),
        ],
      });

      const { fitToContent } = useInvestigationsStore.getState();
      fitToContent();

      const state = useInvestigationsStore.getState();
      expect(state.zoom).toBeLessThanOrEqual(1);
    });
  });

  describe('selectByMarquee with drawings', () => {
    it('should select drawings within bounds', () => {
      useInvestigationsStore.setState({
        nodes: [],
        drawings: [
          createMockDrawing({
            record_id: 'draw-1',
            points: [{ x: 50, y: 50 }, { x: 100, y: 100 }],
          }),
          createMockDrawing({
            record_id: 'draw-2',
            points: [{ x: 300, y: 300 }, { x: 400, y: 400 }],
          }),
        ],
      });

      const { selectByMarquee } = useInvestigationsStore.getState();
      selectByMarquee({ x1: 0, y1: 0, x2: 150, y2: 150 });

      const selected = useInvestigationsStore.getState().selectedDrawingIds;
      expect(selected).toContain('draw-1');
      expect(selected).not.toContain('draw-2');
    });

    it('should skip drawings with no points', () => {
      useInvestigationsStore.setState({
        nodes: [],
        drawings: [
          createMockDrawing({
            record_id: 'draw-1',
            points: [],
          }),
        ],
      });

      const { selectByMarquee } = useInvestigationsStore.getState();
      selectByMarquee({ x1: 0, y1: 0, x2: 150, y2: 150 });

      expect(useInvestigationsStore.getState().selectedDrawingIds.size).toBe(0);
    });
  });
});
