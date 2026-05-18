import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { useInvestigationsStore } from '@/modules/investigations/store';
import { ConnectionAnchors } from './ConnectionAnchors';
import type { InvestigationNode as NodeType, ConnectionAnchor } from '@/modules/investigations/types';
import { ENTITY_VISUAL_CONFIG } from '@/modules/investigations/types';

// Sanitize text to prevent XSS - strips HTML tags and limits length
function sanitizeText(text: string | null | undefined, maxLength = 500): string {
  if (!text) return '';
  return String(text).replace(/<[^>]*>/g, '').slice(0, maxLength);
}
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
  Hash,
  HelpCircle,
} from 'lucide-react';

interface InvestigationNodeProps {
  node: NodeType;
}

// Entity type to icon mapping
const EntityIcon: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  person: User,
  entity: Building2,
  event: Calendar,
  note: FileText,
  task: CheckSquare,
  place: MapPin,
  inventory: Package,
  message: MessageSquare,
  hypothesis: Lightbulb,
  motive: Target,
  reference: BookMarked,
  tag: Hash,
};

export const InvestigationNode = memo(function InvestigationNode({
  node,
}: InvestigationNodeProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  // Local position state for smooth dragging - avoids store re-renders during drag
  const [localPosition, setLocalPosition] = useState<{ x: number; y: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number; nodeX: number; nodeY: number } | null>(null);

  // Refs to avoid stale closures in event handlers during drag
  const nodeIdRef = useRef(node.record_id);
  const updateNodePositionRef = useRef<typeof updateNodePosition | null>(null);

  const {
    currentTool,
    selectedNodeIds,
    connectFrom,
    selectNode,
    updateNodePosition,
    startConnection,
    createConnection,
  } = useInvestigationsStore();

  const isSelected = selectedNodeIds.has(node.record_id);
  const entityConfig = ENTITY_VISUAL_CONFIG[node.entity_type] || ENTITY_VISUAL_CONFIG.person;
  const Icon = EntityIcon[node.entity_type] || HelpCircle;

  // Keep refs updated to avoid stale closures during drag
  useEffect(() => {
    nodeIdRef.current = node.record_id;
  }, [node.record_id]);

  useEffect(() => {
    updateNodePositionRef.current = updateNodePosition;
  }, [updateNodePosition]);

  // Use local position during drag, otherwise use node position
  const displayX = localPosition?.x ?? node.x;
  const displayY = localPosition?.y ?? node.y;

  // Handle mouse down for dragging
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // Only left click

      e.stopPropagation();

      // If connect tool is active, don't drag
      if (currentTool === 'connect') return;

      // Validate node positions - ensure they're finite numbers
      const rawX = Number(node.x);
      const rawY = Number(node.y);
      const nodeX = Number.isFinite(rawX) ? rawX : 0;
      const nodeY = Number.isFinite(rawY) ? rawY : 0;

      // Start drag
      setIsDragging(true);
      setLocalPosition({ x: nodeX, y: nodeY });
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        nodeX,
        nodeY,
      };

      // Select node
      selectNode(node.record_id, e.shiftKey || e.ctrlKey || e.metaKey);

      // Track last position for mouseUp
      let lastX = nodeX;
      let lastY = nodeY;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!dragStart.current) return;

        const zoom = useInvestigationsStore.getState().zoom;
        const dx = (moveEvent.clientX - dragStart.current.x) / zoom;
        const dy = (moveEvent.clientY - dragStart.current.y) / zoom;

        lastX = dragStart.current.nodeX + dx;
        lastY = dragStart.current.nodeY + dy;

        // Update local position for smooth rendering
        setLocalPosition({ x: lastX, y: lastY });
      };

      const handleMouseUp = () => {
        // Sync final position to store - use refs to avoid stale closure
        if (updateNodePositionRef.current) {
          updateNodePositionRef.current(nodeIdRef.current, lastX, lastY);
        }

        setIsDragging(false);
        setLocalPosition(null);
        dragStart.current = null;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [currentTool, node.record_id, node.x, node.y, selectNode]
  );

  // Handle click for selection
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();

      if (currentTool === 'connect') {
        if (connectFrom) {
          // Complete connection
          if (connectFrom.nodeId !== node.record_id) {
            createConnection({
              from_node_id: connectFrom.nodeId,
              to_node_id: node.record_id,
              from_side: connectFrom.anchor as ConnectionAnchor,
              to_side: 'left',
            });
          }
        }
      } else {
        // Select node
        selectNode(node.record_id, e.shiftKey || e.ctrlKey || e.metaKey);
      }
    },
    [currentTool, connectFrom, node.record_id, selectNode, createConnection]
  );

  // Handle anchor click for connections
  const handleAnchorClick = useCallback(
    (anchor: ConnectionAnchor) => {
      if (connectFrom) {
        // Complete connection to this anchor
        if (connectFrom.nodeId !== node.record_id) {
          createConnection({
            from_node_id: connectFrom.nodeId,
            to_node_id: node.record_id,
            from_side: connectFrom.anchor as ConnectionAnchor,
            to_side: anchor,
          });
        }
      } else {
        // Start new connection from this anchor
        startConnection(node.record_id, anchor);
      }
    },
    [connectFrom, node.record_id, startConnection, createConnection]
  );

  return (
    <div
      data-node={node.record_id}
      className={`
        absolute select-none
        rounded-lg border shadow-sm
        transition-shadow duration-150
        ${isSelected
          ? 'border-accent ring-2 ring-accent/30 shadow-lg'
          : 'border-space-600 hover:border-space-500'
        }
        ${isDragging ? 'shadow-xl cursor-grabbing' : 'cursor-grab'}
        bg-space-800/95 backdrop-blur-sm
      `}
      style={{
        left: Number.isFinite(displayX) ? displayX : 0,
        top: Number.isFinite(displayY) ? displayY : 0,
        width: Number.isFinite(node.width) ? node.width : 200,
        height: Number.isFinite(node.height) ? node.height : 80,
        zIndex: isDragging ? 1000 : (node.z_index || 1),
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Node Content */}
      <div className="p-3 h-full flex flex-col">
        {/* Header with icon and entity type */}
        <div className="flex items-start gap-2">
          <div
            className="flex-shrink-0 p-2 rounded-md"
            style={{ backgroundColor: `${entityConfig.color}20` }}
          >
            <div style={{ color: entityConfig.color }}>
              <Icon size={20} />
            </div>
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="font-medium text-space-100 truncate leading-tight">
              {sanitizeText(node.display_label || node.label_override || node.entity_id, 200)}
            </p>
            <span
              className="text-xs capitalize"
              style={{ color: entityConfig.color }}
            >
              {(node.entity_type || 'unknown').replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Notes preview (if any) */}
        {node.notes && (
          <p className="mt-2 text-xs text-space-400 line-clamp-2">
            {sanitizeText(node.notes, 300)}
          </p>
        )}
      </div>

      {/* Connection Anchors - shown on hover or when connecting */}
      {(isHovered || connectFrom || currentTool === 'connect') && (
        <ConnectionAnchors
          nodeId={node.record_id}
          width={node.width}
          height={node.height}
          onAnchorClick={handleAnchorClick}
          isConnecting={!!connectFrom}
          isSource={connectFrom?.nodeId === node.record_id}
        />
      )}

      {/* Selection handles */}
      {isSelected && !isDragging && (
        <>
          <div className="absolute -top-1 -left-1 w-3 h-3 bg-accent rounded-full border-2 border-space-900" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full border-2 border-space-900" />
          <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-accent rounded-full border-2 border-space-900" />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-accent rounded-full border-2 border-space-900" />
        </>
      )}
    </div>
  );
});
