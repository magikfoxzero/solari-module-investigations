import { memo, useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useInvestigationsStore } from '@/modules/investigations/store';
import { confirmAction } from '@/store/uiStore';
import { X, Trash2, Minus, Circle, ArrowRight, ArrowLeftRight, MoveHorizontal } from 'lucide-react';
import type { InvestigationConnectionUpdateInput, ConnectionStyle, ConnectionPathType, ConnectionArrowType, ConnectionSentiment } from '@/modules/investigations/types';

const LINE_STYLES: { value: ConnectionStyle; label: string; icon: ReactNode }[] = [
  { value: 'solid', label: 'Solid', icon: <Minus size={16} /> },
  { value: 'dashed', label: 'Dashed', icon: <span className="text-xs font-mono">- -</span> },
  { value: 'dotted', label: 'Dotted', icon: <span className="text-xs font-mono">...</span> },
];

const PATH_TYPES: { value: ConnectionPathType; label: string; icon: ReactNode }[] = [
  { value: 'curved', label: 'Curved', icon: <Circle size={16} /> },
  { value: 'straight', label: 'Straight', icon: <Minus size={16} /> },
  { value: 'orthogonal', label: 'Orthogonal', icon: <MoveHorizontal size={16} /> },
];

const ARROW_TYPES: { value: ConnectionArrowType; label: string; icon: ReactNode }[] = [
  { value: 'none', label: 'None', icon: <Minus size={16} /> },
  { value: 'forward', label: 'Forward', icon: <ArrowRight size={16} /> },
  { value: 'both', label: 'Both', icon: <ArrowLeftRight size={16} /> },
];

const SENTIMENT_OPTIONS: { value: ConnectionSentiment; label: string; color: string }[] = [
  { value: 'neutral', label: 'Neutral', color: '#6b7280' },
  { value: 'positive', label: 'Positive', color: '#10b981' },
  { value: 'negative', label: 'Negative', color: '#ef4444' },
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

export const ConnectionPropertiesPanel = memo(function ConnectionPropertiesPanel() {
  const {
    selectedConnectionId,
    connections,
    updateConnection,
    deleteConnection,
    clearSelection,
  } = useInvestigationsStore();

  const connection = connections.find((c) => c.record_id === selectedConnectionId);
  const [isDeleting, setIsDeleting] = useState(false);

  // Local state for text inputs (debounced)
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync text inputs when connection changes
  useEffect(() => {
    if (connection) {
      setLabel(connection.relationship_label || '');
      setNotes(connection.notes || '');
    }
  }, [connection?.record_id]); // Only sync on connection change, not on every update

  // Auto-save helper for immediate updates
  const saveUpdate = useCallback(async (data: Partial<InvestigationConnectionUpdateInput>) => {
    if (!connection) return;
    try {
      await updateConnection(connection.record_id, data);
    } catch {
      console.error('Failed to update connection');
    }
  }, [connection, updateConnection]);

  // Debounced save for text inputs
  const debouncedSave = useCallback((data: Partial<InvestigationConnectionUpdateInput>) => {
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

  if (!selectedConnectionId || !connection) return null;

  const handleDelete = async () => {
    const confirmed = await confirmAction({
      title: 'Delete Connection',
      message: 'Are you sure you want to delete this connection? This action cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteConnection(connection.record_id);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    clearSelection();
  };

  // Get current values from connection
  const style = connection.style || 'solid';
  const pathType = connection.path_type || 'curved';
  const arrowType = connection.arrow_type || 'forward';
  const color = connection.color || '#6b7280';
  const thickness = connection.thickness || 2;
  const sentiment = connection.sentiment || 'neutral';
  const weight = connection.weight || 5;

  return (
    <div className="absolute left-4 right-4 md:left-auto md:right-4 top-16 md:top-20 z-40 glass-card p-4 md:w-72 shadow-xl max-h-[50vh] md:max-h-[calc(100vh-10rem)] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-space-100">Connection Properties</h3>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-space-600 rounded transition-colors"
        >
          <X size={16} className="text-space-400" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Line Style */}
        <div>
          <label className="text-xs text-space-400 mb-2 block">Line Style</label>
          <div className="flex gap-2">
            {LINE_STYLES.map(({ value, label: lbl, icon }) => (
              <button
                key={value}
                onClick={() => saveUpdate({ style: value })}
                className={`flex-1 p-2 rounded-lg border transition-all ${
                  style === value
                    ? 'bg-accent/20 border-accent text-accent'
                    : 'bg-space-700 border-space-600 text-space-300 hover:bg-space-600'
                }`}
                title={lbl}
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
            {PATH_TYPES.map(({ value, label: lbl, icon }) => (
              <button
                key={value}
                onClick={() => saveUpdate({ path_type: value })}
                className={`flex-1 p-2 rounded-lg border transition-all ${
                  pathType === value
                    ? 'bg-accent/20 border-accent text-accent'
                    : 'bg-space-700 border-space-600 text-space-300 hover:bg-space-600'
                }`}
                title={lbl}
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
            {ARROW_TYPES.map(({ value, label: lbl, icon }) => (
              <button
                key={value}
                onClick={() => saveUpdate({ arrow_type: value })}
                className={`flex-1 p-2 rounded-lg border transition-all ${
                  arrowType === value
                    ? 'bg-accent/20 border-accent text-accent'
                    : 'bg-space-700 border-space-600 text-space-300 hover:bg-space-600'
                }`}
                title={lbl}
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
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => saveUpdate({ color: c })}
                className={`w-7 h-7 rounded-lg border-2 transition-all ${
                  color === c
                    ? 'border-white scale-110'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => saveUpdate({ color: e.target.value })}
              className="w-7 h-7 rounded cursor-pointer bg-transparent"
            />
            <span className="text-xs text-space-400 font-mono">{color}</span>
          </div>
        </div>

        {/* Thickness */}
        <div>
          <label className="text-xs text-space-400 mb-2 block">
            Thickness: {thickness}px
          </label>
          <input
            type="range"
            min="1"
            max="8"
            value={thickness}
            onChange={(e) => saveUpdate({ thickness: Number(e.target.value) })}
            className="w-full accent-accent"
          />
        </div>

        {/* Divider */}
        <div className="h-px bg-space-600" />

        {/* Relationship Label */}
        <div>
          <label className="text-xs text-space-400 mb-2 block">Relationship Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              debouncedSave({ relationship_label: e.target.value || undefined });
            }}
            placeholder="e.g., works with, related to"
            className="w-full px-3 py-2 bg-space-700 border border-space-600 rounded-lg text-sm text-space-100 placeholder:text-space-500 focus:outline-none focus:border-accent"
          />
        </div>

        {/* Sentiment */}
        <div>
          <label className="text-xs text-space-400 mb-2 block">Sentiment</label>
          <div className="flex gap-2">
            {SENTIMENT_OPTIONS.map(({ value, label: lbl, color: c }) => (
              <button
                key={value}
                onClick={() => saveUpdate({ sentiment: value })}
                className={`flex-1 p-2 rounded-lg border transition-all text-xs ${
                  sentiment === value
                    ? 'border-white'
                    : 'border-space-600 hover:border-space-500'
                }`}
                style={{
                  backgroundColor: sentiment === value ? `${c}30` : undefined,
                  color: sentiment === value ? c : undefined,
                }}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Weight */}
        <div>
          <label className="text-xs text-space-400 mb-2 block">
            Weight: {weight}
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={weight}
            onChange={(e) => saveUpdate({ weight: Number(e.target.value) })}
            className="w-full accent-accent"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs text-space-400 mb-2 block">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              debouncedSave({ notes: e.target.value || undefined });
            }}
            placeholder="Additional notes about this connection..."
            rows={2}
            className="w-full px-3 py-2 bg-space-700 border border-space-600 rounded-lg text-sm text-space-100 placeholder:text-space-500 focus:outline-none focus:border-accent resize-none"
          />
        </div>

        {/* Divider */}
        <div className="h-px bg-space-600" />

        {/* Delete Button */}
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Trash2 size={16} />
          {isDeleting ? 'Deleting...' : 'Delete Connection'}
        </button>
      </div>
    </div>
  );
});
