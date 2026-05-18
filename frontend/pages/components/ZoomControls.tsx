import { memo } from 'react';
import { useInvestigationsStore } from '@/modules/investigations/store';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
} from 'lucide-react';

export const ZoomControls = memo(function ZoomControls() {
  const {
    zoom,
    setZoom,
    setViewport,
    fitToContent,
    saveCanvasState,
  } = useInvestigationsStore();

  const handleZoomIn = () => {
    setZoom(Math.min(4, zoom * 1.2));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(0.1, zoom / 1.2));
  };

  const handleReset = () => {
    setZoom(1);
    setViewport({ x: 0, y: 0 });
    saveCanvasState();
  };

  const handleFitToContent = () => {
    fitToContent();
    saveCanvasState();
  };

  const zoomPercentage = Math.round(zoom * 100);

  return (
    <div className="glass-card p-2 flex items-center gap-1 shadow-xl">
      {/* Zoom Out */}
      <button
        onClick={handleZoomOut}
        disabled={zoom <= 0.1}
        className="p-2 rounded-lg bg-space-700 text-space-300 hover:bg-space-600 hover:text-space-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
        title="Zoom Out (Ctrl+-)"
      >
        <ZoomOut size={16} />
      </button>

      {/* Zoom Percentage */}
      <div className="px-2 min-w-[50px] text-center">
        <span className="text-sm font-medium text-space-200">
          {zoomPercentage}%
        </span>
      </div>

      {/* Zoom In */}
      <button
        onClick={handleZoomIn}
        disabled={zoom >= 4}
        className="p-2 rounded-lg bg-space-700 text-space-300 hover:bg-space-600 hover:text-space-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
        title="Zoom In (Ctrl++)"
      >
        <ZoomIn size={16} />
      </button>

      {/* Divider */}
      <div className="w-px h-6 bg-space-600 mx-1" />

      {/* Fit to Content */}
      <button
        onClick={handleFitToContent}
        className="p-2 rounded-lg bg-space-700 text-space-300 hover:bg-space-600 hover:text-space-100 transition-all duration-150"
        title="Fit to Content"
      >
        <Maximize2 size={16} />
      </button>

      {/* Reset */}
      <button
        onClick={handleReset}
        className="p-2 rounded-lg bg-space-700 text-space-300 hover:bg-space-600 hover:text-space-100 transition-all duration-150"
        title="Reset View (Ctrl+0)"
      >
        <RotateCcw size={16} />
      </button>
    </div>
  );
});
