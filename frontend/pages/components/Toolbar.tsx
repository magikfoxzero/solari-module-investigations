import { memo } from 'react';
import { useInvestigationsStore } from '@/modules/investigations/store';
import type { CanvasTool } from '@/modules/investigations/types';
import {
  MousePointer,
  GitBranch,
  Pencil,
  Trash2,
  LayoutGrid,
  Plus,
  Hand,
  Calendar,
  List,
  Sparkles,
} from 'lucide-react';

interface ToolbarProps {
  onAddEntity?: () => void;
  onToggleTimeline?: () => void;
  isTimelineOpen?: boolean;
  onToggleRecords?: () => void;
  isRecordsOpen?: boolean;
  onToggleAI?: () => void;
  isAIOpen?: boolean;
}

interface ToolButtonProps {
  tool: CanvasTool;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function ToolButton({ icon, label, isActive, onClick }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        p-2.5 rounded-lg transition-all duration-150
        ${isActive
          ? 'bg-accent text-white shadow-lg shadow-accent/30'
          : 'bg-space-700 text-space-300 hover:bg-space-600 hover:text-space-100'
        }
      `}
      title={label}
    >
      {icon}
    </button>
  );
}

export const Toolbar = memo(function Toolbar({ onAddEntity, onToggleTimeline, isTimelineOpen, onToggleRecords, isRecordsOpen, onToggleAI, isAIOpen }: ToolbarProps) {
  const {
    currentTool,
    selectedNodeIds,
    selectedConnectionId,
    selectedDrawingIds,
    setTool,
    deleteSelected,
    applyLayout,
  } = useInvestigationsStore();

  const hasSelection = selectedNodeIds.size > 0 || selectedConnectionId !== null || selectedDrawingIds.size > 0;

  const tools: { tool: CanvasTool; icon: React.ReactNode; label: string }[] = [
    { tool: 'select', icon: <MousePointer size={18} />, label: 'Select (V)' },
    { tool: 'pan', icon: <Hand size={18} />, label: 'Pan (H)' },
    { tool: 'connect', icon: <GitBranch size={18} />, label: 'Connect (C)' },
    { tool: 'draw', icon: <Pencil size={18} />, label: 'Draw (D)' },
  ];

  return (
    <div className="glass-card p-2 flex flex-col gap-2 shadow-xl">
      {/* Tool Buttons */}
      {tools.map(({ tool, icon, label }) => (
        <ToolButton
          key={tool}
          tool={tool}
          icon={icon}
          label={label}
          isActive={currentTool === tool}
          onClick={() => setTool(tool)}
        />
      ))}

      {/* Divider */}
      <div className="h-px bg-space-600 my-1" />

      {/* Add Entity Button */}
      <button
        onClick={onAddEntity}
        className="p-2.5 rounded-lg bg-space-700 text-space-300 hover:bg-accent hover:text-white transition-all duration-150"
        title="Add Entity"
      >
        <Plus size={18} />
      </button>

      {/* Auto Layout Button */}
      <button
        onClick={() => applyLayout('force-directed')}
        className="p-2.5 rounded-lg bg-space-700 text-space-300 hover:bg-space-600 hover:text-space-100 transition-all duration-150"
        title="Auto Layout"
      >
        <LayoutGrid size={18} />
      </button>

      {/* Timeline Button */}
      <button
        onClick={onToggleTimeline}
        className={`p-2.5 rounded-lg transition-all duration-150 ${
          isTimelineOpen
            ? 'bg-accent text-white shadow-lg shadow-accent/30'
            : 'bg-space-700 text-space-300 hover:bg-space-600 hover:text-space-100'
        }`}
        title="Timeline (T)"
      >
        <Calendar size={18} />
      </button>

      {/* Associated Records Button */}
      <button
        onClick={onToggleRecords}
        className={`p-2.5 rounded-lg transition-all duration-150 ${
          isRecordsOpen
            ? 'bg-accent text-white shadow-lg shadow-accent/30'
            : 'bg-space-700 text-space-300 hover:bg-space-600 hover:text-space-100'
        }`}
        title="Associated Records"
      >
        <List size={18} />
      </button>

      {/* AI Assistant Button */}
      <button
        onClick={onToggleAI}
        className={`p-2.5 rounded-lg transition-all duration-150 ${
          isAIOpen
            ? 'bg-accent text-white shadow-lg shadow-accent/30'
            : 'bg-space-700 text-space-300 hover:bg-space-600 hover:text-space-100'
        }`}
        title="AI Assistant"
      >
        <Sparkles size={18} />
      </button>

      {/* Delete Button (shown when selection exists) */}
      {hasSelection && (
        <>
          <div className="h-px bg-space-600 my-1" />
          <button
            onClick={() => deleteSelected()}
            className="p-2.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all duration-150"
            title="Delete Selected"
          >
            <Trash2 size={18} />
          </button>
        </>
      )}
    </div>
  );
});
