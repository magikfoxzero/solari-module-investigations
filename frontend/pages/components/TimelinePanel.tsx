import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Calendar, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Clock, Eye, EyeOff } from 'lucide-react';
import { useInvestigationsStore } from '@/modules/investigations/store';
import { getTimeline } from '../../api';
import type { TimelineData, TimelineEvent, LinkableEntityType } from '@/modules/investigations/types';

interface TimelinePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type ZoomLevel = 'day' | 'week' | 'month' | 'year';

// Entity type colors (matching EntitySearchPanel)
const ENTITY_COLORS: Record<LinkableEntityType, string> = {
  person: '#3b82f6',
  entity: '#8b5cf6',
  place: '#10b981',
  event: '#ef4444',
  note: '#f59e0b',
  task: '#06b6d4',
  file: '#6b7280',
  hypothesis: '#eab308',
  motive: '#f97316',
  inventory_object: '#84cc16',
  tag: '#ec4899',
};

const ZOOM_LABELS: Record<ZoomLevel, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  year: 'Year',
};

export function TimelinePanel({ isOpen, onClose }: TimelinePanelProps) {
  const { currentInvestigation, nodes, selectNode } = useInvestigationsStore();

  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('month');
  const [showOnlyOnCanvas, setShowOnlyOnCanvas] = useState(false);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);

  // Track which investigation data was loaded for (cache invalidation)
  const [loadedInvestigationId, setLoadedInvestigationId] = useState<string | null>(null);

  // Get node IDs on canvas
  const canvasNodeIds = useMemo(() => new Set(nodes.map(n => n.record_id)), [nodes]);

  // Load timeline data (no group_by - we group on frontend for instant zoom changes)
  const loadTimeline = useCallback(async () => {
    if (!currentInvestigation) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getTimeline(currentInvestigation.record_id);
      setTimelineData(data);
      setLoadedInvestigationId(currentInvestigation.record_id);
    } catch {
      console.error('Failed to load timeline');
      setError('Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }, [currentInvestigation]);

  // Load only when panel opens or investigation changes (not on zoom change)
  // Zoom changes are handled instantly via frontend grouping in groupedEvents useMemo
  useEffect(() => {
    if (isOpen && currentInvestigation) {
      // Only reload if investigation changed or no data loaded yet
      if (loadedInvestigationId !== currentInvestigation.record_id) {
        loadTimeline();
      }
    }
  }, [isOpen, currentInvestigation, loadedInvestigationId, loadTimeline]);

  // Filter events based on canvas visibility
  const displayEvents = useMemo(() => {
    if (!timelineData) return [];
    if (!showOnlyOnCanvas) return timelineData.events;
    return timelineData.events.filter(e => canvasNodeIds.has(e.node_id));
  }, [timelineData, showOnlyOnCanvas, canvasNodeIds]);

  // Handle event click - highlight node on canvas
  const handleEventClick = (event: TimelineEvent) => {
    if (canvasNodeIds.has(event.node_id)) {
      selectNode(event.node_id, false); // false = don't multi-select
      onClose();
    }
  };

  // Handle zoom level changes
  const handleZoomIn = () => {
    const levels: ZoomLevel[] = ['year', 'month', 'week', 'day'];
    const currentIndex = levels.indexOf(zoomLevel);
    if (currentIndex < levels.length - 1) {
      setZoomLevel(levels[currentIndex + 1]);
    }
  };

  const handleZoomOut = () => {
    const levels: ZoomLevel[] = ['year', 'month', 'week', 'day'];
    const currentIndex = levels.indexOf(zoomLevel);
    if (currentIndex > 0) {
      setZoomLevel(levels[currentIndex - 1]);
    }
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    // Check for invalid date (new Date doesn't throw, returns Invalid Date)
    if (isNaN(date.getTime())) {
      return dateString;
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Group events by period for display
  const groupedEvents = useMemo(() => {
    if (displayEvents.length === 0) return [];

    const groups: Map<string, { label: string; events: TimelineEvent[] }> = new Map();

    displayEvents.forEach((event) => {
      try {
        const date = new Date(event.date);
        let key: string;
        let label: string;

        switch (zoomLevel) {
          case 'day':
            key = date.toISOString().split('T')[0];
            label = formatDate(event.date);
            break;
          case 'week': {
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            key = weekStart.toISOString().split('T')[0];
            label = `Week of ${formatDate(weekStart.toISOString())}`;
            break;
          }
          case 'month':
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
            break;
          case 'year':
            key = String(date.getFullYear());
            label = String(date.getFullYear());
            break;
          default:
            key = date.toISOString().split('T')[0];
            label = formatDate(event.date);
        }

        if (!groups.has(key)) {
          groups.set(key, { label, events: [] });
        }
        groups.get(key)!.events.push(event);
      } catch {
        // Skip events with invalid dates
      }
    });

    // Sort groups by key (chronologically)
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({ key, ...value }));
  }, [displayEvents, zoomLevel]);

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-50 max-h-[50vh]">
      <div className="glass-card shadow-2xl border-t border-space-600 rounded-t-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-2 md:p-3 border-b border-space-600 bg-space-900/80 gap-2">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <Calendar className="text-accent flex-shrink-0" size={18} />
            <h3 className="font-semibold text-space-100 text-sm md:text-base">Timeline</h3>
            {timelineData && (
              <span className="text-xs text-space-400 px-2 py-0.5 bg-space-700 rounded hidden sm:inline">
                {displayEvents.length} events
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
            {/* Visibility toggle */}
            <button
              onClick={() => setShowOnlyOnCanvas(prev => !prev)}
              className={`p-1.5 rounded transition-colors flex items-center gap-1 md:gap-1.5 text-xs ${
                showOnlyOnCanvas
                  ? 'bg-accent text-white'
                  : 'bg-space-700 text-space-300 hover:bg-space-600'
              }`}
              title={showOnlyOnCanvas ? 'Show all events' : 'Show only events on canvas'}
            >
              {showOnlyOnCanvas ? <Eye size={14} /> : <EyeOff size={14} />}
              <span className="hidden sm:inline">Canvas only</span>
            </button>

            {/* Zoom controls */}
            <div className="flex items-center gap-0.5 md:gap-1 bg-space-800 rounded px-1">
              <button
                onClick={handleZoomOut}
                disabled={zoomLevel === 'year'}
                className="p-1 hover:bg-space-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Zoom out"
              >
                <ZoomOut size={14} />
              </button>
              <span className="text-xs text-space-300 w-10 md:w-12 text-center">
                {ZOOM_LABELS[zoomLevel]}
              </span>
              <button
                onClick={handleZoomIn}
                disabled={zoomLevel === 'day'}
                className="p-1 hover:bg-space-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Zoom in"
              >
                <ZoomIn size={14} />
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-space-700 rounded transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[calc(50vh-56px)] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              <span className="ml-2 text-space-400">Loading timeline...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={loadTimeline}
                className="mt-2 text-accent text-sm hover:underline"
              >
                Retry
              </button>
            </div>
          ) : displayEvents.length === 0 ? (
            <div className="text-center py-8 text-space-400">
              <Clock size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No timeline events found</p>
              <p className="text-xs mt-1">
                Add entities with dates (events, tasks, etc.) to see them on the timeline
              </p>
            </div>
          ) : (
            /* Timeline visualization */
            <div className="relative">
              {/* Vertical timeline line */}
              <div className="absolute left-8 top-0 bottom-0 w-px bg-space-600" />

              {/* Timeline groups */}
              <div className="space-y-6">
                {groupedEvents.map((group) => (
                  <div key={group.key} className="relative">
                    {/* Period label */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-4 h-4 rounded-full bg-accent flex items-center justify-center ml-6">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                      <span className="font-medium text-space-200">{group.label}</span>
                      <span className="text-xs text-space-500">({group.events.length})</span>
                    </div>

                    {/* Events in this period */}
                    <div className="ml-16 space-y-2">
                      {group.events.map((event) => {
                        const isOnCanvas = canvasNodeIds.has(event.node_id);
                        const isHovered = hoveredEventId === event.node_id;
                        const color = ENTITY_COLORS[event.entity_type] || '#6b7280';

                        return (
                          <div
                            key={`${event.node_id}-${event.date_field}`}
                            className={`p-3 rounded-lg border transition-all cursor-pointer ${
                              isOnCanvas
                                ? 'bg-space-800/80 border-space-600 hover:border-accent'
                                : 'bg-space-800/40 border-space-700 opacity-60'
                            } ${isHovered ? 'ring-2 ring-accent' : ''}`}
                            onClick={() => handleEventClick(event)}
                            onMouseEnter={() => setHoveredEventId(event.node_id)}
                            onMouseLeave={() => setHoveredEventId(null)}
                          >
                            <div className="flex items-center gap-3">
                              {/* Entity type indicator */}
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: color }}
                              />

                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-space-100 truncate">
                                  {event.label}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-space-400 capitalize">
                                    {event.entity_type.replace('_', ' ')}
                                  </span>
                                  <span className="text-xs text-space-500">
                                    {event.date_field.replace('_', ' ')}
                                  </span>
                                </div>
                              </div>

                              {/* Date */}
                              <div className="text-right flex-shrink-0">
                                <p className="text-xs text-space-300">
                                  {formatDate(event.date)}
                                </p>
                                {!isOnCanvas && (
                                  <p className="text-xs text-space-500">Not on canvas</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Date range indicator */}
              {timelineData?.date_range?.min && timelineData?.date_range?.max && (
                <div className="mt-6 pt-4 border-t border-space-700 flex items-center justify-between text-xs text-space-400">
                  <div className="flex items-center gap-2">
                    <ChevronLeft size={14} />
                    <span>{formatDate(timelineData.date_range.min)}</span>
                  </div>
                  <span>
                    {timelineData.date_range.span_days} days span
                  </span>
                  <div className="flex items-center gap-2">
                    <span>{formatDate(timelineData.date_range.max)}</span>
                    <ChevronRight size={14} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
