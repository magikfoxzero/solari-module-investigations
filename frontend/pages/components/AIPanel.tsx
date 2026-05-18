import { useState, useCallback, useRef } from 'react';
import { X, Sparkles, FileText, Network, Wand2, Upload, Loader2, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Lightbulb, Link2, Save, GitMerge } from 'lucide-react';
import { useInvestigationsStore } from '@/modules/investigations/store';
import {
  summarizeNode,
  summarizeInvestigation,
  analyzeCorrelations,
  generateMindMap,
  summarizeFile,
  applyMindMap,
} from '../../investigations-ai.api';
import { SuggestionsWizardModal } from './SuggestionsWizardModal';
import type {
  DocumentSummary,
  InvestigationSummary,
  CorrelationAnalysis,
  MindMapGenerationResult,
  ApplyMindMapResult,
  AIDetailLevel,
} from '@/modules/investigations/types';

interface AIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onMindMapGenerated?: (result: MindMapGenerationResult) => void;
}

type AIOperation = 'idle' | 'summarize-node' | 'summarize-file' | 'summarize-investigation' | 'correlations' | 'generate' | 'applying';

interface ResultSection {
  id: string;
  type: 'summary' | 'investigation' | 'correlations' | 'mindmap' | 'applied';
  data: DocumentSummary | InvestigationSummary | CorrelationAnalysis | MindMapGenerationResult | ApplyMindMapResult;
  timestamp: Date;
}

export function AIPanel({ isOpen, onClose, onMindMapGenerated }: AIPanelProps) {
  const { currentInvestigation, selectedNodeIds, nodes, loadInvestigation } = useInvestigationsStore();

  const [operation, setOperation] = useState<AIOperation>('idle');
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ResultSection[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const [detailLevel, setDetailLevel] = useState<AIDetailLevel>('standard');
  const [showSuggestionsWizard, setShowSuggestionsWizard] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const generateFileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = operation !== 'idle';

  // Get the first selected node
  const selectedNodeId = selectedNodeIds.size > 0 ? Array.from(selectedNodeIds)[0] : null;
  const selectedNode = selectedNodeId ? nodes.find(n => n.record_id === selectedNodeId) : null;

  const toggleSection = (index: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const addResult = (type: ResultSection['type'], data: ResultSection['data']) => {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setResults(prev => [{ id, type, data, timestamp: new Date() }, ...prev]);
    setExpandedSections(new Set([0])); // Expand the new result
  };

  // Summarize selected node
  const handleSummarizeNode = useCallback(async () => {
    if (!currentInvestigation || !selectedNodeId) return;

    setOperation('summarize-node');
    setError(null);

    try {
      const result = await summarizeNode(currentInvestigation.record_id, selectedNodeId);
      addResult('summary', result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to summarize node');
    } finally {
      setOperation('idle');
    }
  }, [currentInvestigation, selectedNodeId]);

  // Summarize file
  const handleSummarizeFile = useCallback(async (file: File) => {
    if (!currentInvestigation) return;

    setOperation('summarize-file');
    setError(null);

    try {
      const result = await summarizeFile(currentInvestigation.record_id, file);
      addResult('summary', result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to summarize file');
    } finally {
      setOperation('idle');
    }
  }, [currentInvestigation]);

  // Summarize investigation
  const handleSummarizeInvestigation = useCallback(async () => {
    if (!currentInvestigation) return;

    setOperation('summarize-investigation');
    setError(null);

    try {
      const result = await summarizeInvestigation(currentInvestigation.record_id);
      addResult('investigation', result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to summarize investigation');
    } finally {
      setOperation('idle');
    }
  }, [currentInvestigation]);

  // Analyze correlations
  const handleAnalyzeCorrelations = useCallback(async () => {
    if (!currentInvestigation) return;

    setOperation('correlations');
    setError(null);

    try {
      const result = await analyzeCorrelations(currentInvestigation.record_id);
      addResult('correlations', result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze correlations');
    } finally {
      setOperation('idle');
    }
  }, [currentInvestigation]);

  // Generate mind map and automatically apply to canvas
  const handleGenerateMindMap = useCallback(async (file: File) => {
    if (!currentInvestigation) return;

    setOperation('generate');
    setError(null);

    try {
      // Step 1: Generate the mind map from the document
      const result = await generateMindMap(currentInvestigation.record_id, file, detailLevel);
      addResult('mindmap', result);
      onMindMapGenerated?.(result);

      // Step 2: Automatically apply to canvas (create notes and add to canvas)
      if (result.nodes.length > 0) {
        setOperation('applying');
        const applyResult = await applyMindMap(
          currentInvestigation.record_id,
          result.nodes,
          result.connections
        );
        addResult('applied', applyResult);

        // Step 3: Reload investigation to reflect new nodes and connections
        await loadInvestigation(currentInvestigation.record_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate mind map');
    } finally {
      setOperation('idle');
    }
  }, [currentInvestigation, detailLevel, onMindMapGenerated, loadInvestigation]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, action: 'summarize' | 'generate') => {
    const file = event.target.files?.[0];
    if (file) {
      if (action === 'summarize') {
        handleSummarizeFile(file);
      } else {
        handleGenerateMindMap(file);
      }
    }
    // Reset the input
    event.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-4 right-4 w-96 max-h-[calc(100vh-8rem)] bg-space-800 rounded-lg shadow-xl border border-space-600 flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-space-600 bg-space-750">
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-accent" />
          <h3 className="font-semibold text-space-100">AI Assistant</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-space-600 transition-colors"
          title="Close"
        >
          <X size={18} className="text-space-300" />
        </button>
      </div>

      {/* Actions */}
      <div className="p-4 border-b border-space-600 space-y-3">
        {/* Summarize Selected Node */}
        <button
          onClick={handleSummarizeNode}
          disabled={isLoading || !selectedNode}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-space-700 hover:bg-space-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
        >
          {operation === 'summarize-node' ? (
            <Loader2 size={18} className="text-accent animate-spin" />
          ) : (
            <FileText size={18} className="text-blue-400" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-space-100">Summarize Node</div>
            <div className="text-xs text-space-400 truncate">
              {selectedNode ? `Analyze: ${selectedNode.entity_type}` : 'Select a node first'}
            </div>
          </div>
        </button>

        {/* Summarize File */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-space-700 hover:bg-space-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
        >
          {operation === 'summarize-file' ? (
            <Loader2 size={18} className="text-accent animate-spin" />
          ) : (
            <Upload size={18} className="text-green-400" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-space-100">Summarize File</div>
            <div className="text-xs text-space-400">Upload a document or image</div>
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,.json,.xml,image/*"
          onChange={(e) => handleFileChange(e, 'summarize')}
          className="hidden"
        />

        {/* Summarize Investigation */}
        <button
          onClick={handleSummarizeInvestigation}
          disabled={isLoading || nodes.length === 0}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-space-700 hover:bg-space-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
        >
          {operation === 'summarize-investigation' ? (
            <Loader2 size={18} className="text-accent animate-spin" />
          ) : (
            <Network size={18} className="text-purple-400" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-space-100">Summarize Canvas</div>
            <div className="text-xs text-space-400">
              {nodes.length > 0 ? `Analyze ${nodes.length} nodes` : 'Add nodes to canvas first'}
            </div>
          </div>
        </button>

        {/* Analyze Correlations */}
        <button
          onClick={handleAnalyzeCorrelations}
          disabled={isLoading || nodes.length < 2}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-space-700 hover:bg-space-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
        >
          {operation === 'correlations' ? (
            <Loader2 size={18} className="text-accent animate-spin" />
          ) : (
            <Link2 size={18} className="text-orange-400" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-space-100">Find Correlations</div>
            <div className="text-xs text-space-400">
              {nodes.length >= 2 ? 'Discover patterns & clusters' : 'Need at least 2 nodes'}
            </div>
          </div>
        </button>

        {/* Find Duplicates & Connections */}
        <button
          onClick={() => setShowSuggestionsWizard(true)}
          disabled={isLoading || nodes.length < 2}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-space-700 hover:bg-space-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
        >
          <GitMerge size={18} className="text-cyan-400" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-space-100">Find Duplicates & Links</div>
            <div className="text-xs text-space-400">
              {nodes.length >= 2 ? 'Merge duplicates, add missing connections' : 'Need at least 2 nodes'}
            </div>
          </div>
        </button>

        {/* Generate Mind Map */}
        <div className="space-y-2">
          <button
            onClick={() => generateFileInputRef.current?.click()}
            disabled={isLoading}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent/20 to-purple-500/20 border border-accent/30 hover:from-accent/30 hover:to-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
          >
            {operation === 'generate' || operation === 'applying' ? (
              <Loader2 size={18} className="text-accent animate-spin" />
            ) : (
              <Wand2 size={18} className="text-accent" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-space-100">
                {operation === 'applying' ? 'Adding to Canvas...' : 'Generate Mind Map'}
              </div>
              <div className="text-xs text-space-400">
                {operation === 'generate' ? 'Extracting entities...' :
                 operation === 'applying' ? 'Creating notes & connections' :
                 'Extract entities from a document'}
              </div>
            </div>
          </button>
          <div className="flex items-center gap-2 px-2">
            <span className="text-xs text-space-400">Detail:</span>
            <select
              value={detailLevel}
              onChange={(e) => setDetailLevel(e.target.value as AIDetailLevel)}
              className="flex-1 text-xs bg-space-700 border border-space-600 rounded px-2 py-1 text-space-200"
            >
              <option value="brief">Brief (5-10 nodes)</option>
              <option value="standard">Standard (10-20 nodes)</option>
              <option value="comprehensive">Comprehensive (15-30 nodes)</option>
            </select>
          </div>
        </div>
        <input
          ref={generateFileInputRef}
          type="file"
          accept=".pdf,.txt,.md,.json,.xml,image/*"
          onChange={(e) => handleFileChange(e, 'generate')}
          className="hidden"
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {results.length === 0 ? (
          <div className="text-center py-8 text-space-400">
            <Sparkles size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">AI results will appear here</p>
          </div>
        ) : (
          results.map((result, index) => (
            <ResultCard
              key={result.id}
              result={result}
              isExpanded={expandedSections.has(index)}
              onToggle={() => toggleSection(index)}
            />
          ))
        )}
      </div>

      {/* Suggestions Wizard Modal */}
      <SuggestionsWizardModal
        isOpen={showSuggestionsWizard}
        onClose={() => setShowSuggestionsWizard(false)}
      />
    </div>
  );
}

// Result Card Component
interface ResultCardProps {
  result: ResultSection;
  isExpanded: boolean;
  onToggle: () => void;
}

function ResultCard({ result, isExpanded, onToggle }: ResultCardProps) {
  const getTitle = () => {
    switch (result.type) {
      case 'summary': return 'Summary';
      case 'investigation': return 'Investigation Summary';
      case 'correlations': return 'Correlation Analysis';
      case 'mindmap': return 'Mind Map Generated';
      case 'applied': return 'Added to Canvas';
    }
  };

  const getIcon = () => {
    switch (result.type) {
      case 'summary': return <FileText size={16} className="text-blue-400" />;
      case 'investigation': return <Network size={16} className="text-purple-400" />;
      case 'correlations': return <Link2 size={16} className="text-orange-400" />;
      case 'mindmap': return <Wand2 size={16} className="text-accent" />;
      case 'applied': return <Save size={16} className="text-green-400" />;
    }
  };

  return (
    <div className="bg-space-700 rounded-lg border border-space-600 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-space-650 transition-colors"
      >
        {getIcon()}
        <span className="flex-1 text-left text-sm font-medium text-space-100">{getTitle()}</span>
        <span className="text-xs text-space-400">
          {result.timestamp.toLocaleTimeString()}
        </span>
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          {result.type === 'summary' && <SummaryContent data={result.data as DocumentSummary} />}
          {result.type === 'investigation' && <InvestigationContent data={result.data as InvestigationSummary} />}
          {result.type === 'correlations' && <CorrelationsContent data={result.data as CorrelationAnalysis} />}
          {result.type === 'mindmap' && <MindMapContent data={result.data as MindMapGenerationResult} />}
          {result.type === 'applied' && <AppliedContent data={result.data as ApplyMindMapResult} />}
        </div>
      )}
    </div>
  );
}

// Content Components
function SummaryContent({ data }: { data: DocumentSummary }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-space-200">{data.summary}</p>
      {data.keyPoints.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-space-400 mb-1">Key Points</h4>
          <ul className="space-y-1">
            {data.keyPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-space-300">
                <CheckCircle2 size={12} className="text-green-400 mt-0.5 flex-shrink-0" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function InvestigationContent({ data }: { data: InvestigationSummary }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-space-200">{data.overview}</p>

      <div className="flex gap-4 text-xs">
        <div className="bg-space-600 px-2 py-1 rounded">
          <span className="text-space-400">Nodes:</span>{' '}
          <span className="text-space-100 font-medium">{data.totalNodes}</span>
        </div>
        <div className="bg-space-600 px-2 py-1 rounded">
          <span className="text-space-400">Connections:</span>{' '}
          <span className="text-space-100 font-medium">{data.totalConnections}</span>
        </div>
      </div>

      {data.mainThemes.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-space-400 mb-1">Main Themes</h4>
          <div className="flex flex-wrap gap-1">
            {data.mainThemes.map((theme, i) => (
              <span key={i} className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded">
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.suggestions.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-space-400 mb-1">Suggestions</h4>
          <ul className="space-y-1">
            {data.suggestions.map((suggestion, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-space-300">
                <Lightbulb size={12} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CorrelationsContent({ data }: { data: CorrelationAnalysis }) {
  return (
    <div className="space-y-3">
      {data.clusters.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-space-400 mb-1">Clusters Found</h4>
          <div className="space-y-2">
            {data.clusters.map((cluster, i) => (
              <div key={i} className="bg-space-600 p-2 rounded">
                <div className="text-sm font-medium text-space-100">{cluster.theme}</div>
                <div className="text-xs text-space-300 mt-1">{cluster.description}</div>
                <div className="text-xs text-space-400 mt-1">
                  {cluster.nodeIds.length} nodes
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.insights.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-space-400 mb-1">Insights</h4>
          <ul className="space-y-1">
            {data.insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-space-300">
                <CheckCircle2 size={12} className="text-blue-400 mt-0.5 flex-shrink-0" />
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.recommendations.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-space-400 mb-1">Recommendations</h4>
          <ul className="space-y-1">
            {data.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-space-300">
                <Lightbulb size={12} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MindMapContent({ data }: { data: MindMapGenerationResult }) {
  return (
    <div className="space-y-3">
      <div className="bg-accent/10 border border-accent/20 rounded p-2">
        <div className="text-sm font-medium text-accent">{data.mainTopic.title}</div>
        <div className="text-xs text-space-300 mt-1">{data.mainTopic.description}</div>
      </div>

      <div className="flex gap-4 text-xs">
        <div className="bg-space-600 px-2 py-1 rounded">
          <span className="text-space-400">Entities:</span>{' '}
          <span className="text-space-100 font-medium">{data.nodes.length}</span>
        </div>
        <div className="bg-space-600 px-2 py-1 rounded">
          <span className="text-space-400">Relationships:</span>{' '}
          <span className="text-space-100 font-medium">{data.connections.length}</span>
        </div>
      </div>

      {/* Show extracted entities */}
      {data.nodes.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-space-400 mb-1">Extracted Entities</h4>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {data.nodes.slice(0, 10).map((node, i) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-space-600 px-2 py-1 rounded">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  node.type === 'person' ? 'bg-blue-500/20 text-blue-300' :
                  node.type === 'place' ? 'bg-green-500/20 text-green-300' :
                  node.type === 'organization' ? 'bg-purple-500/20 text-purple-300' :
                  node.type === 'event' ? 'bg-red-500/20 text-red-300' :
                  'bg-yellow-500/20 text-yellow-300'
                }`}>{node.type}</span>
                <span className="text-space-200 truncate">{node.content}</span>
              </div>
            ))}
            {data.nodes.length > 10 && (
              <div className="text-xs text-space-400 text-center py-1">
                +{data.nodes.length - 10} more entities
              </div>
            )}
          </div>
        </div>
      )}

      <div className="text-xs text-green-400 flex items-center gap-1">
        <CheckCircle2 size={12} />
        <span>Entities extracted - adding to canvas automatically...</span>
      </div>
    </div>
  );
}

function AppliedContent({ data }: { data: ApplyMindMapResult }) {
  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="flex flex-wrap gap-2 text-xs">
        {data.nodesCreated > 0 && (
          <div className="bg-green-500/20 text-green-300 px-2 py-1 rounded flex items-center gap-1">
            <CheckCircle2 size={12} />
            <span>{data.nodesCreated} new {data.nodesCreated === 1 ? 'node' : 'nodes'}</span>
          </div>
        )}
        {data.nodesReused > 0 && (
          <div className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded flex items-center gap-1">
            <Link2 size={12} />
            <span>{data.nodesReused} reused</span>
          </div>
        )}
        {data.connectionsCreated > 0 && (
          <div className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded flex items-center gap-1">
            <Network size={12} />
            <span>{data.connectionsCreated} {data.connectionsCreated === 1 ? 'connection' : 'connections'}</span>
          </div>
        )}
        {data.connectionsSkipped > 0 && (
          <div className="bg-space-600 text-space-400 px-2 py-1 rounded">
            {data.connectionsSkipped} existing connections
          </div>
        )}
      </div>

      {/* Created nodes list */}
      {data.nodes.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-space-400 mb-1">Created Notes</h4>
          <div className="max-h-24 overflow-y-auto space-y-1">
            {data.nodes.slice(0, 5).map((node) => (
              <div key={node.id} className="flex items-center gap-2 text-xs bg-space-600 px-2 py-1 rounded">
                <CheckCircle2 size={12} className="text-green-400 flex-shrink-0" />
                <span className="text-space-200 truncate">{node.title}</span>
              </div>
            ))}
            {data.nodes.length > 5 && (
              <div className="text-xs text-space-400 text-center py-1">
                +{data.nodes.length - 5} more notes created
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reused nodes */}
      {data.reusedNodes.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-space-400 mb-1">Existing Nodes Linked</h4>
          <div className="max-h-20 overflow-y-auto space-y-1">
            {data.reusedNodes.slice(0, 3).map((node) => (
              <div key={node.id} className="flex items-center gap-2 text-xs bg-space-600 px-2 py-1 rounded">
                <Link2 size={12} className="text-blue-400 flex-shrink-0" />
                <span className="text-space-300 truncate">{node.title}</span>
              </div>
            ))}
            {data.reusedNodes.length > 3 && (
              <div className="text-xs text-space-400 text-center py-1">
                +{data.reusedNodes.length - 3} more linked
              </div>
            )}
          </div>
        </div>
      )}

      <div className="text-xs text-green-400 flex items-center gap-1 pt-1">
        <CheckCircle2 size={12} />
        <span>Canvas updated successfully</span>
      </div>
    </div>
  );
}
