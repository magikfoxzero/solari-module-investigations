import { memo } from 'react';
import { useInvestigationsStore } from '@/modules/investigations/store';
import type { DrawingTool } from '@/modules/investigations/types';
import {
  Pencil,
  Minus,
  Square,
  Circle,
  Diamond,
  ArrowRight,
  Type,
  Eraser,
} from 'lucide-react';

// Drawing tool configuration
const DRAWING_TOOLS: { tool: DrawingTool; icon: React.ReactNode; label: string }[] = [
  { tool: 'pencil', icon: <Pencil size={16} />, label: 'Pencil' },
  { tool: 'line', icon: <Minus size={16} />, label: 'Line' },
  { tool: 'rectangle', icon: <Square size={16} />, label: 'Rectangle' },
  { tool: 'circle', icon: <Circle size={16} />, label: 'Circle' },
  { tool: 'diamond', icon: <Diamond size={16} />, label: 'Diamond' },
  { tool: 'arrow', icon: <ArrowRight size={16} />, label: 'Arrow' },
  { tool: 'label', icon: <Type size={16} />, label: 'Text Label' },
  { tool: 'eraser', icon: <Eraser size={16} />, label: 'Eraser' },
];

// Preset colors
const COLOR_PRESETS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#ffffff', // white
  '#6b7280', // gray
];

// Size presets
const SIZE_PRESETS = [
  { value: 2, label: 'S' },
  { value: 4, label: 'M' },
  { value: 8, label: 'L' },
  { value: 16, label: 'XL' },
];

interface DrawingToolsPanelProps {
  isOpen: boolean;
}

export const DrawingToolsPanel = memo(function DrawingToolsPanel({ isOpen }: DrawingToolsPanelProps) {
  const {
    drawingTool,
    drawColor,
    drawSize,
    setDrawingTool,
    setDrawColor,
    setDrawSize,
  } = useInvestigationsStore();

  if (!isOpen) return null;

  return (
    <div className="absolute top-4 left-4 right-4 md:left-20 md:right-auto z-50 md:w-64">
      <div className="glass-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-3 border-b border-space-600">
          <h3 className="font-semibold text-space-100 text-sm">Drawing Tools</h3>
        </div>

        <div className="p-3 space-y-4">
          {/* Tool Selection */}
          <div>
            <label className="text-xs text-space-400 uppercase tracking-wide mb-2 block">
              Tool
            </label>
            <div className="grid grid-cols-4 md:grid-cols-7 gap-1">
              {DRAWING_TOOLS.map(({ tool, icon, label }) => (
                <button
                  key={tool}
                  onClick={() => setDrawingTool(tool)}
                  className={`p-2 rounded transition-colors ${
                    drawingTool === tool
                      ? 'bg-accent text-white'
                      : 'bg-space-700 text-space-300 hover:bg-space-600'
                  }`}
                  title={label}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <label className="text-xs text-space-400 uppercase tracking-wide mb-2 block">
              Color
            </label>
            <div className="grid grid-cols-5 gap-1">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  onClick={() => setDrawColor(color)}
                  className={`w-8 h-8 rounded border-2 transition-all ${
                    drawColor === color
                      ? 'border-white scale-110'
                      : 'border-transparent hover:border-space-500'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            {/* Custom color input */}
            <div className="mt-2 flex items-center gap-2">
              <input
                type="color"
                value={drawColor}
                onChange={(e) => setDrawColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer bg-transparent"
              />
              <span className="text-xs text-space-400">Custom</span>
            </div>
          </div>

          {/* Size Selection */}
          <div>
            <label className="text-xs text-space-400 uppercase tracking-wide mb-2 block">
              Size
            </label>
            <div className="flex gap-1">
              {SIZE_PRESETS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setDrawSize(value)}
                  className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
                    drawSize === value
                      ? 'bg-accent text-white'
                      : 'bg-space-700 text-space-300 hover:bg-space-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Custom size slider */}
            <div className="mt-2">
              <input
                type="range"
                min={1}
                max={32}
                value={drawSize}
                onChange={(e) => setDrawSize(parseInt(e.target.value))}
                className="w-full accent-accent"
              />
              <div className="flex justify-between text-xs text-space-400">
                <span>1px</span>
                <span>{drawSize}px</span>
                <span>32px</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
