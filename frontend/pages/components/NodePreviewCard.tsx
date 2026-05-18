import { ENTITY_VISUAL_CONFIG, type SuggestionNodePreview, type LinkableEntityType } from '@/modules/investigations/types';
import {
  User,
  Building,
  MapPin,
  Calendar,
  FileText,
  CheckSquare,
  Paperclip,
  Lightbulb,
  Target,
  Package,
  Tag,
} from 'lucide-react';

interface NodePreviewCardProps {
  node: SuggestionNodePreview;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
}

const ENTITY_ICONS: Record<LinkableEntityType, React.ComponentType<{ size?: number; className?: string }>> = {
  person: User,
  entity: Building,
  place: MapPin,
  event: Calendar,
  note: FileText,
  task: CheckSquare,
  file: Paperclip,
  hypothesis: Lightbulb,
  motive: Target,
  inventory_object: Package,
  tag: Tag,
};

export function NodePreviewCard({ node, className = '', selected = false, onClick }: NodePreviewCardProps) {
  const visualConfig = node.visual_config || ENTITY_VISUAL_CONFIG[node.entity_type] || ENTITY_VISUAL_CONFIG.note;
  const Icon = ENTITY_ICONS[node.entity_type] || FileText;

  return (
    <div
      className={`
        bg-space-700 rounded-lg border p-3 transition-all
        ${selected ? 'border-accent ring-2 ring-accent/30' : 'border-space-600'}
        ${onClick ? 'cursor-pointer hover:border-space-500 hover:bg-space-650' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: visualConfig.backgroundColor, color: visualConfig.color }}
        >
          <Icon size={20} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Type badge */}
          <span
            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide mb-1"
            style={{
              backgroundColor: `${visualConfig.color}20`,
              color: visualConfig.color,
            }}
          >
            {node.entity_type.replace('_', ' ')}
          </span>

          {/* Label */}
          <div className="text-sm font-medium text-space-100 truncate" title={node.display_label}>
            {node.display_label}
          </div>

          {/* Position (optional debug info) */}
          <div className="text-[10px] text-space-500 mt-0.5">
            Position: ({Math.round(node.x)}, {Math.round(node.y)})
          </div>
        </div>
      </div>
    </div>
  );
}
