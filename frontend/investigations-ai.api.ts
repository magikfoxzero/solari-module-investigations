import apiClient, { unwrapResponse } from '@/api/client';
import type { ApiResponse } from '@/types/api.types';
import type {
  DocumentSummary,
  InvestigationSummary,
  CorrelationAnalysis,
  MindMapGenerationResult,
  ApplyMindMapResult,
  AIDetailLevel,
  GeneratedNode,
  GeneratedConnection,
} from './types';

// ============================================
// AI Features for Investigations
// ============================================

/**
 * Summarize a selected node's content using AI
 */
export const summarizeNode = async (
  investigationId: string,
  nodeId: string
): Promise<DocumentSummary> => {
  const response = await apiClient.post<ApiResponse<DocumentSummary>>(
    `/investigations/${investigationId}/ai/summarize-node`,
    { node_id: nodeId }
  );
  return unwrapResponse(response);
};

/**
 * Summarize an uploaded file using AI
 */
export const summarizeFile = async (
  investigationId: string,
  file: File
): Promise<DocumentSummary> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<ApiResponse<DocumentSummary>>(
    `/investigations/${investigationId}/ai/summarize-file`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return unwrapResponse(response);
};

/**
 * Summarize the entire investigation canvas using AI
 */
export const summarizeInvestigation = async (
  investigationId: string
): Promise<InvestigationSummary> => {
  const response = await apiClient.post<ApiResponse<InvestigationSummary>>(
    `/investigations/${investigationId}/ai/summarize`
  );
  return unwrapResponse(response);
};

/**
 * Analyze correlations and patterns in the investigation using AI
 */
export const analyzeCorrelations = async (
  investigationId: string
): Promise<CorrelationAnalysis> => {
  const response = await apiClient.post<ApiResponse<CorrelationAnalysis>>(
    `/investigations/${investigationId}/ai/correlations`
  );
  return unwrapResponse(response);
};

/**
 * Generate a mind map from an uploaded document using AI
 */
export const generateMindMap = async (
  investigationId: string,
  file: File,
  detailLevel: AIDetailLevel = 'standard'
): Promise<MindMapGenerationResult> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('detail_level', detailLevel);

  const response = await apiClient.post<ApiResponse<MindMapGenerationResult>>(
    `/investigations/${investigationId}/ai/generate`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return unwrapResponse(response);
};

/**
 * Apply generated mind map to the canvas by creating notes and connections.
 * Supports incremental updates - reuses existing nodes when content matches.
 */
export const applyMindMap = async (
  investigationId: string,
  nodes: GeneratedNode[],
  connections: GeneratedConnection[]
): Promise<ApplyMindMapResult> => {
  const response = await apiClient.post<ApiResponse<ApplyMindMapResult>>(
    `/investigations/${investigationId}/ai/apply-mindmap`,
    { nodes, connections }
  );
  return unwrapResponse(response);
};
