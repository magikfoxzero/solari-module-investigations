<?php

namespace NewSolari\Investigations;

use NewSolari\Core\Identity\Models\IdentityUser;
use NewSolari\Investigations\Models\Investigation;
use NewSolari\Investigations\Models\InvestigationConnection;
use NewSolari\Core\Plugin\MetaAppBase;

/**
 * Investigations Meta-App Plugin.
 *
 * Provides canvas-based investigation functionality for linking and visualizing
 * entities from mini-apps with timeline, mind mapping, and real-time collaboration.
 */
class InvestigationsPlugin extends MetaAppBase
{
    /**
     * InvestigationsPlugin constructor.
     */
    public function __construct()
    {
        parent::__construct();

        $this->pluginId = 'investigations-meta-app';
        $this->pluginName = 'Investigations';
        $this->description = 'Canvas-based investigation tool for linking and visualizing entities';
        $this->version = '1.0.0';

        $this->permissions = [
            'investigations.create',
            'investigations.read',
            'investigations.update',
            'investigations.delete',
            'investigations.manage',
            'investigations.export',
        ];

        $this->miniAppDependencies = [
            'people-mini-app',
            'places-mini-app',
            'events-mini-app',
            'entities-mini-app',
            'notes-mini-app',
            'tasks-mini-app',
            'files-mini-app',
            'hypotheses-mini-app',
            'motives-mini-app',
            'blocknotes-mini-app',
            'inventory-objects-mini-app',
        ];

        $this->routes = [
            '/api/investigations',
            '/api/investigations/{id}',
            '/api/investigations/search',
            '/api/investigations/export',
            '/api/investigations/stats',
            '/api/investigations/{id}/canvas',
            '/api/investigations/{id}/timeline',
            '/api/investigations/{id}/graph',
            '/api/investigations/{id}/layout',
            '/api/investigations/{id}/nodes',
            '/api/investigations/{id}/nodes/bulk',
            '/api/investigations/{id}/nodes/positions',
            '/api/investigations/{id}/nodes/{nodeId}',
            '/api/investigations/{id}/connections',
            '/api/investigations/{id}/connections/{connId}',
            '/api/investigations/{id}/drawings',
            '/api/investigations/{id}/drawings/batch',
            '/api/investigations/{id}/drawings/{drawingId}',
            '/api/investigations/{id}/relationships/existing',
        ];

        $this->database = [
            'migrations' => [
                'create_investigations_tables',
                'add_mindcanvas_features_to_investigations',
            ],
            'models' => [
                'Investigation',
                'InvestigationNode',
                'InvestigationConnection',
                'InvestigationDrawing',
            ],
        ];
    }

    /**
     * Get the container model class.
     */
    public function getContainerModel(): string
    {
        return Investigation::class;
    }

    /**
     * Get container data validation rules.
     */
    public function getValidationRules(): array
    {
        return [
            'record_id' => 'sometimes|string|max:36',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'status' => 'nullable|string|in:open,in_progress,on_hold,closed,archived',
            'priority' => 'nullable|string|in:low,medium,high,critical',
            'case_number' => 'nullable|string|max:100',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'due_date' => 'nullable|date',
            'canvas_state' => 'nullable|array',
            'default_layout' => 'nullable|string|in:freeform,grid,timeline,hierarchical,radial,force-directed',
            'is_public' => 'boolean',
            'partition_id' => 'sometimes|string|max:36|exists:identity_partitions,record_id',
            'created_by' => 'sometimes|string|max:36|exists:identity_users,record_id',
            'updated_by' => 'nullable|string|max:36|exists:identity_users,record_id',
        ];
    }

    /**
     * Get the list of entity types that can be linked to investigations.
     * 11 types (no blocknote).
     */
    public function getLinkableEntityTypes(): array
    {
        return [
            'person',
            'entity',
            'place',
            'event',
            'note',
            'task',
            'file',
            'hypothesis',
            'motive',
            'inventory_object',
            'tag',
        ];
    }

    /**
     * Get timeline date fields for each linkable entity type.
     * Simplified to only show events with start_date and end_date.
     */
    public function getTimelineDateFields(): array
    {
        return [
            'person' => [],
            'entity' => [],
            'place' => [],
            'event' => ['start_date', 'end_date'],
            'note' => [],
            'task' => [],
            'file' => [],
            'hypothesis' => [],
            'motive' => [],
            'inventory_object' => [],
            'tag' => [],
        ];
    }

    /**
     * Get visual configuration for each linkable entity type.
     */
    public function getEntityVisualConfig(): array
    {
        return [
            'person' => [
                'icon' => 'user',
                'color' => '#3b82f6',
                'backgroundColor' => '#dbeafe',
                'borderColor' => '#3b82f6',
            ],
            'entity' => [
                'icon' => 'building',
                'color' => '#8b5cf6',
                'backgroundColor' => '#ede9fe',
                'borderColor' => '#8b5cf6',
            ],
            'place' => [
                'icon' => 'map-pin',
                'color' => '#10b981',
                'backgroundColor' => '#d1fae5',
                'borderColor' => '#10b981',
            ],
            'event' => [
                'icon' => 'calendar',
                'color' => '#ef4444',
                'backgroundColor' => '#fee2e2',
                'borderColor' => '#ef4444',
            ],
            'note' => [
                'icon' => 'file-text',
                'color' => '#f59e0b',
                'backgroundColor' => '#fef3c7',
                'borderColor' => '#f59e0b',
            ],
            'task' => [
                'icon' => 'check-square',
                'color' => '#06b6d4',
                'backgroundColor' => '#cffafe',
                'borderColor' => '#06b6d4',
            ],
            'file' => [
                'icon' => 'paperclip',
                'color' => '#6b7280',
                'backgroundColor' => '#f3f4f6',
                'borderColor' => '#6b7280',
            ],
            'hypothesis' => [
                'icon' => 'lightbulb',
                'color' => '#eab308',
                'backgroundColor' => '#fef9c3',
                'borderColor' => '#eab308',
            ],
            'motive' => [
                'icon' => 'target',
                'color' => '#f97316',
                'backgroundColor' => '#ffedd5',
                'borderColor' => '#f97316',
            ],
            'inventory_object' => [
                'icon' => 'package',
                'color' => '#84cc16',
                'backgroundColor' => '#ecfccb',
                'borderColor' => '#84cc16',
            ],
            'tag' => [
                'icon' => 'tag',
                'color' => '#ec4899',
                'backgroundColor' => '#fce7f3',
                'borderColor' => '#ec4899',
            ],
        ];
    }

    /**
     * Get integration routes.
     */
    public function getIntegrationRoutes(): array
    {
        return $this->routes;
    }

    /**
     * Initialize integration logic.
     */
    protected function initializeIntegrationLogic()
    {
        // Integration logic is handled through the MetaAppBase methods
        // and the specific services (TimelineService, LayoutService)
    }

    /**
     * Apply search filter to investigation query.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     */
    protected function applySearchFilter($query, string $searchTerm): void
    {
        // Escape LIKE special characters to prevent pattern injection
        $escaped = str_replace(['%', '_'], ['\%', '\_'], $searchTerm);
        $query->where(function ($q) use ($escaped) {
            $q->where('title', 'LIKE', '%' . $escaped . '%')
              ->orWhere('description', 'LIKE', '%' . $escaped . '%')
              ->orWhere('case_number', 'LIKE', '%' . $escaped . '%')
              ->orWhere('status', 'LIKE', '%' . $escaped . '%')
              ->orWhere('priority', 'LIKE', '%' . $escaped . '%');
        });
    }

    /**
     * Get investigations with additional related data.
     *
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function getInvestigationsQuery(IdentityUser $user, array $filters = [], bool $withRelations = false)
    {
        $query = $this->getContainerQuery($user, $filters);

        // Always include node count for display in list view
        $query->withCount('nodes');

        if ($withRelations) {
            $query->with(['nodes', 'connections']);
        }

        // Default sorting
        $query->orderBy('updated_at', 'desc');

        return $query;
    }

    /**
     * Get investigation statistics for the user.
     * Uses aggregate queries to avoid loading all records into memory.
     */
    public function getStatistics(IdentityUser $user): array
    {
        $baseQuery = $this->getContainerQuery($user);

        // Use aggregate queries instead of loading all records
        $total = (clone $baseQuery)->count();
        $byStatus = (clone $baseQuery)
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $byPriority = (clone $baseQuery)
            ->selectRaw('priority, COUNT(*) as count')
            ->groupBy('priority')
            ->pluck('count', 'priority')
            ->toArray();

        $byPublic = (clone $baseQuery)
            ->selectRaw('is_public, COUNT(*) as count')
            ->groupBy('is_public')
            ->pluck('count', 'is_public')
            ->toArray();

        // For node/connection counts, we need to count all nodes across all investigations
        // Use a direct query on the nodes table for accuracy
        $investigationIds = (clone $baseQuery)->pluck('record_id');
        $totalNodes = \NewSolari\Investigations\Models\InvestigationNode::whereIn('investigation_id', $investigationIds)->count();
        $totalConnections = \NewSolari\Investigations\Models\InvestigationConnection::whereIn('investigation_id', $investigationIds)->count();

        // "active" is a computed value = open + in_progress
        $openCount = $byStatus[Investigation::STATUS_OPEN] ?? 0;
        $inProgressCount = $byStatus[Investigation::STATUS_IN_PROGRESS] ?? 0;
        $activeCount = $openCount + $inProgressCount;

        return [
            'total' => $total,
            'total_investigations' => $total,
            'by_status' => [
                'open' => $openCount,
                'active' => $activeCount,
                'in_progress' => $inProgressCount,
                'on_hold' => $byStatus[Investigation::STATUS_ON_HOLD] ?? 0,
                'closed' => $byStatus[Investigation::STATUS_CLOSED] ?? 0,
                'archived' => $byStatus[Investigation::STATUS_ARCHIVED] ?? 0,
            ],
            'open_investigations' => $openCount,
            'in_progress_investigations' => $inProgressCount,
            'on_hold_investigations' => $byStatus[Investigation::STATUS_ON_HOLD] ?? 0,
            'closed_investigations' => $byStatus[Investigation::STATUS_CLOSED] ?? 0,
            'archived_investigations' => $byStatus[Investigation::STATUS_ARCHIVED] ?? 0,
            'by_priority' => $byPriority,
            'total_nodes' => $totalNodes,
            'total_connections' => $totalConnections,
            'public_investigations' => $byPublic[1] ?? $byPublic['1'] ?? 0,
            'private_investigations' => $byPublic[0] ?? $byPublic['0'] ?? 0,
        ];
    }

    /**
     * Get node validation rules.
     */
    public function getNodeValidationRules(): array
    {
        return [
            'investigation_id' => 'required|string|max:36|exists:investigations,record_id',
            'entity_type' => 'required|string|max:64',
            'entity_id' => 'required|string|max:36',
            'x' => 'nullable|numeric',
            'y' => 'nullable|numeric',
            'width' => 'nullable|numeric|min:50|max:800',
            'height' => 'nullable|numeric|min:30|max:600',
            'z_index' => 'nullable|integer',
            'style' => 'nullable|array',
            'label_override' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'tags' => 'nullable|array|max:50',
            'tags.*' => 'string|max:100',
            'is_pinned' => 'nullable|boolean',
            'is_collapsed' => 'nullable|boolean',
        ];
    }

    /**
     * Validate node data.
     */
    public function validateNodeData(array $data): array
    {
        $rules = $this->getNodeValidationRules();

        $validator = \Illuminate\Support\Facades\Validator::make($data, $rules);

        if ($validator->fails()) {
            throw new \Illuminate\Validation\ValidationException($validator);
        }

        // Validate entity type is linkable
        if (! in_array($data['entity_type'], $this->getLinkableEntityTypes())) {
            throw new \InvalidArgumentException("Entity type '{$data['entity_type']}' is not linkable to investigations");
        }

        return $validator->validated();
    }

    /**
     * Get connection validation rules.
     */
    public function getConnectionValidationRules(): array
    {
        $validAnchors = implode(',', InvestigationConnection::VALID_ANCHORS);

        return [
            'investigation_id' => 'required|string|max:36|exists:investigations,record_id',
            'from_node_id' => 'required|string|max:36|exists:investigation_nodes,record_id',
            'to_node_id' => 'required|string|max:36|exists:investigation_nodes,record_id|different:from_node_id',
            'from_side' => "nullable|string|in:{$validAnchors}",
            'to_side' => "nullable|string|in:{$validAnchors}",
            'style' => 'nullable|string|in:solid,dashed,dotted',
            'path_type' => 'nullable|string|in:curved,straight,orthogonal',
            'color' => 'nullable|string|max:7|regex:/^#[a-fA-F0-9]{6}$/',
            'thickness' => 'nullable|numeric|min:0.5|max:10',
            'arrow_type' => 'nullable|string|in:none,forward,backward,both',
            'relationship_type' => 'nullable|string|max:64',
            'relationship_label' => 'nullable|string|max:255',
            'sentiment' => 'nullable|string|in:neutral,positive,negative',
            'weight' => 'nullable|integer|min:1|max:10',
            'notes' => 'nullable|string',
        ];
    }

    /**
     * Validate connection data.
     */
    public function validateConnectionData(array $data): array
    {
        $rules = $this->getConnectionValidationRules();

        $validator = \Illuminate\Support\Facades\Validator::make($data, $rules);

        if ($validator->fails()) {
            throw new \Illuminate\Validation\ValidationException($validator);
        }

        return $validator->validated();
    }

    /**
     * Get canvas state validation rules.
     */
    public function getCanvasStateValidationRules(): array
    {
        return [
            'zoom' => 'nullable|numeric|min:0.1|max:4',
            'panX' => 'nullable|numeric|between:-100000,100000',
            'panY' => 'nullable|numeric|between:-100000,100000',
            'layoutType' => 'nullable|string|in:freeform,grid,timeline,hierarchical,radial,force-directed',
        ];
    }

    /**
     * Validate canvas state data.
     */
    public function validateCanvasStateData(array $data): array
    {
        $rules = $this->getCanvasStateValidationRules();

        $validator = \Illuminate\Support\Facades\Validator::make($data, $rules);

        if ($validator->fails()) {
            throw new \Illuminate\Validation\ValidationException($validator);
        }

        return $validator->validated();
    }
}
