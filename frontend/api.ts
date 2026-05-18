import apiClient, { unwrapResponse } from '@/api/client';
import type { ApiResponse, ListParams } from '@/types/api.types';
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
  InvestigationLayout,
  TimelineData,
  GraphData,
  LayoutResult,
  ExistingRelationship,
  InvestigationStatistics,
  SuggestionsAnalysisResult,
  AcceptDuplicateResult,
  AcceptConnectionResult,
} from './types';

// ============================================
// Investigation CRUD (5 endpoints)
// ============================================

// List investigations with pagination
export const listInvestigations = async (params?: ListParams): Promise<{
  investigations: Investigation[];
  pagination: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
    from: number;
    to: number;
  };
}> => {
  const response = await apiClient.get<ApiResponse<{
    investigations: Investigation[];
    pagination: {
      total: number;
      per_page: number;
      current_page: number;
      last_page: number;
      from: number;
      to: number;
    };
  }>>('/investigations', { params });
  return unwrapResponse(response);
};

// Create a new investigation
export const createInvestigation = async (data: InvestigationCreateInput): Promise<Investigation> => {
  const response = await apiClient.post<ApiResponse<{ investigation: Investigation; message: string }>>('/investigations', data);
  const result = unwrapResponse(response);
  return result.investigation;
};

// Get a single investigation by ID (with nodes, connections, drawings)
export const getInvestigation = async (id: string): Promise<Investigation> => {
  const response = await apiClient.get<ApiResponse<{ investigation: Investigation }>>(`/investigations/${id}`);
  const result = unwrapResponse(response);
  return result.investigation;
};

// Update an investigation
export const updateInvestigation = async (id: string, data: InvestigationUpdateInput): Promise<Investigation> => {
  const response = await apiClient.put<ApiResponse<{ investigation: Investigation; message: string }>>(`/investigations/${id}`, data);
  const result = unwrapResponse(response);
  return result.investigation;
};

// Delete an investigation (soft delete)
export const deleteInvestigation = async (id: string): Promise<void> => {
  const response = await apiClient.delete<ApiResponse<null>>(`/investigations/${id}`);
  unwrapResponse(response);
};

// ============================================
// Search, Export, Stats (3 endpoints)
// ============================================

// Search investigations
export const searchInvestigations = async (params: {
  q: string;
  page?: number;
  per_page?: number;
  folder_id?: string;
}): Promise<{
  investigations: Investigation[];
  pagination: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
    from: number;
    to: number;
  };
}> => {
  const response = await apiClient.get<ApiResponse<{
    investigations: Investigation[];
    pagination: {
      total: number;
      per_page: number;
      current_page: number;
      last_page: number;
    };
  }>>('/investigations/search', { params });
  const result = unwrapResponse(response);
  return {
    investigations: result.investigations,
    pagination: {
      ...result.pagination,
      from: (result.pagination.current_page - 1) * result.pagination.per_page + 1,
      to: Math.min(result.pagination.current_page * result.pagination.per_page, result.pagination.total),
    },
  };
};

// Export investigations
export const exportInvestigations = async (params?: {
  format?: 'csv' | 'json';
  with_relations?: boolean;
}): Promise<Blob> => {
  const response = await apiClient.get<ApiResponse<{
    investigations: Investigation[];
    count: number;
    limit: number;
    exported_at: string;
  }>>('/investigations/export', { params });

  const result = unwrapResponse(response);

  // Backend returns raw investigations array, convert to requested format
  const format = params?.format || 'json';
  let content: string;
  let mimeType: string;

  if (format === 'csv') {
    // Convert to CSV format
    const headers = ['record_id', 'title', 'description', 'status', 'priority', 'case_number', 'created_at'];
    const rows = result.investigations.map(inv =>
      headers.map(h => {
        const val = inv[h as keyof Investigation];
        // Escape CSV values
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val ?? '';
      }).join(',')
    );
    content = [headers.join(','), ...rows].join('\n');
    mimeType = 'text/csv';
  } else {
    content = JSON.stringify(result.investigations, null, 2);
    mimeType = 'application/json';
  }

  return new Blob([content], { type: mimeType });
};

// Get investigation statistics
export const getInvestigationStats = async (): Promise<InvestigationStatistics> => {
  const response = await apiClient.get<ApiResponse<{ statistics: InvestigationStatistics }>>('/investigations/stats');
  const result = unwrapResponse(response);
  return result.statistics;
};

// ============================================
// Canvas State (1 endpoint)
// ============================================

// Update canvas state (zoom, pan, layout)
export const updateCanvasState = async (id: string, canvasState: CanvasState): Promise<CanvasState> => {
  const response = await apiClient.put<ApiResponse<{ canvas_state: CanvasState; message: string }>>(
    `/investigations/${id}/canvas`,
    { canvas_state: canvasState }
  );
  const result = unwrapResponse(response);
  return result.canvas_state;
};

// ============================================
// Node Management (5 endpoints)
// ============================================

// Add a node to the canvas
export const addNode = async (investigationId: string, data: InvestigationNodeCreateInput): Promise<InvestigationNode> => {
  const response = await apiClient.post<ApiResponse<{ node: InvestigationNode; message: string }>>(
    `/investigations/${investigationId}/nodes`,
    data
  );
  const result = unwrapResponse(response);
  return result.node;
};

// Update a node
export const updateNode = async (
  investigationId: string,
  nodeId: string,
  data: InvestigationNodeUpdateInput
): Promise<InvestigationNode> => {
  const response = await apiClient.put<ApiResponse<{ node: InvestigationNode; message: string }>>(
    `/investigations/${investigationId}/nodes/${nodeId}`,
    data
  );
  const result = unwrapResponse(response);
  return result.node;
};

// Delete a node
export const deleteNode = async (investigationId: string, nodeId: string): Promise<void> => {
  const response = await apiClient.delete<ApiResponse<null>>(
    `/investigations/${investigationId}/nodes/${nodeId}`
  );
  unwrapResponse(response);
};

// Bulk add nodes (max 100)
export const bulkAddNodes = async (
  investigationId: string,
  nodes: BulkNodeInput[]
): Promise<{ nodes: InvestigationNode[]; added: number; skipped: number }> => {
  const response = await apiClient.post<ApiResponse<{
    nodes: InvestigationNode[];
    added: number;
    skipped: number;
    message: string;
  }>>(`/investigations/${investigationId}/nodes/bulk`, { nodes });
  const result = unwrapResponse(response);
  return {
    nodes: result.nodes,
    added: result.added,
    skipped: result.skipped,
  };
};

// Batch update node positions
export const updateNodePositions = async (
  investigationId: string,
  positions: NodePositionUpdate[]
): Promise<{ updated: number }> => {
  const response = await apiClient.put<ApiResponse<{ updated: number; message: string }>>(
    `/investigations/${investigationId}/nodes/positions`,
    { positions }
  );
  const result = unwrapResponse(response);
  return { updated: result.updated };
};

// ============================================
// Connection Management (3 endpoints)
// ============================================

// Create a connection
export const createConnection = async (
  investigationId: string,
  data: InvestigationConnectionCreateInput
): Promise<InvestigationConnection> => {
  const response = await apiClient.post<ApiResponse<{ connection: InvestigationConnection; message: string }>>(
    `/investigations/${investigationId}/connections`,
    data
  );
  const result = unwrapResponse(response);
  return result.connection;
};

// Update a connection
export const updateConnection = async (
  investigationId: string,
  connectionId: string,
  data: InvestigationConnectionUpdateInput
): Promise<InvestigationConnection> => {
  const response = await apiClient.put<ApiResponse<{ connection: InvestigationConnection; message: string }>>(
    `/investigations/${investigationId}/connections/${connectionId}`,
    data
  );
  const result = unwrapResponse(response);
  return result.connection;
};

// Delete a connection
export const deleteConnection = async (investigationId: string, connectionId: string): Promise<void> => {
  const response = await apiClient.delete<ApiResponse<null>>(
    `/investigations/${investigationId}/connections/${connectionId}`
  );
  unwrapResponse(response);
};

// ============================================
// Drawing Management (4 endpoints)
// ============================================

// Add a drawing
export const addDrawing = async (
  investigationId: string,
  data: InvestigationDrawingCreateInput
): Promise<InvestigationDrawing> => {
  const response = await apiClient.post<ApiResponse<{ drawing: InvestigationDrawing; message: string }>>(
    `/investigations/${investigationId}/drawings`,
    data
  );
  const result = unwrapResponse(response);
  return result.drawing;
};

// Update a drawing
export const updateDrawing = async (
  investigationId: string,
  drawingId: string,
  data: InvestigationDrawingUpdateInput
): Promise<InvestigationDrawing> => {
  const response = await apiClient.put<ApiResponse<{ drawing: InvestigationDrawing; message: string }>>(
    `/investigations/${investigationId}/drawings/${drawingId}`,
    data
  );
  const result = unwrapResponse(response);
  return result.drawing;
};

// Delete a drawing
export const deleteDrawing = async (investigationId: string, drawingId: string): Promise<void> => {
  const response = await apiClient.delete<ApiResponse<null>>(
    `/investigations/${investigationId}/drawings/${drawingId}`
  );
  unwrapResponse(response);
};

// Batch create/update drawings
export const batchUpdateDrawings = async (
  investigationId: string,
  drawings: BatchDrawingInput[]
): Promise<{ drawings: InvestigationDrawing[]; created: number; updated: number }> => {
  const response = await apiClient.put<ApiResponse<{
    drawings: InvestigationDrawing[];
    created: number;
    updated: number;
    message: string;
  }>>(`/investigations/${investigationId}/drawings/batch`, { drawings });
  const result = unwrapResponse(response);
  return {
    drawings: result.drawings,
    created: result.created,
    updated: result.updated,
  };
};

// ============================================
// Visualization Data (3 endpoints)
// ============================================

// Get timeline data
export const getTimeline = async (
  investigationId: string,
  params?: {
    group_by?: 'day' | 'week' | 'month' | 'year';
    start_date?: string;
    end_date?: string;
  }
): Promise<TimelineData> => {
  const response = await apiClient.get<ApiResponse<TimelineData>>(
    `/investigations/${investigationId}/timeline`,
    { params }
  );
  return unwrapResponse(response);
};

// Get graph data (nodes, connections, drawings, bounds)
export const getGraph = async (investigationId: string): Promise<GraphData> => {
  const response = await apiClient.get<ApiResponse<{ graph: GraphData }>>(
    `/investigations/${investigationId}/graph`
  );
  const result = unwrapResponse(response);
  return result.graph;
};

// Apply auto-layout
export const applyLayout = async (
  investigationId: string,
  layoutType: InvestigationLayout,
  options?: {
    node_spacing?: number;
    animation?: boolean;
  }
): Promise<LayoutResult> => {
  const response = await apiClient.post<ApiResponse<{ layout: LayoutResult; message: string }>>(
    `/investigations/${investigationId}/layout`,
    { layout_type: layoutType, ...options }
  );
  const result = unwrapResponse(response);
  return result.layout;
};

// ============================================
// Relationship Detection (1 endpoint)
// ============================================

// Find existing relationships between entities on canvas
export const findExistingRelationships = async (investigationId: string): Promise<{
  relationships: ExistingRelationship[];
  count: number;
}> => {
  const response = await apiClient.get<ApiResponse<{
    relationships: ExistingRelationship[];
    count: number;
  }>>(`/investigations/${investigationId}/relationships/existing`);
  return unwrapResponse(response);
};

// ============================================
// AI Suggestions (Duplicates & Connections)
// ============================================

// Analyze investigation for duplicate entities and missing connections
export const analyzeSuggestions = async (investigationId: string): Promise<SuggestionsAnalysisResult> => {
  const response = await apiClient.post<ApiResponse<SuggestionsAnalysisResult>>(
    `/investigations/${investigationId}/ai/analyze-suggestions`
  );
  return unwrapResponse(response);
};

// Accept a duplicate suggestion (merge nodes)
export const acceptDuplicateSuggestion = async (
  investigationId: string,
  keepNodeId: string,
  deleteNodeId: string
): Promise<AcceptDuplicateResult> => {
  const response = await apiClient.post<ApiResponse<AcceptDuplicateResult>>(
    `/investigations/${investigationId}/ai/accept-duplicate`,
    { keepNodeId, deleteNodeId }
  );
  return unwrapResponse(response);
};

// Accept a connection suggestion (create connection)
export const acceptConnectionSuggestion = async (
  investigationId: string,
  fromNodeId: string,
  toNodeId: string,
  relationshipType: string,
  relationshipLabel: string
): Promise<AcceptConnectionResult> => {
  const response = await apiClient.post<ApiResponse<AcceptConnectionResult>>(
    `/investigations/${investigationId}/ai/accept-connection`,
    { fromNodeId, toNodeId, relationshipType, relationshipLabel }
  );
  return unwrapResponse(response);
};
