import { memo } from 'react';
import { useInvestigationsStore } from '@/modules/investigations/store';
import { X, Minus, Circle, ArrowRight, ArrowLeftRight, MoveHorizontal } from 'lucide-react';

interface ConnectionStylePanelProps {
  isOpen: boolean;
  onClose?: () => void;
}

const LINE_STYLES = [
  { value: 'solid' as const, label: 'Solid', icon: <Minus size={16} /> },
  { value: 'dashed' as const, label: 'Dashed', icon: <span className="text-xs font-mono">- -</span> },
  { value: 'dotted' as const, label: 'Dotted', icon: <span className="text-xs font-mono">...</span> },
];

const PATH_TYPES = [
  { value: 'curved' as const, label: 'Curved', icon: <Circle size={16} /> },
  { value: 'straight' as const, label: 'Straight', icon: <Minus size={16} /> },
  { value: 'orthogonal' as const, label: 'Orthogonal', icon: <MoveHorizontal size={16} /> },
];

const ARROW_TYPES = [
  { value: 'none' as const, label: 'None', icon: <Minus size={16} /> },
  { value: 'forward' as const, label: 'Forward', icon: <ArrowRight size={16} /> },
  { value: 'both' as const, label: 'Both', icon: <ArrowLeftRight size={16} /> },
];

const PRESET_COLORS = [
  '#6b7280', // gray
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
];

export const ConnectionStylePanel = memo(function ConnectionStylePanel({
  isOpen,
  onClose,
}: ConnectionStylePanelProps) {
  const {
    connectionStyle,
    connectionColor,
    connectionThickness,
    connectionArrowType,
    connectionPathType,
    setConnectionDefaults,
  } = useInvestigationsStore();

  if (!isOpen) return null;

  return (
    <div className="absolute left-4 right-4 md:left-auto md:right-4 bottom-20 z-40 glass-card p-4 md:w-64 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-space-100">Connection Style</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-space-600 rounded transition-colors"
          >
            <X size={16} className="text-space-400" />
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Line Style */}
        <div>
          <label className="text-xs text-space-400 mb-2 block">Line Style</label>
          <div className="flex gap-2">
            {LINE_STYLES.map(({ value, label, icon }) => (
              <button
                key={value}
                onClick={() => setConnectionDefaults({ style: value })}
                className={`flex-1 p-2 rounded-lg border transition-all ${
                  connectionStyle === value
                    ? 'bg-accent/20 border-accent text-accent'
                    : 'bg-space-700 border-space-600 text-space-300 hover:bg-space-600'
                }`}
                title={label}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* Path Type */}
        <div>
          <label className="text-xs text-space-400 mb-2 block">Path Type</label>
          <div className="flex gap-2">
            {PATH_TYPES.map(({ value, label, icon }) => (
              <button
                key={value}
                onClick={() => setConnectionDefaults({ pathType: value })}
                className={`flex-1 p-2 rounded-lg border transition-all ${
                  connectionPathType === value
                    ? 'bg-accent/20 border-accent text-accent'
                    : 'bg-space-700 border-space-600 text-space-300 hover:bg-space-600'
                }`}
                title={label}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* Arrow Type */}
        <div>
          <label className="text-xs text-space-400 mb-2 block">Arrow Type</label>
          <div className="flex gap-2">
            {ARROW_TYPES.map(({ value, label, icon }) => (
              <button
                key={value}
                onClick={() => setConnectionDefaults({ arrowType: value })}
                className={`flex-1 p-2 rounded-lg border transition-all ${
                  connectionArrowType === value
                    ? 'bg-accent/20 border-accent text-accent'
                    : 'bg-space-700 border-space-600 text-space-300 hover:bg-space-600'
                }`}
                title={label}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-space-600" />

        {/* Color */}
        <div>
          <label className="text-xs text-space-400 mb-2 block">Color</label>
          <div className="flex gap-2 flex-wrap">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setConnectionDefaults({ color })}
                className={`w-8 h-8 rounded-lg border-2 transition-all ${
                  connectionColor === color
                    ? 'border-white scale-110'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="color"
              value={connectionColor}
              onChange={(e) => setConnectionDefaults({ color: e.target.value })}
              className="w-8 h-8 rounded cursor-pointer bg-transparent"
            />
            <span className="text-xs text-space-400 font-mono">{connectionColor}</span>
          </div>
        </div>

        {/* Thickness */}
        <div>
          <label className="text-xs text-space-400 mb-2 block">
            Thickness: {connectionThickness}px
          </label>
          <input
            type="range"
            min="1"
            max="8"
            value={connectionThickness}
            onChange={(e) => setConnectionDefaults({ thickness: Number(e.target.value) })}
            className="w-full accent-accent"
          />
        </div>

        {/* Preview */}
        <div>
          <label className="text-xs text-space-400 mb-2 block">Preview</label>
          <div className="bg-space-800 rounded-lg p-4 flex items-center justify-center">
            <svg width="180" height="40" viewBox="0 0 180 40">
              {/* Start node */}
              <circle cx="20" cy="20" r="8" fill="#374151" stroke="#4b5563" strokeWidth="1" />
              {/* Connection line */}
              <path
                d={connectionPathType === 'curved'
                  ? 'M 28 20 C 70 20, 110 20, 152 20'
                  : connectionPathType === 'orthogonal'
                  ? 'M 28 20 L 90 20 L 90 20 L 152 20'
                  : 'M 28 20 L 152 20'
                }
                fill="none"
                stroke={connectionColor}
                strokeWidth={connectionThickness}
                strokeDasharray={
                  connectionStyle === 'dashed' ? '8,4' :
                  connectionStyle === 'dotted' ? '2,4' : undefined
                }
                markerEnd={connectionArrowType !== 'none' ? 'url(#preview-arrow)' : undefined}
                markerStart={connectionArrowType === 'both' ? 'url(#preview-arrow-start)' : undefined}
              />
              {/* End node */}
              <circle cx="160" cy="20" r="8" fill="#374151" stroke="#4b5563" strokeWidth="1" />
              {/* Arrow markers */}
              <defs>
                <marker id="preview-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={connectionColor} />
                </marker>
                <marker id="preview-arrow-start" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M 10 0 L 0 5 L 10 10 z" fill={connectionColor} />
                </marker>
              </defs>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
});
