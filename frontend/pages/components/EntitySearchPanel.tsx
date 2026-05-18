import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, Search, Plus, User, Building2, Calendar, FileText, CheckSquare, MapPin, Package, Lightbulb, Target, PlusCircle, File, Tag } from 'lucide-react';
import { useInvestigationsStore } from '@/modules/investigations/store';
import { useAppsStore } from '@/store/appsStore';
import type { LinkableEntityType } from '@/modules/investigations/types';
import apiClient, { unwrapResponse } from '@/api/client';
import type { ApiResponse } from '@/types/api.types';

// Import form modals for each entity type
import { PersonFormModal } from '@/pages/apps/people';
import { EntityFormModal } from '@/pages/apps/entities';
import { PlaceFormModal } from '@/pages/apps/places';
import { EventFormModal } from '@/pages/apps/events';
import { NoteFormModal } from '@/pages/apps/notes';
import { TaskFormModal } from '@/pages/apps/tasks';
import { HypothesisFormModal } from '@/pages/apps/hypotheses';
import { MotiveFormModal } from '@/pages/apps/motives';
import { InventoryFormModal } from '@/pages/apps/inventory';
import { TagFormModal } from '@/pages/apps/tags';
import { FileUploadModal } from '@/pages/apps/files';

// Import type for PersonFormModal callback
import type { PersonCreateInput, TagCreateInput } from '@/types/models';

interface EntitySearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  record_id: string;
  entity_type: LinkableEntityType;
  label: string;
  subtitle?: string;
}

type ViewMode = 'search' | 'create';

// Entity type configuration
const ENTITY_CONFIG: Record<LinkableEntityType, { icon: React.ComponentType<{ size?: number; className?: string }>; color: string; label: string }> = {
  person: { icon: User, color: '#3b82f6', label: 'Person' },
  entity: { icon: Building2, color: '#8b5cf6', label: 'Entity' },
  place: { icon: MapPin, color: '#10b981', label: 'Place' },
  event: { icon: Calendar, color: '#ef4444', label: 'Event' },
  note: { icon: FileText, color: '#f59e0b', label: 'Note' },
  task: { icon: CheckSquare, color: '#06b6d4', label: 'Task' },
  file: { icon: File, color: '#6b7280', label: 'File' },
  hypothesis: { icon: Lightbulb, color: '#eab308', label: 'Hypothesis' },
  motive: { icon: Target, color: '#f97316', label: 'Motive' },
  inventory_object: { icon: Package, color: '#84cc16', label: 'Inventory' },
  tag: { icon: Tag, color: '#ec4899', label: 'Tag' },
};

// Entity types with their plugin IDs (agreed list - no blocknote)
const ENTITY_TYPE_PLUGINS: { type: LinkableEntityType; pluginId: string }[] = [
  { type: 'person', pluginId: 'people-mini-app' },
  { type: 'entity', pluginId: 'entities-mini-app' },
  { type: 'place', pluginId: 'places-mini-app' },
  { type: 'event', pluginId: 'events-mini-app' },
  { type: 'note', pluginId: 'notes-mini-app' },
  { type: 'task', pluginId: 'tasks-mini-app' },
  { type: 'file', pluginId: 'files-mini-app' },
  { type: 'hypothesis', pluginId: 'hypotheses-mini-app' },
  { type: 'motive', pluginId: 'motives-mini-app' },
  { type: 'inventory_object', pluginId: 'inventory-objects-mini-app' },
  { type: 'tag', pluginId: 'tags-mini-app' },
];

// Entity types that have create form modals (all 11 entity types can now be created)
const CREATABLE_ENTITY_TYPES: Set<LinkableEntityType> = new Set([
  'person', 'entity', 'place', 'event', 'note', 'task',
  'file', 'hypothesis', 'motive', 'inventory_object', 'tag',
]);

export function EntitySearchPanel({ isOpen, onClose }: EntitySearchPanelProps) {
  const { nodes, addNode, currentInvestigation, viewport, zoom } = useInvestigationsStore();
  const { isAppEnabled } = useAppsStore();

  // Filter entity types to only show enabled apps
  const enabledEntityTypes = useMemo(() =>
    ENTITY_TYPE_PLUGINS.filter(t => isAppEnabled(t.pluginId)).map(t => t.type),
    [isAppEnabled]
  );

  // Filter to only show entity types that have create modals
  const creatableEntityTypes = useMemo(() =>
    enabledEntityTypes.filter(t => CREATABLE_ENTITY_TYPES.has(t)),
    [enabledEntityTypes]
  );

  const [viewMode, setViewMode] = useState<ViewMode>('search');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<LinkableEntityType | ''>('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  // Modal state for creating new entities
  const [activeModal, setActiveModal] = useState<LinkableEntityType | null>(null);

  // Track search request to prevent race conditions
  const searchIdRef = useRef(0);
  // AbortController for canceling in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Refs to capture latest values for callbacks (prevents stale closures)
  const searchTermRef = useRef(searchTerm);
  const selectedTypeRef = useRef(selectedType);
  const viewportRef = useRef(viewport);
  const zoomRef = useRef(zoom);

  // Get IDs of entities already on canvas (memoized to avoid recalculating on every render)
  const existingEntityIds = useMemo(() => new Set(nodes.map(n => n.entity_id)), [nodes]);

  // Keep refs in sync with state (for use in callbacks to avoid stale closures)
  useEffect(() => { searchTermRef.current = searchTerm; }, [searchTerm]);
  useEffect(() => { selectedTypeRef.current = selectedType; }, [selectedType]);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Get endpoint for entity type
  const getEndpointForType = (entityType: LinkableEntityType): string | null => {
    switch (entityType) {
      case 'person': return '/people';
      case 'entity': return '/entities';
      case 'place': return '/places';
      case 'event': return '/events';
      case 'note': return '/notes';
      case 'task': return '/tasks';
      case 'file': return '/files';
      case 'hypothesis': return '/hypotheses';
      case 'motive': return '/motives';
      case 'inventory_object': return '/inventory-objects';
      case 'tag': return '/tags';
      default: return null;
    }
  };

  // Search for entities across all mini-apps (only enabled ones)
  const searchEntities = useCallback(async (query: string, type: LinkableEntityType | '') => {
    if (!query.trim() && !type) {
      setResults([]);
      return;
    }

    // Cancel any in-flight search request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this search
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Increment search ID to track this request
    const currentSearchId = ++searchIdRef.current;

    setLoading(true);
    try {
      const typesToSearch = type ? [type] : enabledEntityTypes;

      // Search all entity types in parallel for better performance
      const searchPromises = typesToSearch.map(async (entityType): Promise<SearchResult[]> => {
        const endpoint = getEndpointForType(entityType);
        if (!endpoint) return [];

        try {
          // Use search endpoint if there's a query, otherwise use index endpoint to list all
          const hasSearchQuery = query && query.trim().length > 0;
          const url = hasSearchQuery ? `${endpoint}/search` : endpoint;
          const params = hasSearchQuery
            ? { q: query, per_page: 10 }
            : { per_page: 10 };

          const response = await apiClient.get<ApiResponse<{ [key: string]: unknown[] }>>(
            url,
            {
              params,
              signal: controller.signal,
            }
          );
          const data = unwrapResponse(response);

          // Extract results from response (different endpoints have different shapes)
          const items = data.results || data.people || data.entities || data.places ||
                       data.events || data.notes || data.tasks || data.files ||
                       data.hypotheses || data.motives || data.blocknotes ||
                       data.inventory_objects || data.inventory || data.tags || [];

          const results: SearchResult[] = [];
          if (Array.isArray(items)) {
            (items as Record<string, unknown>[]).forEach((item) => {
              if (item.record_id) {
                results.push({
                  record_id: item.record_id as string,
                  entity_type: entityType,
                  label: (item.name || item.title || item.first_name || item.label || item.record_id) as string,
                  subtitle: item.description as string | undefined || item.email as string | undefined,
                });
              }
            });
          }
          return results;
        } catch (err) {
          // Skip aborted requests and other failures
          if (err instanceof Error && err.name === 'AbortError') {
            return [];
          }
          // Skip failed endpoints (some may not have search)
          return [];
        }
      });

      // Wait for all searches to complete in parallel
      const resultsArrays = await Promise.all(searchPromises);

      // Only update results if this is still the current search
      if (searchIdRef.current === currentSearchId && !controller.signal.aborted) {
        // Flatten and deduplicate results by record_id
        // Use a Map to keep only the first occurrence of each record
        const flatResults = resultsArrays.flat();
        const uniqueResults = new Map<string, SearchResult>();
        for (const result of flatResults) {
          // Use record_id as the primary key since it should be globally unique
          if (!uniqueResults.has(result.record_id)) {
            uniqueResults.set(result.record_id, result);
          }
        }
        setResults(Array.from(uniqueResults.values()));
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.error('Search failed');
      if (searchIdRef.current === currentSearchId) {
        setResults([]);
      }
    } finally {
      if (searchIdRef.current === currentSearchId && !controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [enabledEntityTypes]);

  // Handle opening the create modal for an entity type
  const handleOpenCreateModal = (entityType: LinkableEntityType) => {
    setActiveModal(entityType);
  };

  // Handle closing modal
  const handleCloseModal = () => {
    setActiveModal(null);
  };

  // Helper to add entity to canvas after creation
  // Uses refs to get current viewport/zoom values (avoids stale closure if user panned while modal was open)
  const addCreatedEntityToCanvas = useCallback(async (entityType: LinkableEntityType, entityId: string) => {
    if (!currentInvestigation) return;

    try {
      // Use refs for latest viewport/zoom values
      const currentViewport = viewportRef.current;
      const currentZoom = zoomRef.current;
      const viewportCenterX = (-currentViewport.x + 400) / currentZoom;
      const viewportCenterY = (-currentViewport.y + 300) / currentZoom;
      const x = viewportCenterX + (Math.random() - 0.5) * 200;
      const y = viewportCenterY + (Math.random() - 0.5) * 200;

      await addNode({
        entity_type: entityType,
        entity_id: entityId,
        x,
        y,
        width: 200,
        height: 80,
      });
    } catch {
      console.error('Failed to add created entity to canvas');
    }
  }, [currentInvestigation, addNode]);

  // Handle modal completion - close modal, add to canvas, and refresh search
  // Uses refs for searchTerm/selectedType to get latest values (avoids stale closure)
  const handleModalComplete = useCallback(async (createdRecord?: { record_id: string; entity_type?: LinkableEntityType }) => {
    const entityType = createdRecord?.entity_type || activeModal;
    handleCloseModal();
    setViewMode('search');

    // If we got a created record, add it to canvas
    if (createdRecord && entityType) {
      try {
        await addCreatedEntityToCanvas(entityType, createdRecord.record_id);
      } catch {
        console.error('Failed to add created entity to canvas');
        setAddError('Entity was created but failed to add to canvas');
        setTimeout(() => setAddError(null), 3000);
      }
    }

    // Refresh search results using refs for latest values
    searchEntities(searchTermRef.current, selectedTypeRef.current);
  }, [activeModal, addCreatedEntityToCanvas, searchEntities]);

  // For PersonFormModal which uses onSave pattern
  // PersonFormModal creates the person and passes it via the second parameter
  const handlePersonCreated = async (_data: PersonCreateInput, createdPerson?: { record_id: string }) => {
    // Add to canvas and close modal using the already-created person
    if (createdPerson?.record_id) {
      await handleModalComplete({
        record_id: createdPerson.record_id,
        entity_type: 'person',
      });
    } else {
      handleModalComplete();
    }
  };

  // For TagFormModal which uses onSave pattern
  // TagFormModal creates the tag and passes it via the second parameter
  const handleTagCreated = async (_data: TagCreateInput, createdTag?: { record_id: string }) => {
    // Add to canvas and close modal using the already-created tag
    if (createdTag?.record_id) {
      await handleModalComplete({
        record_id: createdTag.record_id,
        entity_type: 'tag',
      });
    } else {
      handleModalComplete();
    }
  };

  // For FileUploadModal - add all uploaded files to canvas
  // Uses refs for searchTerm/selectedType to get latest values (avoids stale closure)
  const handleFileUploadComplete = useCallback(async (uploadedFileIds?: string[]) => {
    handleCloseModal();
    setViewMode('search');

    // Add all uploaded files to canvas
    if (uploadedFileIds && uploadedFileIds.length > 0) {
      for (const fileId of uploadedFileIds) {
        await addCreatedEntityToCanvas('file', fileId);
      }
    }

    // Refresh search to show newly uploaded files using refs for latest values
    searchEntities(searchTermRef.current, selectedTypeRef.current);
  }, [addCreatedEntityToCanvas, searchEntities]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchEntities(searchTerm, selectedType);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedType, searchEntities]);

  // Cleanup AbortController on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Handle adding entity to canvas
  const handleAddEntity = async (result: SearchResult) => {
    if (!currentInvestigation || addingId) return;

    setAddingId(result.record_id);
    setAddError(null);
    try {
      // Calculate position in center of current viewport with some randomness
      // Viewport coordinates are negative of pan, so we invert them
      const viewportCenterX = (-viewport.x + 400) / zoom;
      const viewportCenterY = (-viewport.y + 300) / zoom;
      const x = viewportCenterX + (Math.random() - 0.5) * 200;
      const y = viewportCenterY + (Math.random() - 0.5) * 200;

      await addNode({
        entity_type: result.entity_type,
        entity_id: result.record_id,
        x,
        y,
        width: 200,
        height: 80,
      });
    } catch {
      console.error('Failed to add entity');
      setAddError('Failed to add entity to canvas');
      // Clear error after 3 seconds
      setTimeout(() => setAddError(null), 3000);
    } finally {
      setAddingId(null);
    }
  };

  // Render the appropriate form modal
  const renderModal = () => {
    if (!activeModal) return null;

    switch (activeModal) {
      case 'person':
        // PersonFormModal creates the person and passes it via the second parameter
        return (
          <PersonFormModal
            person={null}
            onClose={handleCloseModal}
            onSave={handlePersonCreated}
            sourcePlugin="investigations-meta-app"
            sourceRecordId={currentInvestigation?.record_id}
          />
        );
      case 'entity':
        // EntityFormModal uses onComplete pattern - it handles its own API call
        return (
          <EntityFormModal
            onClose={handleCloseModal}
            onComplete={(created) => handleModalComplete(created ? { ...created, entity_type: 'entity' } : undefined)}
            sourcePlugin="investigations-meta-app"
            sourceRecordId={currentInvestigation?.record_id}
          />
        );
      case 'place':
        return (
          <PlaceFormModal
            onClose={handleCloseModal}
            onComplete={(created) => handleModalComplete(created ? { ...created, entity_type: 'place' } : undefined)}
            sourcePlugin="investigations-meta-app"
            sourceRecordId={currentInvestigation?.record_id}
          />
        );
      case 'event':
        return (
          <EventFormModal
            onClose={handleCloseModal}
            onComplete={(created) => handleModalComplete(created ? { ...created, entity_type: 'event' } : undefined)}
            sourcePlugin="investigations-meta-app"
            sourceRecordId={currentInvestigation?.record_id}
          />
        );
      case 'note':
        return (
          <NoteFormModal
            onClose={handleCloseModal}
            onComplete={(created) => handleModalComplete(created ? { ...created, entity_type: 'note' } : undefined)}
            sourcePlugin="investigations-meta-app"
            sourceRecordId={currentInvestigation?.record_id}
          />
        );
      case 'task':
        return (
          <TaskFormModal
            onClose={handleCloseModal}
            onComplete={(created) => handleModalComplete(created ? { ...created, entity_type: 'task' } : undefined)}
            sourcePlugin="investigations-meta-app"
            sourceRecordId={currentInvestigation?.record_id}
          />
        );
      case 'hypothesis':
        return (
          <HypothesisFormModal
            onClose={handleCloseModal}
            onComplete={(created) => handleModalComplete(created ? { ...created, entity_type: 'hypothesis' } : undefined)}
            sourcePlugin="investigations-meta-app"
            sourceRecordId={currentInvestigation?.record_id}
          />
        );
      case 'motive':
        return (
          <MotiveFormModal
            onClose={handleCloseModal}
            onComplete={(created) => handleModalComplete(created ? { ...created, entity_type: 'motive' } : undefined)}
            sourcePlugin="investigations-meta-app"
            sourceRecordId={currentInvestigation?.record_id}
          />
        );
      case 'inventory_object':
        return (
          <InventoryFormModal
            onClose={handleCloseModal}
            onComplete={(created) => handleModalComplete(created ? { ...created, entity_type: 'inventory_object' } : undefined)}
            sourcePlugin="investigations-meta-app"
            sourceRecordId={currentInvestigation?.record_id}
          />
        );
      case 'tag':
        // TagFormModal creates the tag and passes it via the second parameter
        return (
          <TagFormModal
            tag={null}
            onClose={handleCloseModal}
            onSave={handleTagCreated}
            sourcePlugin="investigations-meta-app"
            sourceRecordId={currentInvestigation?.record_id}
          />
        );
      case 'file':
        // FileUploadModal for uploading new files
        return (
          <FileUploadModal
            onClose={handleCloseModal}
            onComplete={handleFileUploadComplete}
            sourcePlugin="investigations-meta-app"
            sourceRecordId={currentInvestigation?.record_id}
          />
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="absolute top-4 left-4 right-4 md:left-20 md:right-auto z-50 md:w-80">
        <div className="glass-card shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-space-600">
            <h3 className="font-semibold text-space-100">Add Entity</h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-space-700 rounded transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Mode Tabs */}
          <div className="flex border-b border-space-600">
            <button
              onClick={() => setViewMode('search')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'search'
                  ? 'text-accent border-b-2 border-accent bg-space-800/50'
                  : 'text-space-400 hover:text-space-200'
              }`}
            >
              <Search size={14} className="inline mr-2" />
              Search
            </button>
            <button
              onClick={() => setViewMode('create')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'create'
                  ? 'text-accent border-b-2 border-accent bg-space-800/50'
                  : 'text-space-400 hover:text-space-200'
              }`}
            >
              <PlusCircle size={14} className="inline mr-2" />
              Create New
            </button>
          </div>

          {viewMode === 'search' ? (
            <>
              {/* Search Input */}
              <div className="p-3 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-space-400" size={16} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search entities..."
                    className="input-space pl-10 w-full text-sm"
                    autoFocus
                  />
                </div>

                {/* Type Filter */}
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setSelectedType('')}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      selectedType === ''
                        ? 'bg-accent text-white'
                        : 'bg-space-700 text-space-300 hover:bg-space-600'
                    }`}
                  >
                    All
                  </button>
                  {enabledEntityTypes.map((type) => {
                    const config = ENTITY_CONFIG[type];
                    return (
                      <button
                        key={type}
                        onClick={() => setSelectedType(selectedType === type ? '' : type)}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          selectedType === type
                            ? 'bg-accent text-white'
                            : 'bg-space-700 text-space-300 hover:bg-space-600'
                        }`}
                      >
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add Error */}
              {addError && (
                <div className="mx-3 mb-2 p-2 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-xs">
                  {addError}
                </div>
              )}

              {/* Results */}
              <div className="max-h-64 overflow-y-auto border-t border-space-600">
                {loading ? (
                  <div className="p-4 text-center text-space-400 text-sm">
                    Searching...
                  </div>
                ) : results.length === 0 ? (
                  <div className="p-4 text-center text-space-400 text-sm">
                    {searchTerm || selectedType
                      ? 'No entities found'
                      : 'Type to search or create new entities'}
                  </div>
                ) : (
                  <div className="divide-y divide-space-700">
                    {results.map((result) => {
                      const config = ENTITY_CONFIG[result.entity_type];
                      const Icon = config.icon;
                      const isOnCanvas = existingEntityIds.has(result.record_id);
                      const isAdding = addingId === result.record_id;

                      return (
                        <div
                          key={`${result.entity_type}-${result.record_id}`}
                          className="p-3 hover:bg-space-800/50 flex items-center gap-3"
                        >
                          <div
                            className="flex-shrink-0 p-2 rounded-md"
                            style={{ backgroundColor: `${config.color}20` }}
                          >
                            <div style={{ color: config.color }}>
                              <Icon size={16} />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-space-100 truncate">
                              {String(result.label || '').replace(/<[^>]*>/g, '').slice(0, 200)}
                            </p>
                            <p className="text-xs text-space-400 capitalize">
                              {config.label}
                              {result.subtitle && ` - ${String(result.subtitle).replace(/<[^>]*>/g, '').slice(0, 100)}`}
                            </p>
                          </div>
                          <button
                            onClick={() => handleAddEntity(result)}
                            disabled={isOnCanvas || isAdding}
                            className={`p-1.5 rounded transition-colors ${
                              isOnCanvas
                                ? 'bg-space-700 text-space-500 cursor-not-allowed'
                                : isAdding
                                  ? 'bg-accent/50 text-white'
                                  : 'bg-space-700 text-space-300 hover:bg-accent hover:text-white'
                            }`}
                            title={isOnCanvas ? 'Already on canvas' : 'Add to canvas'}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Create New Entity - Type Selector */
            <div className="p-3 space-y-4">
              <p className="text-xs text-space-400">
                Select an entity type to create. The entity will be added to the canvas.
              </p>

              {/* Entity Type Grid */}
              <div className="grid grid-cols-3 gap-2">
                {creatableEntityTypes.map((type) => {
                  const config = ENTITY_CONFIG[type];
                  const Icon = config.icon;
                  return (
                    <button
                      key={type}
                      onClick={() => handleOpenCreateModal(type)}
                      className="p-3 rounded-lg bg-space-700 hover:bg-space-600 transition-colors flex flex-col items-center gap-2 group"
                    >
                      <div
                        className="p-2 rounded-md transition-colors"
                        style={{ backgroundColor: `${config.color}20`, color: config.color }}
                      >
                        <Icon size={20} />
                      </div>
                      <span className="text-xs text-space-300 group-hover:text-space-100 truncate w-full text-center">
                        {config.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="text-xs text-space-500 text-center">
                Click an entity type above to create it
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Render active modal */}
      {renderModal()}
    </>
  );
}
