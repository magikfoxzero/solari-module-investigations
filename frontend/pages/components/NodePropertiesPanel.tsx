import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { useInvestigationsStore } from '@/modules/investigations/store';
import { confirmAction } from '@/store/uiStore';
import { X, Trash2, ExternalLink } from 'lucide-react';
import { ENTITY_VISUAL_CONFIG } from '@/modules/investigations/types';
import type { InvestigationNodeUpdateInput } from '@/modules/investigations/types';
import {
  User,
  Building2,
  Calendar,
  FileText,
  CheckSquare,
  MapPin,
  Package,
  MessageSquare,
  Lightbulb,
  Target,
  BookMarked,
  HelpCircle,
} from 'lucide-react';

// Entity type to icon mapping
const EntityIcon: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  person: User,
  entity: Building2,
  event: Calendar,
  note: FileText,
  task: CheckSquare,
  place: MapPin,
  inventory_object: Package,
  message: MessageSquare,
  hypothesis: Lightbulb,
  motive: Target,
  blocknote: BookMarked,
};

// Entity type to route mapping
const ENTITY_ROUTES: Record<string, string> = {
  person: '/apps/people',
  entity: '/apps/entities',
  event: '/apps/events',
  note: '/apps/notes',
  task: '/apps/tasks',
  place: '/apps/places',
  inventory_object: '/apps/inventory',
  hypothesis: '/apps/hypotheses',
  motive: '/apps/motives',
  blocknote: '/apps/blocknotes',
};

export const NodePropertiesPanel = memo(function NodePropertiesPanel() {
  const {
    selectedNodeIds,
    nodes,
    updateNode,
    deleteNode,
    clearSelection,
  } = useInvestigationsStore();

  // Only show when exactly one node is selected
  const selectedNodeId = selectedNodeIds.size === 1 ? Array.from(selectedNodeIds)[0] : null;
  const node = selectedNodeId ? nodes.find((n) => n.record_id === selectedNodeId) : null;

  const [isDeleting, setIsDeleting] = useState(false);
  const [labelOverride, setLabelOverride] = useState('');
  const [notes, setNotes] = useState('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync text inputs when node changes
  useEffect(() => {
    if (node) {
      setLabelOverride(node.label_override || '');
      setNotes(node.notes || '');
    }
  }, [node?.record_id]);

  // Auto-save helper
  const saveUpdate = useCallback(async (data: Partial<InvestigationNodeUpdateInput>) => {
    if (!node) return;
    try {
      await updateNode(node.record_id, data);
    } catch {
      console.error('Failed to update node');
    }
  }, [node, updateNode]);

  // Debounced save for text inputs
  const debouncedSave = useCallback((data: Partial<InvestigationNodeUpdateInput>) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      saveUpdate(data);
    }, 500);
  }, [saveUpdate]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  if (!selectedNodeId || !node) return null;

  const handleDelete = async () => {
    const confirmed = await confirmAction({
      title: 'Remove Node',
      message: 'Remove this node from the investigation? The original entity will not be deleted.',
      confirmLabel: 'Remove',
      variant: 'warning',
    });
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteNode(node.record_id);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    clearSelection();
  };

  const handleViewEntity = () => {
    const route = ENTITY_ROUTES[node.entity_type];
    if (route) {
      window.open(`${route}/${node.entity_id}`, '_blank', 'noopener,noreferrer');
    }
  };

  const entityConfig = ENTITY_VISUAL_CONFIG[node.entity_type] || ENTITY_VISUAL_CONFIG.person;
  const Icon = EntityIcon[node.entity_type] || HelpCircle;

  return (
    <div className="absolute left-4 right-4 md:left-auto md:right-4 top-16 md:top-20 z-40 glass-card p-4 md:w-80 shadow-xl max-h-[50vh] md:max-h-[calc(100vh-10rem)] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-space-100">Node Properties</h3>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-space-600 rounded transition-colors"
        >
          <X size={16} className="text-space-400" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Entity Info */}
        <div className="flex items-start gap-3 p-3 bg-space-700/50 rounded-lg">
          <div
            className="flex-shrink-0 p-2 rounded-md"
            style={{ backgroundColor: `${entityConfig.color}20` }}
          >
            <div style={{ color: entityConfig.color }}>
              <Icon size={24} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-space-100 truncate">
              {node.display_label || node.label_override || node.entity_id}
            </p>
            <span
              className="text-xs capitalize"
              style={{ color: entityConfig.color }}
            >
              {(node.entity_type || 'unknown').replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* View Entity Button */}
        {ENTITY_ROUTES[node.entity_type] && (
          <button
            onClick={handleViewEntity}
            className="w-full px-4 py-2 bg-space-700 hover:bg-space-600 text-space-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <ExternalLink size={16} />
            View Full Entity Details
          </button>
        )}

        {/* Divider */}
        <div className="h-px bg-space-600" />

        {/* Label Override */}
        <div>
          <label className="text-xs text-space-400 mb-2 block">Custom Label</label>
          <input
            type="text"
            value={labelOverride}
            onChange={(e) => {
              setLabelOverride(e.target.value);
              debouncedSave({ label_override: e.target.value || undefined });
            }}
            placeholder={node.display_label || 'Override the display name...'}
            className="w-full px-3 py-2 bg-space-700 border border-space-600 rounded-lg text-sm text-space-100 placeholder:text-space-500 focus:outline-none focus:border-accent"
          />
          <p className="mt-1 text-xs text-space-500">
            Leave empty to use the entity's default name
          </p>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs text-space-400 mb-2 block">Investigation Notes</label>
          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              debouncedSave({ notes: e.target.value || undefined });
            }}
            placeholder="Notes specific to this investigation..."
            rows={3}
            className="w-full px-3 py-2 bg-space-700 border border-space-600 rounded-lg text-sm text-space-100 placeholder:text-space-500 focus:outline-none focus:border-accent resize-none"
          />
        </div>

        {/* Tags */}
        {node.tags && node.tags.length > 0 && (
          <div>
            <label className="text-xs text-space-400 mb-2 block">Tags</label>
            <div className="flex flex-wrap gap-1">
              {node.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-space-600 text-space-300 text-xs rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Position Info (collapsible/debug) */}
        <details className="text-xs text-space-500">
          <summary className="cursor-pointer hover:text-space-400">Position Details</summary>
          <div className="mt-2 space-y-1 pl-2">
            <p>X: {Math.round(node.x || 0)}, Y: {Math.round(node.y || 0)}</p>
            <p>Size: {node.width || 200} x {node.height || 80}</p>
            <p>Entity ID: {node.entity_id}</p>
          </div>
        </details>

        {/* Divider */}
        <div className="h-px bg-space-600" />

        {/* Delete Button */}
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Trash2 size={16} />
          {isDeleting ? 'Removing...' : 'Remove from Investigation'}
        </button>
      </div>
    </div>
  );
});
