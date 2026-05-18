import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { LoadingRocket } from '@/components/common/LoadingRocket';
import { useInvestigationsStore } from '@/modules/investigations/store';
import { toast } from '@/store/toastStore';
import { confirmAction } from '@/store/uiStore';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { ZoomControls } from './components/ZoomControls';
import { PresenceIndicator } from './components/PresenceIndicator';
import { EntitySearchPanel } from './components/EntitySearchPanel';
import { DrawingToolsPanel } from './components/DrawingToolsPanel';
import { ConnectionStylePanel } from './components/ConnectionStylePanel';
import { ConnectionPropertiesPanel } from './components/ConnectionPropertiesPanel';
import { NodePropertiesPanel } from './components/NodePropertiesPanel';
import { TimelinePanel } from './components/TimelinePanel';
import { InvestigationFormModal } from './components/InvestigationFormModal';
import { AssociatedRecordsDrawer } from './components/AssociatedRecordsDrawer';
import { AIPanel } from './components/AIPanel';
import { useInvestigationsWebSocket } from './hooks/useInvestigationsWebSocket';
import {
  ArrowLeft,
  Settings,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { ShareButton } from '@/components/common/ShareButton';

export function InvestigationCanvasPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  // Panel states
  const [showEntityPanel, setShowEntityPanel] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTimelinePanel, setShowTimelinePanel] = useState(false);
  const [showRecordsDrawer, setShowRecordsDrawer] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);

  const {
    currentInvestigation,
    graphLoading,
    error,
    currentTool,
    loadInvestigation,
    clearCurrentInvestigation,
    clearError,
    deleteInvestigation,
  } = useInvestigationsStore();

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteInvestigation = async () => {
    if (!currentInvestigation) return;

    const confirmed = await confirmAction({
      title: 'Delete Investigation',
      message: `Are you sure you want to delete "${currentInvestigation.title}"? This will permanently remove the investigation and all its canvas data (nodes, connections, and drawings). This action cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const success = await deleteInvestigation(currentInvestigation.record_id);
      if (success) {
        navigate('/apps/investigations');
      } else {
        toast.error('Delete failed', 'Failed to delete investigation. Please try again.');
      }
    } catch (err) {
      console.error('Delete investigation error:', err);
      toast.error('Error', err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  // Connect to WebSocket for real-time updates
  useInvestigationsWebSocket(id || null);

  // Load investigation on mount
  useEffect(() => {
    if (id) {
      loadInvestigation(id);
    }

    return () => {
      clearCurrentInvestigation();
    };
  }, [id, loadInvestigation, clearCurrentInvestigation]);

  // Handle loading state
  if (graphLoading && !currentInvestigation) {
    return (
      <div className="h-screen flex items-center justify-center bg-space-900">
        <LoadingRocket text="Loading investigation..." />
      </div>
    );
  }

  // Handle error state
  if (error && !currentInvestigation) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-space-900 gap-4">
        <AlertCircle size={48} className="text-red-400" />
        <p className="text-red-400 text-lg">{error}</p>
        <button
          onClick={() => navigate('/apps/investigations')}
          className="btn-gradient px-4 py-2"
        >
          Back to Investigations
        </button>
      </div>
    );
  }

  // Handle not found
  if (!currentInvestigation && !graphLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-space-900 gap-4">
        <AlertCircle size={48} className="text-yellow-400" />
        <p className="text-space-300 text-lg">Investigation not found</p>
        <button
          onClick={() => navigate('/apps/investigations')}
          className="btn-gradient px-4 py-2"
        >
          Back to Investigations
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-screen flex flex-col bg-space-900 overflow-hidden"
    >
      {/* Header Bar */}
      <header className="flex-shrink-0 h-14 bg-space-800 border-b border-space-700 flex items-center justify-between px-2 md:px-4 z-50">
        {/* Left: Back + Title */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <Link
            to="/apps/investigations"
            className="p-1.5 md:p-2 hover:bg-space-700 rounded-lg transition-colors flex-shrink-0"
            title="Back to Investigations"
          >
            <ArrowLeft size={18} className="md:w-5 md:h-5" />
          </Link>
          <div className="h-6 w-px bg-space-600 hidden md:block" />
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold text-space-100 truncate max-w-[120px] sm:max-w-[200px] md:max-w-[300px] text-sm md:text-base">
              {currentInvestigation?.title || 'Investigation'}
            </h1>
            {currentInvestigation?.case_number && (
              <p className="text-xs text-space-400 font-mono hidden sm:block">
                {currentInvestigation.case_number}
              </p>
            )}
          </div>
        </div>

        {/* Center: Status Badge */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden md:block">
          <StatusBadge status={currentInvestigation?.status || 'open'} />
        </div>

        {/* Right: Presence + Share + Settings */}
        <div className="flex items-center gap-1 md:gap-3 flex-shrink-0">
          <div className="hidden sm:block">
            <PresenceIndicator />
          </div>
          <div className="h-6 w-px bg-space-600 hidden sm:block" />
          {currentInvestigation && (
            <div className="hidden sm:block">
              <ShareButton
                entityType="investigation"
                entityId={currentInvestigation.record_id}
                entityName={currentInvestigation.title}
              />
            </div>
          )}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-1.5 md:p-2 hover:bg-space-700 rounded-lg transition-colors"
            title="Edit Investigation Settings"
          >
            <Settings size={18} className="md:w-5 md:h-5" />
          </button>
          <button
            onClick={handleDeleteInvestigation}
            disabled={isDeleting}
            className="p-1.5 md:p-2 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
            title="Delete Investigation"
          >
            <Trash2 size={18} className={`md:w-5 md:h-5 ${isDeleting ? 'text-space-400 animate-pulse' : 'text-red-400'}`} />
          </button>
        </div>
      </header>

      {/* Canvas Area */}
      <div className="flex-1 relative">
        {/* Floating Toolbar */}
        <div className="absolute top-4 left-4 z-40">
          <Toolbar
            onAddEntity={() => setShowEntityPanel(prev => !prev)}
            onToggleTimeline={() => setShowTimelinePanel(prev => !prev)}
            isTimelineOpen={showTimelinePanel}
            onToggleRecords={() => setShowRecordsDrawer(prev => !prev)}
            isRecordsOpen={showRecordsDrawer}
            onToggleAI={() => setShowAIPanel(prev => !prev)}
            isAIOpen={showAIPanel}
          />
        </div>

        {/* Entity Search Panel */}
        <EntitySearchPanel
          isOpen={showEntityPanel}
          onClose={() => setShowEntityPanel(false)}
        />

        {/* Drawing Tools Panel (shown when draw tool is active) */}
        <DrawingToolsPanel isOpen={currentTool === 'draw' && !showEntityPanel} />

        {/* Connection Style Panel (shown when connect tool is active) */}
        <ConnectionStylePanel isOpen={currentTool === 'connect' && !showEntityPanel} />

        {/* Connection Properties Panel (shown when a connection is selected) */}
        <ConnectionPropertiesPanel />

        {/* Node Properties Panel (shown when a single node is selected) */}
        <NodePropertiesPanel />

        {/* Zoom Controls */}
        <div className={`absolute bottom-4 right-2 md:right-4 z-40 transition-all ${showTimelinePanel ? 'mb-[50vh]' : ''}`}>
          <ZoomControls />
        </div>

        {/* Main Canvas */}
        <Canvas containerRef={containerRef} />

        {/* Timeline Panel */}
        <TimelinePanel
          isOpen={showTimelinePanel}
          onClose={() => setShowTimelinePanel(false)}
        />

        {/* AI Assistant Panel */}
        <AIPanel
          isOpen={showAIPanel}
          onClose={() => setShowAIPanel(false)}
          onMindMapGenerated={() => {
            // Mind map generated - in a future iteration, we could create notes for each entity
          }}
        />

        {/* Loading Overlay */}
        {graphLoading && currentInvestigation && (
          <div className="absolute inset-0 bg-space-900/50 flex items-center justify-center z-30">
            <LoadingRocket text="Updating..." />
          </div>
        )}

        {/* Error Toast */}
        {error && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
            <div className="bg-red-500/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button
                onClick={clearError}
                className="ml-2 hover:bg-red-600/50 rounded p-1"
              >
                &times;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettingsModal && currentInvestigation && (
        <InvestigationFormModal
          investigation={currentInvestigation}
          onClose={() => setShowSettingsModal(false)}
          onSave={async () => {
            setShowSettingsModal(false);
            // Reload to get updated data
            if (id) {
              loadInvestigation(id);
            }
          }}
        />
      )}

      {/* Associated Records Drawer */}
      <AssociatedRecordsDrawer
        isOpen={showRecordsDrawer}
        onClose={() => setShowRecordsDrawer(false)}
      />
    </div>
  );
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; color: string }> = {
    open: { label: 'Open', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    active: { label: 'Active', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    in_progress: { label: 'In Progress', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    closed: { label: 'Closed', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
    archived: { label: 'Archived', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    on_hold: { label: 'On Hold', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  };

  const config = statusConfig[status] || statusConfig.open;

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${config.color}`}>
      {config.label}
    </span>
  );
}
