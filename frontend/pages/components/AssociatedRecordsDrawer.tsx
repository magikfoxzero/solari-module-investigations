import { useState, useMemo, useCallback } from 'react';
import { X, Search, ChevronDown, ChevronRight, Pencil, Trash2, List, AlertTriangle, Link as LinkIcon } from 'lucide-react';
import { useInvestigationsStore } from '@/modules/investigations/store';
import type { InvestigationNode, LinkableEntityType } from '@/modules/investigations/types';
import { getEntityConfig } from '@/components/relationships/types';
import { DynamicIcon } from '@/components/common/DynamicIcon';
import { EntityPreview } from './EntityPreview';
import { EntityModalDispatcher } from './EntityModalDispatcher';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { toast } from '@/store/toastStore';

// Import delete APIs
import { deletePerson } from '@/modules/people/api';
import { deleteEntity } from '@/modules/entities/api';
import { deleteNote } from '@/modules/notes/api';
import { deleteTask } from '@/modules/tasks/api';
import { deleteEvent } from '@/modules/events/api';
import { deletePlace } from '@/modules/places/api';
import { deleteHypothesis } from '@/modules/hypotheses/api';
import { deleteMotive } from '@/modules/motives/api';
import { deleteInventoryObject } from '@/modules/inventory/api';
import { deleteFile } from '@/modules/files/api';
import { deleteTag } from '@/modules/tags/api';

interface AssociatedRecordsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

// Group nodes by entity type
function groupNodesByType(nodes: InvestigationNode[]): Record<string, InvestigationNode[]> {
  const groups: Record<string, InvestigationNode[]> = {};

  nodes.forEach(node => {
    const type = node.entity_type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(node);
  });

  return groups;
}

// Get delete function for entity type
function getDeleteFn(entityType: LinkableEntityType): ((id: string) => Promise<void>) | null {
  switch (entityType) {
    case 'person': return deletePerson;
    case 'entity': return deleteEntity;
    case 'note': return deleteNote;
    case 'task': return deleteTask;
    case 'event': return deleteEvent;
    case 'place': return deletePlace;
    case 'hypothesis': return deleteHypothesis;
    case 'motive': return deleteMotive;
    case 'inventory_object': return deleteInventoryObject;
    case 'file': return deleteFile;
    case 'tag': return deleteTag;
    default: return null;
  }
}

export function AssociatedRecordsDrawer({ isOpen, onClose }: AssociatedRecordsDrawerProps) {
  const { nodes, deleteNode } = useInvestigationsStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Edit modal state
  const [editingNode, setEditingNode] = useState<InvestigationNode | null>(null);

  // Delete confirmation state - two-step for permanent deletion
  const [deletingNode, setDeletingNode] = useState<InvestigationNode | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);

  // Filter nodes by search term
  const filteredNodes = useMemo(() => {
    if (!searchTerm.trim()) return nodes;

    const term = searchTerm.toLowerCase();
    return nodes.filter(node => {
      const label = node.display_label || node.entity_id;
      return label.toLowerCase().includes(term);
    });
  }, [nodes, searchTerm]);

  // Group filtered nodes by type
  const groupedNodes = useMemo(() => groupNodesByType(filteredNodes), [filteredNodes]);

  // Memoize sorted group entries to avoid re-sorting on every render
  const sortedGroupEntries = useMemo(() =>
    Object.entries(groupedNodes).sort(([a], [b]) => a.localeCompare(b)),
    [groupedNodes]
  );

  // Toggle node expansion (for preview)
  const toggleNodeExpansion = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Toggle group collapse
  const toggleGroupCollapse = (type: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // Handle edit click
  const handleEditClick = (node: InvestigationNode) => {
    setEditingNode(node);
  };

  // Handle edit modal close
  const handleEditClose = () => {
    setEditingNode(null);
  };

  // Handle delete click - show first confirmation
  const handleDeleteClick = useCallback((node: InvestigationNode) => {
    setDeletingNode(node);
    setDeleteConfirmText('');
    setShowFinalConfirm(false);
  }, []);

  // Handle first confirmation - show type-to-confirm dialog
  const handleFirstConfirm = useCallback(() => {
    setShowFinalConfirm(true);
  }, []);

  // Cancel deletion and reset state
  const handleDeleteCancel = useCallback(() => {
    setDeletingNode(null);
    setDeleteConfirmText('');
    setShowFinalConfirm(false);
  }, []);

  // Handle final delete confirmation with type-to-confirm
  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingNode) return;

    // Require exact text match for permanent deletion
    const expectedText = 'DELETE';
    if (deleteConfirmText !== expectedText) {
      toast.error(`Please type "${expectedText}" to confirm deletion`);
      return;
    }

    const deleteFn = getDeleteFn(deletingNode.entity_type);
    if (!deleteFn) {
      toast.error('Cannot delete this entity type');
      return;
    }

    setIsDeleting(true);

    // Store nodes to remove before deletion for potential error recovery
    const nodesToRemove = nodes.filter(n => n.entity_id === deletingNode.entity_id);
    const nodeCount = nodesToRemove.length;

    try {
      // Delete the actual entity from the backend first
      await deleteFn(deletingNode.entity_id);

      // Track node deletion failures
      const failedNodes: string[] = [];

      // Remove all nodes with this entity_id from the canvas
      for (const node of nodesToRemove) {
        try {
          await deleteNode(node.record_id);
        } catch {
          failedNodes.push(node.record_id);
        }
      }

      // Report results
      if (failedNodes.length === 0) {
        toast.success(
          nodeCount > 1
            ? `Entity deleted and removed from ${nodeCount} canvas locations`
            : 'Entity deleted successfully'
        );
      } else if (failedNodes.length < nodesToRemove.length) {
        toast.warning(
          `Entity deleted, but ${failedNodes.length} canvas node(s) could not be removed. They may need to be cleaned up manually.`
        );
      } else {
        toast.warning(
          'Entity deleted from the system, but canvas nodes could not be removed. Refresh the page to see changes.'
        );
      }

      handleDeleteCancel();
    } catch (err) {
      // Entity deletion failed - don't touch canvas nodes
      console.error('Failed to delete entity');

      // Check if it's a permission error (403)
      const errorMessage = err instanceof Error ? err.message : '';
      if (errorMessage.includes('403') || errorMessage.toLowerCase().includes('permission')) {
        toast.error('You do not have permission to delete this entity');
      } else if (errorMessage.includes('404')) {
        toast.error('Entity not found. It may have already been deleted.');
        // Still clean up canvas nodes since entity doesn't exist
        for (const node of nodesToRemove) {
          try {
            await deleteNode(node.record_id);
          } catch {
            // Ignore cleanup errors
          }
        }
        handleDeleteCancel();
      } else {
        toast.error('Failed to delete entity. Please try again.');
      }
    } finally {
      setIsDeleting(false);
    }
  }, [deletingNode, deleteConfirmText, nodes, deleteNode, handleDeleteCancel]);

  if (!isOpen) return null;

  const entityTypeLabel = deletingNode ? getEntityConfig(deletingNode.entity_type).label : '';
  // Sanitize entity label for display - strip any potential HTML
  const rawLabel = deletingNode?.display_label || deletingNode?.entity_id || 'Unknown';
  const entityLabel = typeof rawLabel === 'string' ? rawLabel.replace(/<[^>]*>/g, '') : String(rawLabel);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-space-800 border-l border-space-600 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-space-600">
          <div className="flex items-center gap-2">
            <List size={20} className="text-accent" />
            <h2 className="font-semibold text-space-100">Associated Records</h2>
            <span className="text-xs bg-space-700 px-2 py-0.5 rounded-full text-space-400">
              {nodes.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-space-700 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-space-600">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-space-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search records..."
              className="input-space pl-10 w-full text-sm"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {nodes.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="w-16 h-16 bg-space-700 rounded-full flex items-center justify-center mb-4">
                <List size={32} className="text-space-500" />
              </div>
              <h3 className="text-lg font-medium text-space-200 mb-2">No associated records</h3>
              <p className="text-sm text-space-400 max-w-xs">
                Add entities to your canvas using the + button in the toolbar
              </p>
            </div>
          ) : filteredNodes.length === 0 ? (
            /* No results */
            <div className="p-8 text-center">
              <p className="text-space-400">No records match your search</p>
            </div>
          ) : (
            /* Grouped List */
            <div className="divide-y divide-space-700">
              {sortedGroupEntries.map(([type, typeNodes]) => {
                  const config = getEntityConfig(type);
                  const isCollapsed = collapsedGroups.has(type);

                  return (
                    <div key={type}>
                      {/* Group Header */}
                      <button
                        onClick={() => toggleGroupCollapse(type)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-space-750 hover:bg-space-700 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="p-1.5 rounded"
                            style={{ backgroundColor: `${config.color}20`, color: config.color }}
                          >
                            <DynamicIcon name={config.icon} size={14} fallback={LinkIcon} />
                          </div>
                          <span className="font-medium text-space-200 uppercase text-xs tracking-wide">
                            {config.label}
                          </span>
                          <span className="text-xs bg-space-600 px-1.5 py-0.5 rounded text-space-400">
                            {typeNodes.length}
                          </span>
                        </div>
                        {isCollapsed ? (
                          <ChevronRight size={16} className="text-space-400" />
                        ) : (
                          <ChevronDown size={16} className="text-space-400" />
                        )}
                      </button>

                      {/* Group Items */}
                      {!isCollapsed && (
                        <div className="divide-y divide-space-700/50">
                          {typeNodes.map(node => (
                            <RecordItem
                              key={node.record_id}
                              node={node}
                              isExpanded={expandedNodes.has(node.record_id)}
                              onToggleExpand={() => toggleNodeExpansion(node.record_id)}
                              onEdit={() => handleEditClick(node)}
                              onDelete={() => handleDeleteClick(node)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingNode && (
        <EntityModalDispatcher
          entityType={editingNode.entity_type}
          entityId={editingNode.entity_id}
          onClose={handleEditClose}
        />
      )}

      {/* Delete Confirmation Modal - Two Step */}
      {deletingNode && !showFinalConfirm && (
        <ConfirmModal
          open={true}
          onOpenChange={(open) => !open && handleDeleteCancel()}
          title={`Delete ${entityTypeLabel}?`}
          message={`This will permanently delete "${entityLabel}" from the entire system. This affects ALL investigations that reference this entity, not just this one.`}
          confirmLabel="Continue"
          cancelLabel="Cancel"
          confirmVariant="danger"
          onConfirm={handleFirstConfirm}
        />
      )}

      {/* Final Delete Confirmation with Type-to-Confirm */}
      {deletingNode && showFinalConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
          <div className="bg-space-800 rounded-xl p-6 max-w-md mx-4 border border-red-500/50 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/20 rounded-full">
                <AlertTriangle className="text-red-400" size={24} />
              </div>
              <h3 className="text-lg font-semibold text-red-400">Permanent Deletion</h3>
            </div>

            <div className="space-y-3 mb-6">
              <p className="text-space-200">
                You are about to <span className="text-red-400 font-semibold">permanently delete</span> the {entityTypeLabel}:
              </p>
              <p className="text-white font-medium bg-space-700 px-3 py-2 rounded">
                {entityLabel}
              </p>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-300 text-sm">
                  This action <span className="font-semibold">cannot be undone</span>. The entity will be removed from:
                </p>
                <ul className="text-red-300 text-sm mt-2 ml-4 list-disc">
                  <li>All investigations that reference it</li>
                  <li>The {entityTypeLabel}s app permanently</li>
                  <li>Any connected relationships</li>
                </ul>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-space-300 mb-2">
                Type <span className="font-mono bg-space-700 px-1.5 py-0.5 rounded text-red-400">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="input-space w-full text-center font-mono tracking-wider"
                autoFocus
                disabled={isDeleting}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDeleteCancel}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-space-700 hover:bg-space-600 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting || deleteConfirmText !== 'DELETE'}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:opacity-50 rounded-lg transition-colors font-medium"
              >
                {isDeleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Individual record item component
interface RecordItemProps {
  node: InvestigationNode;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function RecordItem({ node, isExpanded, onToggleExpand, onEdit, onDelete }: RecordItemProps) {
  const config = getEntityConfig(node.entity_type);

  return (
    <div className="bg-space-800">
      {/* Main Row */}
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Expand Toggle */}
        <button
          onClick={onToggleExpand}
          className="p-1 hover:bg-space-700 rounded transition-colors"
        >
          {isExpanded ? (
            <ChevronDown size={16} className="text-space-400" />
          ) : (
            <ChevronRight size={16} className="text-space-400" />
          )}
        </button>

        {/* Entity Icon */}
        <div
          className="p-2 rounded"
          style={{ backgroundColor: `${config.color}20`, color: config.color }}
        >
          <DynamicIcon name={config.icon} size={16} fallback={LinkIcon} />
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-space-100 truncate">
            {node.display_label || node.entity_id}
          </p>
          {node.notes && (
            <p className="text-xs text-space-400 truncate">
              {node.notes}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-2 hover:bg-space-700 rounded transition-colors text-space-400 hover:text-space-200"
            title="Edit entity"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-2 hover:bg-red-500/20 rounded transition-colors text-space-400 hover:text-red-400"
            title="Delete entity"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Expanded Preview */}
      {isExpanded && (
        <div className="px-4 pb-3 pl-14">
          <EntityPreview
            entityType={node.entity_type}
            entityId={node.entity_id}
          />
        </div>
      )}
    </div>
  );
}
