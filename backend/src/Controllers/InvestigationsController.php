<?php

namespace NewSolari\Investigations\Controllers;

use NewSolari\Core\Http\Traits\RelationshipControllerTrait;
use NewSolari\Investigations\Events\CanvasStateUpdated;
use NewSolari\Investigations\Events\ConnectionAdded;
use NewSolari\Investigations\Events\ConnectionRemoved;
use NewSolari\Investigations\Events\ConnectionUpdated;
use NewSolari\Investigations\Events\DrawingAdded;
use NewSolari\Investigations\Events\DrawingRemoved;
use NewSolari\Investigations\Events\DrawingUpdated;
use NewSolari\Investigations\Events\NodeAdded;
use NewSolari\Investigations\Events\NodeMoved;
use NewSolari\Investigations\Events\NodeRemoved;
use NewSolari\Investigations\Events\NodeUpdated;
use NewSolari\Identity\Models\IdentityUser;
use NewSolari\Investigations\InvestigationsPlugin;
use NewSolari\Investigations\Models\Investigation;
use NewSolari\Investigations\Models\InvestigationConnection;
use NewSolari\Investigations\Models\InvestigationDrawing;
use NewSolari\Investigations\Models\InvestigationNode;
use NewSolari\Investigations\Services\LayoutService;
use NewSolari\Investigations\Services\RelationshipDetectionService;
use NewSolari\Investigations\Services\TimelineService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

use NewSolari\Core\Http\BaseController;

class InvestigationsController extends BaseController
{
    use RelationshipControllerTrait;

    /**
     * The Investigations plugin instance.
     */
    protected ?InvestigationsPlugin $plugin = null;

    /**
     * Service instances (lazy-loaded).
     */
    protected ?TimelineService $timelineService = null;
    protected ?LayoutService $layoutService = null;
    protected ?RelationshipDetectionService $relationshipService = null;

    /**
     * Get the Investigations plugin instance.
     */
    protected function getPlugin(): InvestigationsPlugin
    {
        if (!$this->plugin) {
            $this->plugin = new InvestigationsPlugin();
        }
        return $this->plugin;
    }

    /**
     * Get the TimelineService instance.
     */
    protected function getTimelineService(): TimelineService
    {
        if (!$this->timelineService) {
            $this->timelineService = new TimelineService($this->getPlugin());
        }
        return $this->timelineService;
    }

    /**
     * Get the LayoutService instance.
     */
    protected function getLayoutService(): LayoutService
    {
        if (!$this->layoutService) {
            $this->layoutService = new LayoutService();
        }
        return $this->layoutService;
    }

    /**
     * Get the RelationshipDetectionService instance.
     */
    protected function getRelationshipService(): RelationshipDetectionService
    {
        if (!$this->relationshipService) {
            $this->relationshipService = new RelationshipDetectionService($this->getPlugin());
        }
        return $this->relationshipService;
    }

    /**
     * List investigations with pagination and filtering.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $user = $this->getAuthenticatedUser($request);

            $plugin = $this->getPlugin();
            if (!$plugin->checkUserPermission($user, 'investigations.read')) {
                return $this->errorResponse('Permission denied', 403);
            }

            $filters = $request->only(['status', 'priority', 'search', 'is_public', 'folder_id']);
            $perPage = min((int) $request->get('per_page', 15), 100);
            $withRelations = $request->boolean('with_relations', false);

            // getInvestigationsQuery handles all filters including search
            $query = $plugin->getInvestigationsQuery($user, $filters, $withRelations);

            $investigations = $query->paginate($perPage);

            return $this->successResponse([
                'investigations' => $investigations->items(),
                'pagination' => [
                    'current_page' => $investigations->currentPage(),
                    'last_page' => $investigations->lastPage(),
                    'per_page' => $investigations->perPage(),
                    'total' => $investigations->total(),
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('List investigations failed', ['error' => $e->getMessage()]);
            return $this->errorResponse('Failed to list investigations', 500);
        }
    }

    /**
     * Create a new investigation.
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $user = $this->getAuthenticatedUser($request);

            $plugin = $this->getPlugin();
            if (!$plugin->checkUserPermission($user, 'investigations.create')) {
                return $this->errorResponse('Permission denied', 403);
            }

            // Get validation rules and make system fields optional (they're auto-populated)
            $rules = $plugin->getValidationRules();
            unset($rules['partition_id'], $rules['created_by']);

            $validator = Validator::make($request->all(), $rules);
            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 422, ['errors' => $validator->errors()]);
            }

            $data = $validator->validated();
            $data['partition_id'] = $user->partition_id;
            $data['created_by'] = $user->record_id;

            $investigation = $plugin->createContainerItem($data, $user);

            return $this->successResponse([
                'investigation' => $investigation->toArray(),
                'message' => 'Investigation created successfully',
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse('Validation failed', 422, ['errors' => $e->errors()]);
        } catch (\Exception $e) {
            Log::error('Create investigation failed', ['error' => $e->getMessage()]);
            return $this->errorResponse('Failed to create investigation', 500);
        }
    }

    /**
     * Get a single investigation with nodes and connections.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        try {
            $user = $this->getAuthenticatedUser($request);

            $investigation = Investigation::with(['nodes', 'connections', 'drawings', 'creator'])->find($id);
            if (!$investigation) {
                return $this->errorResponse('Investigation not found', 404);
            }

            $plugin = $this->getPlugin();
            if (!$plugin->checkDataAccess($investigation, $user, 'read')) {
                return $this->errorResponse('Permission denied', 403);
            }

            // Filter nodes based on user access to linked entities
            $visibleNodes = $plugin->getVisibleNodesForUser($investigation->nodes, $user);

            return $this->successResponse([
                'investigation' => array_merge($investigation->toArray(), [
                    'visible_nodes' => $visibleNodes,
                ]),
            ]);
        } catch (\Exception $e) {
            Log::error('Show investigation failed', ['error' => $e->getMessage(), 'id' => $id]);
            return $this->errorResponse('Failed to retrieve investigation', 500);
        }
    }

    /**
     * Update an investigation.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        try {
            $user = $this->getAuthenticatedUser($request);

            $investigation = Investigation::find($id);
            if (!$investigation) {
                return $this->errorResponse('Investigation not found', 404);
            }

            $plugin = $this->getPlugin();
            if (!$plugin->checkDataAccess($investigation, $user, 'update')) {
                return $this->errorResponse('Permission denied', 403);
            }

            $rules = $plugin->getValidationRules();
            $rules['title'] = 'sometimes|string|max:255'; // Make title optional for updates
            unset($rules['partition_id'], $rules['created_by']); // Cannot change these

            $validator = Validator::make($request->all(), $rules);
            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 422, ['errors' => $validator->errors()]);
            }

            $data = $validator->validated();
            $data['updated_by'] = $user->record_id;

            $plugin->updateContainerItem($investigation, $data, $user);
            $investigation->refresh(); // Reload to get updated values

            return $this->successResponse([
                'investigation' => $investigation->toArray(),
                'message' => 'Investigation updated successfully',
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse('Validation failed', 422, ['errors' => $e->errors()]);
        } catch (\Exception $e) {
            Log::error('Update investigation failed', ['error' => $e->getMessage(), 'id' => $id]);
            return $this->errorResponse('Failed to update investigation', 500);
        }
    }

    /**
     * Delete an investigation.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        try {
            Log::info('Investigation delete requested', ['investigation_id' => $id]);

            $user = $this->getAuthenticatedUser($request);

            $investigation = Investigation::find($id);
            if (!$investigation) {
                return $this->errorResponse('Investigation not found', 404);
            }

            $plugin = $this->getPlugin();
            if (!$plugin->checkDataAccess($investigation, $user, 'delete')) {
                return $this->errorResponse('Permission denied', 403);
            }

            Log::info('Calling deleteContainerItem', [
                'investigation_id' => $id,
                'user_id' => $user->record_id,
            ]);

            $plugin->deleteContainerItem($investigation, $user);

            Log::info('Investigation deleted successfully', ['investigation_id' => $id]);

            return $this->successResponse([
                'message' => 'Investigation deleted successfully',
                'deleted_id' => $id,
                'code_version' => '2026-01-03-cascade-delete',
            ]);
        } catch (\Exception $e) {
            Log::error('Delete investigation failed', ['error' => $e->getMessage(), 'id' => $id]);
            return $this->errorResponse('Failed to delete investigation', 500);
        }
    }

    /**
     * Search investigations.
     */
    public function search(Request $request): JsonResponse
    {
        try {
            $user = $this->getAuthenticatedUser($request);

            $plugin = $this->getPlugin();
            if (!$plugin->checkUserPermission($user, 'investigations.read')) {
                return $this->errorResponse('Permission denied', 403);
            }

            $query = $request->get('q', '');
            $perPage = min((int) $request->get('per_page', 15), 100);
            $filters = $request->only(['folder_id']);

            // Escape LIKE special characters to prevent pattern injection
            $escapedQuery = str_replace(['%', '_'], ['\%', '\_'], $query);
            $investigations = $plugin->getInvestigationsQuery($user, $filters)
                ->where(function ($q) use ($escapedQuery) {
                    $q->where('title', 'LIKE', '%' . $escapedQuery . '%')
                      ->orWhere('description', 'LIKE', '%' . $escapedQuery . '%')
                      ->orWhere('case_number', 'LIKE', '%' . $escapedQuery . '%');
                })
                ->paginate($perPage);

            return $this->successResponse([
                'investigations' => $investigations->items(),
                'pagination' => [
                    'current_page' => $investigations->currentPage(),
                    'last_page' => $investigations->lastPage(),
                    'per_page' => $investigations->perPage(),
                    'total' => $investigations->total(),
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Search investigations failed', ['error' => $e->getMessage()]);
            return $this->errorResponse('Failed to search investigations', 500);
        }
    }

    /**
     * Export investigations.
     */
    public function export(Request $request): JsonResponse
    {
        try {
            $user = $this->getAuthenticatedUser($request);

            $plugin = $this->getPlugin();
            if (!$plugin->checkUserPermission($user, 'investigations.export')) {
                return $this->errorResponse('Permission denied', 403);
            }

            $filters = $request->only(['status', 'priority', 'is_public']);
            $includeRelations = $request->boolean('include_relations', false);

            // Lower limit when including relations to prevent memory exhaustion
            $maxLimit = $includeRelations ? 500 : 5000;
            $limit = min((int) $request->get('limit', 1000), $maxLimit);

            $investigations = $plugin->getInvestigationsQuery($user, $filters, $includeRelations)
                ->limit($limit)
                ->get();

            return $this->successResponse([
                'investigations' => $investigations->toArray(),
                'count' => $investigations->count(),
                'limit' => $limit,
                'exported_at' => now()->toIso8601String(),
            ]);
        } catch (\Exception $e) {
            Log::error('Export investigations failed', ['error' => $e->getMessage()]);
            return $this->errorResponse('Failed to export investigations', 500);
        }
    }

    /**
     * Get investigation statistics.
     */
    public function statistics(Request $request): JsonResponse
    {
        try {
            $user = $this->getAuthenticatedUser($request);

            $plugin = $this->getPlugin();
            if (!$plugin->checkUserPermission($user, 'investigations.read')) {
                return $this->errorResponse('Permission denied', 403);
            }

            $stats = $plugin->getStatistics($user);

            return $this->successResponse(['statistics' => $stats]);
        } catch (\Exception $e) {
            Log::error('Get investigation statistics failed', ['error' => $e->getMessage()]);
            return $this->errorResponse('Failed to get statistics', 500);
        }
    }

    /**
     * Update canvas state (zoom, pan, etc.)
     */
    public function updateCanvas(Request $request, string $id): JsonResponse
    {
        try {
            $user = $this->getAuthenticatedUser($request);

            $investigation = Investigation::find($id);
            if (!$investigation) {
                return $this->errorResponse('Investigation not found', 404);
            }

            $plugin = $this->getPlugin();
            if (!$plugin->checkDataAccess($investigation, $user, 'update')) {
                return $this->errorResponse('Permission denied', 403);
            }

            $validated = $plugin->validateCanvasStateData($request->all());
            $investigation->updateCanvasState($validated);

            // Broadcast canvas state updated event
            CanvasStateUpdated::dispatch($investigation, $user, $investigation->canvas_state);

            return $this->successResponse([
                'canvas_state' => $investigation->canvas_state,
                'message' => 'Canvas state updated successfully',
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse('Validation failed', 422, ['errors' => $e->errors()]);
        } catch (\Exception $e) {
            Log::error('Update canvas state failed', ['error' => $e->getMessage(), 'id' => $id]);
            return $this->errorResponse('Failed to update canvas state', 500);
        }
    }

    // ==================== Node Management ====================

    /**
     * Add a node to the investigation canvas.
     */
    public function storeNode(Request $request, string $investigationId): JsonResponse
    {
        try {
            $user = $this->getAuthenticatedUser($request);

            $investigation = Investigation::find($investigationId);
            if (!$investigation) {
                return $this->errorResponse('Investigation not found', 404);
            }

            $plugin = $this->getPlugin();
            if (!$plugin->checkDataAccess($investigation, $user, 'update')) {
                return $this->errorResponse('Permission denied', 403);
            }

            // Check if entity already exists on canvas
            $entityType = $request->input('entity_type');
            $entityId = $request->input('entity_id');

            // Validate required fields
            if (empty($entityType) || empty($entityId)) {
                return $this->errorResponse('entity_type and entity_id are required', 400);
            }

            // Validate entity_type is in the linkable list (prevents injection)
            if (!in_array($entityType, $plugin->getLinkableEntityTypes())) {
                return $this->errorResponse('Invalid entity type', 400);
            }

            // Check if entity already exists on canvas (including soft-deleted)
            $existingNode = InvestigationNode::withoutGlobalScope('notDeleted')
                ->where('investigation_id', $investigationId)
                ->where('entity_type', $entityType)
                ->where('entity_id', $entityId)
                ->first();

            if ($existingNode) {
                if (!$existingNode->deleted) {
                    // Node exists and is not deleted
                    return $this->errorResponse('Entity already on canvas', 409);
                }

                // Node was soft-deleted, restore it with new position
                $existingNode->update([
                    'x' => $request->input('x', $existingNode->x),
                    'y' => $request->input('y', $existingNode->y),
                    'width' => $request->input('width', $existingNode->width),
                    'height' => $request->input('height', $existingNode->height),
                    'deleted' => false,
                    'deleted_by' => null,
                ]);

                // Broadcast node added event
                NodeAdded::dispatch($existingNode, $user);

                // Include display_label in response
                $restoredNode = $existingNode->fresh();
                $nodeData = $restoredNode->toArray();
                $nodeData['display_label'] = $restoredNode->display_label;

                return $this->successResponse([
                    'node' => $nodeData,
                    'message' => 'Node restored successfully',
                ], 201);
            }

            // Verify the entity actually exists and user can access it
            $linkedEntity = $plugin->resolveEntity($entityType, $entityId);
            if (!$linkedEntity) {
                return $this->errorResponse('Entity not found', 404);
            }

            // Check user has access to the entity being linked
            if (!$plugin->canUserAccessLinkedEntity($entityType, $entityId, $user)) {
                return $this->errorResponse('You do not have access to this entity', 403);
            }

            $data = $request->all();
            $data['investigation_id'] = $investigationId;
            $validated = $plugin->validateNodeData($data);
            $validated['partition_id'] = $investigation->partition_id;

            $node = InvestigationNode::create($validated);

            // Broadcast node added event
            NodeAdded::dispatch($node, $user);

            // Include display_label in response (accessor not included in toArray by default)
            $nodeData = $node->toArray();
            $nodeData['display_label'] = $node->display_label;

            return $this->successResponse([
                'node' => $nodeData,
                'message' => 'Node added successfully',
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse('Validation failed', 422, ['errors' => $e->errors()]);
        } catch (\InvalidArgumentException $e) {
            return $this->errorResponse($e->getMessage(), 400);
        } catch (\Exception $e) {
            Log::error('Add node failed', ['error' => $e->getMessage()]);
            return $this->errorResponse('Failed to add node', 500);
        }
    }

    /**
     * Update a node's position/style.
     */
    public function updateNode(Request $request, string $investigationId, string $nodeId): JsonResponse
    {
        try {
            $user = $this->getAuthenticatedUser($request);

            $investigation = Investigation::find($investigationId);
            if (!$investigation) {
                return $this->errorResponse('Investigation not found', 404);
            }

            $plugin = $this->getPlugin();
            if (!$plugin->checkDataAccess($investigation, $user, 'update')) {
                return $this->errorResponse('Permission denied', 403);
            }

            $node = InvestigationNode::where('record_id', $nodeId)
                ->where('investigation_id', $investigationId)
                ->first();
            if (!$node) {
                return $this->errorResponse('Node not found', 404);
            }

            $data = $request->only(['x', 'y', 'width', 'height', 'z_index', 'style', 'label_override', 'notes', 'tags', 'is_pinned', 'is_collapsed']);

            // Validate numeric fields have reasonable bounds
            $validator = Validator::make($data, [
                'x' => 'nullable|numeric|between:-100000,100000',
                'y' => 'nullable|numeric|between:-100000,100000',
                'width' => 'nullable|numeric|min:50|max:800',
                'height' => 'nullable|numeric|min:30|max:600',
                'z_index' => 'nullable|integer|between:0,10000',
                'style' => 'nullable|array',
                'label_override' => 'nullable|string|max:255',
                'notes' => 'nullable|string|max:10000',
                'tags' => 'nullable|array|max:50',
                'tags.*' => 'string|max:100',
                'is_pinned' => 'nullable|boolean',
                'is_collapsed' => 'nullable|boolean',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 422, ['errors' => $validator->errors()]);
            }

            // Track if only position changed for more specific event
            $validated = $validator->validated();
            $positionOnly = count(array_diff(array_keys($validated), ['x', 'y', 'z_index'])) === 0;

            $node->fill($validated);
            $node->save();

            // Broadcast appropriate event
            if ($positionOnly && (isset($validated['x']) || isset($validated['y']))) {
                NodeMoved::dispatch($node, $user);
            } else {
                NodeUpdated::dispatch($node, $user);
            }

            return $this->successResponse([
                'node' => $node->toArray(),
                'message' => 'Node updated successfully',
            ]);
        } catch (\Exception $e) {
            Log::error('Update node failed', ['error' => $e->getMessage()]);
            return $this->errorResponse('Failed to update node', 500);
        }
    }

    /**
     * Remove a node from the canvas.
     */
    public function destroyNode(Request $request, string $investigationId, string $nodeId): JsonResponse
    {
        try {
            $user = $this->getAuthenticatedUser($request);

            $investigation = Investigation::find($investigationId);
            if (!$investigation) {
                return $this->errorResponse('Investigation not found', 404);
            }

            $plugin = $this->getPlugin();
            if (!$plugin->checkDataAccess($investigation, $user, 'update')) {
                return $this->errorResponse('Permission denied', 403);
            }

            $node = InvestigationNode::where('record_id', $nodeId)
                ->where('investigation_id', $investigationId)
                ->first();
            if (!$node) {
                return $this->errorResponse('Node not found', 404);
            }

            // Get IDs of connections that will be deleted (for broadcasting)
            $affectedConnectionIds = InvestigationConnection::where('investigation_id', $investigationId)
                ->where(function ($query) use ($nodeId) {
                    $query->where('from_node_id', $nodeId)
                          ->orWhere('to_node_id', $nodeId);
                })
                ->pluck('record_id')
                ->toArray();

            // Soft delete node with audit trail
            $node->deleted_by = $user->record_id;
            $node->delete();

            // Also soft delete related connections (scoped to this investigation)
            InvestigationConnection::where('investigation_id', $investigationId)
                ->where(function ($query) use ($nodeId) {
                    $query->where('from_node_id', $nodeId)
                          ->orWhere('to_node_id', $nodeId);
                })
                ->update(['deleted' => true, 'deleted_by' => $user->record_id]);

            // Broadcast node removed event
            NodeRemoved::dispatch($nodeId, $investigationId, $user);

            // Broadcast connection removed events for affected connections
            foreach ($affectedConnectionIds as $connectionId) {
                ConnectionRemoved::dispatch($connectionId, $investigationId, $user);
            }

            return $this->successResponse([
                'message' => 'Node removed successfully',
            ]);
        } catch (\Exception $e) {
            Log::error('Remove node failed', ['error' => $e->getMessage()]);
            return $this->errorResponse('Failed to remove node', 500);
        }
    }

    /**
     * Bulk add multiple entities to the canvas.
     */
    public function bulkStoreNodes(Request $request, string $investigationId): JsonResponse
    {
        try {
            $user = $this->getAuthenticatedUser($request);

            $investigation = Investigation::find($investigationId);
            if (!$investigation) {
                return $this->errorResponse('Investigation not found', 404);
            }

            $plugin = $this->getPlugin();
            if (!$plugin->checkDataAccess($investigation, $user, 'update')) {
                return $this->errorResponse('Permission denied', 403);
            }

            $entities = $request->input('entities', []);
            if (empty($entities) || !is_array($entities)) {
                return $this->errorResponse('Invalid entities data', 400);
            }

            // Limit batch size to prevent DoS
            if (count($entities) > 100) {
                return $this->errorResponse('Too many entities in batch (max 100)', 400);
            }

            $linkableTypes = $plugin->getLinkableEntityTypes();
            $created = [];
            $createdNodes = [];
            $skipped = [];

            DB::transaction(function () use ($entities, $investigation, $user, $plugin, $linkableTypes, &$created, &$createdNodes, &$skipped) {
                foreach ($entities as $index => $entity) {
                    // Validate required fields
                    if (!isset($entity['entity_type'], $entity['entity_id'])) {
                        $skipped[] = ['index' => $index, 'reason' => 'Missing entity_type or entity_id'];
                        continue;
                    }

                    $entityType = $entity['entity_type'];
                    $entityId = $entity['entity_id'];

                    // Validate entity type
                    if (!in_array($entityType, $linkableTypes)) {
                        $skipped[] = ['index' => $index, 'reason' => 'Invalid entity type'];
                        continue;
                    }

                    // Check if already on canvas
                    if ($investigation->hasEntity($entityType, $entityId)) {
                        $skipped[] = ['index' => $index, 'reason' => 'Entity already on canvas'];
                        continue;
                    }

                    // Verify entity exists
                    $linkedEntity = $plugin->resolveEntity($entityType, $entityId);
                    if (!$linkedEntity) {
                        $skipped[] = ['index' => $index, 'reason' => 'Entity not found'];
                        continue;
                    }

                    // Check user access to linked entity
                    if (!$plugin->canUserAccessLinkedEntity($entityType, $entityId, $user)) {
                        $skipped[] = ['index' => $index, 'reason' => 'Access denied to entity'];
                        continue;
                    }

                    // Validate and bound position values
                    $x = isset($entity['x']) && is_numeric($entity['x'])
                        ? max(-100000, min(100000, (float) $entity['x']))
                        : 100 + (count($created) * 50);
                    $y = isset($entity['y']) && is_numeric($entity['y'])
                        ? max(-100000, min(100000, (float) $entity['y']))
                        : 100 + (count($created) * 50);

                    $node = InvestigationNode::create([
                        'investigation_id' => $investigation->record_id,
                        'entity_type' => $entityType,
                        'entity_id' => $entityId,
                        'x' => $x,
                        'y' => $y,
                        'partition_id' => $investigation->partition_id,
                    ]);

                    $created[] = $node->toArray();
                    $createdNodes[] = $node;
                }
            });

            // Broadcast node added events for all created nodes
            foreach ($createdNodes as $node) {
                NodeAdded::dispatch($node, $user);
            }

            return $this->successResponse([
                'nodes' => $created,
                'skipped' => $skipped,
                'created_count' => count($created),
                'skipped_count' => count($skipped),
                'message' => 'Bulk add completed',
            ], 201);
        } catch (\Exception $e) {
            Log::error('Bulk add nodes failed', ['error' => $e->getMessage()]);
            return $this->errorResponse('Failed to add nodes', 500);
        }
    }

    /**
     * Batch update node positions (for layout operations).
     */
    public function updateNodePositions(Request $request, string $investigationId): JsonResponse
    {
        try {
            $user = $this->getAuthenticatedUser($request);

            $investigation = Investigation::find($investigationId);
            if (!$investigation) {
                return $this->errorResponse('Investigation not found', 404);
            }

            $plugin = $this->getPlugin();
            if (!$plugin->checkDataAccess($investigation, $user, 'update')) {
                return $this->errorResponse('Permission denied', 403);
            }

            $positions = $request->input('positions', []);
            if (empty($positions) || !is_array($positions)) {
                return $this->errorResponse('Invalid positions data', 400);
            }

            // Limit batch size to prevent DoS
            if (count($positions) > 500) {
                return $this->errorResponse('Too many positions in batch (max 500)', 400);
            }

            // Validate each position entry
            $validatedPositions = [];
            foreach ($positions as $index => $pos) {
                if (!isset($pos['node_id'], $pos['x'], $pos['y'])) {
                    continue; // Skip invalid entries
                }

                // Validate bounds
                $x = (float) $pos['x'];
                $y = (float) $pos['y'];
                $zIndex = isset($pos['z_index']) ? (int) $pos['z_index'] : null;

                if ($x < -100000 || $x > 100000 || $y < -100000 || $y > 100000) {
                    continue; // Skip out-of-bounds entries
                }

                if ($zIndex !== null && ($zIndex < 0 || $zIndex > 10000)) {
                    $zIndex = null;
                }

                $validatedPositions[] = [
                    'node_id' => (string) $pos['node_id'],
                    'x' => $x,
                    'y' => $y,
                    'z_index' => $zIndex,
                ];
            }

            $movedNodes = [];

            DB::transaction(function () use ($validatedPositions, $investigationId, &$movedNodes) {
                foreach ($validatedPositions as $pos) {
                    $updateData = [
                        'x' => $pos['x'],
                        'y' => $pos['y'],
                    ];
                    // Only update z_index if it was provided (not null)
                    if ($pos['z_index'] !== null) {
                        $updateData['z_index'] = $pos['z_index'];
                    }

                    InvestigationNode::where('record_id', $pos['node_id'])
                        ->where('investigation_id', $investigationId)
                        ->update($updateData);
                    $movedNodes[] = $pos['node_id'];
                }
            });

            // Broadcast NodeMoved events for all updated nodes
            $updatedNodes = InvestigationNode::whereIn('record_id', $movedNodes)
                ->where('investigation_id', $investigationId)
                ->get();
            foreach ($updatedNodes as $node) {
                NodeMoved::dispatch($node, $user);
            }

            return $this->successResponse([
                'message' => 'Node positions updated successfully',
                'updated_count' => count($validatedPositions),
            ]);
        } catch (\Exception $e) {
            Log::error('Update node positions failed', ['error' => $e->getMessage()]);
            return $this->errorResponse('Failed to update node positions', 500);
        }
    }

    // ==================== Connection Management ====================

    /**
     * Create a connection between two nodes.
     */
    public function storeConnection(Request $request, string $investigationId): JsonResponse
    {
        try {
            $user = $this->getAuthenticatedUser($request);

            $investigation = Investigation::find($investigationId);
            if (!$investigation) {
                return $this->errorResponse('Investigation not found', 404);
            }

            $plugin = $this->getPlugin();
            if (!$plugin->checkDataAccess($investigation, $user, 'update')) {
                return $this->errorResponse('Permission denied', 403);
            }

            $data = $request->all();
            $data['investigation_id'] = $investigationId;

            // Verify both nodes belong to this investigation (security check)
            $fromNodeId = $request->input('from_node_id');
            $toNodeId = $request->input('to_node_id');

            $fromNode = InvestigationNode::where('record_id', $fromNodeId)
                ->where('investigation_id', $investigationId)
                ->first();
            $toNode = InvestigationNode::where('record_id', $toNodeId)
                ->where('investigation_id', $investigationId)
                ->first();

            if (!$fromNode) {
                return $this->errorResponse('Source node not found in this investigation', 400);
            }
            if (!$toNode) {
                return $this->errorResponse('Target node not found in this investigation', 400);
            }
            if ($fromNodeId === $toNodeId) {
                return $this->errorResponse('Cannot connect a node to itself', 400);
            }

            $validated = $plugin->validateConnectionData($data);
            $validated['partition_id'] = $investigation->partition_id;

            $connection = InvestigationConnection::create($validated);

            // Broadcast connection added event
            ConnectionAdded::dispatch($connection, $user);

            return $this->successResponse([
                'connection' => $connection->toArray(),
                'message' => 'Connection created successfully',
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse('Validation failed', 422, ['errors' => $e->errors()]);
        } catch (\Exception $e) {
            Log::error('Create connection failed', ['error' => $e->getMessage()]);
            return $this->errorResponse('Failed to create connection', 500);
        }
    }

    /**
     * Update a connection's style/properties.
     */
    public function updateConnection(Request $request, string $investigationId, string $connectionId): JsonResponse
    {
        try {
            $user = $this->getAuthenticatedUser($request);

            $investigation = Investigation::find($investigationId);
            if (!$investigation) {
                return $this->errorResponse('Investigation not found', 404);
            }

            $plugin = $this->getPlugin();
            if (!$plugin->checkDataAccess($investigation, $user, 'update')) {
                return $this->errorResponse('Permission denied', 403);
            }

            $connection = InvestigationConnection::where('record_id', $connectionId)
                ->where('investigation_id', $investigationId)
                ->first();
            if (!$connection) {
                return $this->errorResponse('Connection not found', 404);
            }

            $data = $request->only([
                'from_side', 'to_side', 'style', 'path_type', 'color', 'thickness', 'arrow_type',
                'relationship_type', 'relationship_label', 'sentiment', 'weight', 'notes'
            ]);

            // Valid anchor positions
            $validAnchors = implode(',', InvestigationConnection::VALID_ANCHORS);

            // Validate connection update fields
            $validator = Validator::make($data, [
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
                'notes' => 'nullable|string|max:10000',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 422, ['errors' => $validator->errors()]);
            }

            $connection->fill($validator->validated());
            $connection->save();

            // Broadcast connection updated event
            ConnectionUpdated::dispatch($connection, $user);

            return $this->successResponse([
                'connection' => $connection->toArray(),
                'message' => 'Connection updated successfully',
            ]);
        } catch (\Exception $e) {
            Log::error('Update connection failed', ['error' => $e->getMessage()]);
            return $this->errorResponse('Failed to update connection', 500);
        }
    }

    /**
     * Delete a connection.
     */
    public function destroyConnection(Request $request, string $investigationId, string $connectionId): JsonResponse
    {
        try {
            $user = $this->getAuthenticatedUser($request);

            $investigation = Investigation::find($investigationId);
            if (!$investigation) {
                return $this->errorResponse('Investigation not found', 404);
            }

            $plugin = $this->getPlugin();
            if (!$plugin->checkDataAccess($investigation, $user, 'update')) {
                return $this->errorResponse('Permission denied', 403);
            }

            $connection = InvestigationConnection::where('record_id', $connectionId)
                ->where('investigation_id', $investigationId)
                ->first();
            if (!$connection) {
                return $this->errorResponse('Connection not found', 404);
            }

            // Soft delete with audit trail
            $connection->deleted_by = $user->record_id;
            $connection->delete();

            // Broadcast connection removed event
            ConnectionRemoved::dispatch($connectionId, $investigationId, $user);

            return $this->successResponse([
                'message' => 'Connection deleted successfully',
            ]);
        } catch (\Exception $e) {
            Log::error('Delete connection failed', ['error' => $e->getMessage()]);
            return $this->errorResponse('Failed to delete connection', 500);
        }
    }

    /**
     * Find existing relationships for entities on the canvas.
     */
    public function findExistingRelationships(Request $request, string $investigationId): JsonResponse
    {
        try {
            $user = $this->getAuthenticatedUser($request);

            $investigation = Investigation::with('nodes')->find($investigationId);
            if (!$investigation) {
                return $this->errorResponse('Investigation not found', 404);
            }

            $plugin = $this->getPlugin();
            if (!$plugin->checkDataAccess($investigation, $user, 'read')) {
                return $this->errorResponse('Permission denied', 403);
            }

            // Get entity IDs for a new entity to check relationships against
            $entityType = $request->input('entity_type');
            $entityId = $request->input('entity_id');

            if (!$entityType || !$entityId) {
                return $this->errorResponse('entity_type and entity_id are required', 400);
            }

            // Validate entity_type is in the linkable list
            if (!in_array($entityType, $plugin->getLinkableEntityTypes())) {
                return $this->errorResponse('Invalid entity type', 400);
            }

            // Get existing entities on the canvas
            $existingEntities = $investigation->getLinkedEntityIds();

            $relationships = $plugin->findExistingRelationships(
                $existingEntities,
                $entityType,
                $entityId,
                $investigation->partition_id
            );

            return $this->successResponse([
                'relationships' => $relationships,
                'count' => count($relationships),
            ]);
        } catch (\Exception $e) {
            Log::error('Find existing relationships failed', ['error' => $e->getMessage()]);
            return $this->errorResponse('Failed to find relationships', 500);
        }
    }

    // ==================== Visualization Endpoints ====================

    /**
     * Get timeline data for the investigation.
     * Extracts date-based information from linked entities for timeline visualization.
     */
    public function getTimeline(Request $request, string $investigationId): JsonResponse
    {
        try {
            $user = $this->getAuthenticatedUser($request);

            $investigation = Investigation::with('nodes')->find($investigationId);
            if (!$investigation) {
                return $this->errorResponse('Investigation not found', 404);
            }

            $plugin = $this->getPlugin();
            if (!$plugin->checkDataAccess($investigation, $user, 'read')) {
                return $this->errorResponse('Permission denied', 403);
            }

            // Use TimelineService to extract timeline data
            $timelineData = $this->getTimelineService()->extractTimeline($investigation, $user);

            // Optional: group by period if requested
            $groupBy = $request->input('group_by');
            if ($groupBy && in_array($groupBy, ['day', 'week', 'month', 'year'])) {
                $timelineData['grouped'] = $this->getTimelineService()->groupEventsByPeriod(
                    $timelineData['events'],
                    $groupBy
                );
            }

            // Optional: filter by date range
            $startDate = $request->input('start_date');
            $endDate = $request->input('end_date');
            if ($startDate || $endDate) {
                $timelineData['events'] = $this->getTimelineService()->filterByDateRange(
                    $timelineData['events'],
                    $startDate,
                    $endDate
                );
                $timelineData['count'] = count($timelineData['events']);
            }

            return $this->successResponse($timelineData);
        } catch (\Exception $e) {
            Log::error('Get timeline failed', ['error' => $e->getMessage()]);
            return $this->errorResponse('Failed to get timeline data', 500);
        }
    }

    /**
     * Get graph data for the investigation canvas.
     * Returns nodes and connections in a format optimized for graph rendering.
     */
    public function getGraph(Request $request, string $investigationId): JsonResponse
    {
        try {
            $user = $this->getAuthenticatedUser($request);

            $investigation = Investigation::with(['nodes', 'connections', 'drawings'])->find($investigationId);
            if (!$investigation) {
                return $this->errorResponse('Investigation not found', 404);
            }

            $plugin = $this->getPlugin();
            if (!$plugin->checkDataAccess($investigation, $user, 'read')) {
                return $this->errorResponse('Permission denied', 403);
            }

            // Get visible nodes
            $visibleNodes = $plugin->getVisibleNodesForUser($investigation->nodes, $user);
            $visibleNodeIds = array_column($visibleNodes, 'record_id');

            // Filter connections to only include those between visible nodes
            $connections = $investigation->connections
                ->filter(function ($conn) use ($visibleNodeIds) {
                    return in_array($conn->from_node_id, $visibleNodeIds)
                        && in_array($conn->to_node_id, $visibleNodeIds);
                })
                ->map(function ($conn) {
                    return array_merge($conn->toArray(), [
                        'visual_properties' => $conn->visual_properties,
                        'relationship_properties' => $conn->relationship_properties,
                    ]);
                })
                ->values()
                ->toArray();

            // Get entity visual config for styling
            $visualConfig = $plugin->getEntityVisualConfig();

            // Enrich nodes with visual configuration
            $enrichedNodes = array_map(function ($node) use ($visualConfig) {
                $config = $visualConfig[$node['entity_type']] ?? [
                    'icon' => 'help-circle',
                    'color' => '#6b7280',
                    'backgroundColor' => '#f3f4f6',
                    'borderColor' => '#d1d5db',
                ];
                return array_merge($node, ['visual_config' => $config]);
            }, $visibleNodes);

            // Include drawings
            $drawings = $investigation->drawings->map(function ($drawing) {
                return array_merge($drawing->toArray(), [
                    'visual_properties' => $drawing->visual_properties,
                    'bounds' => $drawing->bounds,
                ]);
            })->toArray();

            // Calculate canvas bounds using LayoutService
            $bounds = $this->getLayoutService()->calculateCanvasBounds($enrichedNodes, $drawings);

            return $this->successResponse([
                'nodes' => $enrichedNodes,
                'connections' => $connections,
                'drawings' => $drawings,
                'canvas_state' => $investigation->canvas_state,
                'bounds' => $bounds,
                'counts' => [
                    'nodes' => count($enrichedNodes),
                    'connections' => count($connections),
                    'drawings' => count($drawings),
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Get graph failed', ['error' => $e->getMessage()]);
            return $this->errorResponse('Failed to get graph data', 500);
        }
    }

    /**
     * Apply an automatic layout algorithm to nodes.
     */
    public function applyLayout(Request $request, string $investigationId): JsonResponse
    {
        try {
            $user = $this->getAuthenticatedUser($request);

            $investigation = Investigation::with(['nodes', 'connections'])->find($investigationId);
            if (!$investigation) {
                return $this->errorResponse('Investigation not found', 404);
            }

            $plugin = $this->getPlugin();
            if (!$plugin->checkDataAccess($investigation, $user, 'update')) {
                return $this->errorResponse('Permission denied', 403);
            }

            $layoutType = $request->input('layout_type', 'grid');
            $layoutService = $this->getLayoutService();

            if (!$layoutService->isValidLayoutType($layoutType)) {
                return $this->errorResponse('Invalid layout type. Valid types: ' . implode(', ', $layoutService->getValidLayoutTypes()), 400);
            }

            $nodes = $investigation->nodes->toArray();
            $connections = $investigation->connections->toArray();

            // Apply layout algorithm using LayoutService
            $newPositions = $layoutService->calculateLayout($layoutType, $nodes, $connections, $request->all());

            // Update node positions
            DB::transaction(function () use ($newPositions, $investigationId) {
                foreach ($newPositions as $nodeId => $position) {
                    InvestigationNode::where('record_id', $nodeId)
                        ->where('investigation_id', $investigationId)
                        ->update([
                            'x' => $position['x'],
                            'y' => $position['y'],
                        ]);
                }
            });

            // Broadcast NodeMoved events for all repositioned nodes
            $movedNodeIds = array_keys($newPositions);
            $updatedNodes = InvestigationNode::whereIn('record_id', $movedNodeIds)
                ->where('investigation_id', $investigationId)
                ->get();
            foreach ($updatedNodes as $node) {
                NodeMoved::dispatch($node, $user);
            }

            // Update investigation's default layout
            $investigation->default_layout = $layoutType;
            $investigation->save();

            return $this->successResponse([
                'layout' => [
                    'positions' => $newPositions,
                    'layout_type' => $layoutType,
                    'node_count' => count($newPositions),
                ],
                'message' => 'Layout applied successfully',
            ]);
        } catch (\Exception $e) {
            Log::error('Apply layout failed', ['error' => $e->getMessage()]);
            return $this->errorResponse('Failed to apply layout', 500);
        }
    }

    // ==================== Drawing Management ====================

    /**
     * Add a drawing/annotation to the investigation canvas.
     */
    public function storeDrawing(Request $request, string $investigationId): JsonResponse
    {
        try {
            $user = $this->getAuthenticatedUser($request);

            $investigation = Investigation::find($investigationId);
            if (!$investigation) {
                return $this->errorResponse('Investigation not found', 404);
            }

            $plugin = $this->getPlugin();
            if (!$plugin->checkDataAccess($investigation, $user, 'update')) {
                return $this->errorResponse('Permission denied', 403);
            }

            // Valid tools list
            $validTools = implode(',', InvestigationDrawing::VALID_TOOLS);

            $validator = Validator::make($request->all(), [
                'tool' => "required|string|in:{$validTools}",
                'points' => 'required|array|min:1|max:10000',
                'points.*.x' => 'required|numeric|between:-100000,100000',
                'points.*.y' => 'required|numeric|between:-100000,100000',
                'color' => 'nullable|string|max:7|regex:/^#[a-fA-F0-9]{6}$/',
                'size' => 'nullable|numeric|min:0.5|max:50',
                'line_style' => 'nullable|string|in:solid,dashed,dotted',
                'thickness' => 'nullable|numeric|min:0.5|max:50',
                'arrow_type' => 'nullable|string|in:none,one-way,two-way',
                'text' => 'nullable|string|max:500',
                'z_index' => 'nullable|integer|between:0,10000',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 422, ['errors' => $validator->errors()]);
            }

            $data = $validator->validated();
            $data['investigation_id'] = $investigationId;
            $data['partition_id'] = $investigation->partition_id;

            $drawing = InvestigationDrawing::create($data);

            // Broadcast drawing added event
            DrawingAdded::dispatch($drawing, $user);

            return $this->successResponse([
                'drawing' => $drawing->toArray(),
                'message' => 'Drawing added successfully',
            ], 201);
        } catch (\Exception $e) {
            Log::error('Add drawing failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'investigation_id' => $investigationId,
                'request_data' => $request->all(),
            ]);
            return $this->errorResponse('Failed to add drawing: '.$e->getMessage(), 500);
        }
    }

    /**
     * Update a drawing's properties.
     */
    public function updateDrawing(Request $request, string $investigationId, string $drawingId): JsonResponse
    {
        try {
            $user = $this->getAuthenticatedUser($request);

            $investigation = Investigation::find($investigationId);
            if (!$investigation) {
                return $this->errorResponse('Investigation not found', 404);
            }

            $plugin = $this->getPlugin();
            if (!$plugin->checkDataAccess($investigation, $user, 'update')) {
                return $this->errorResponse('Permission denied', 403);
            }

            $drawing = InvestigationDrawing::where('record_id', $drawingId)
                ->where('investigation_id', $investigationId)
                ->first();
            if (!$drawing) {
                return $this->errorResponse('Drawing not found', 404);
            }

            $data = $request->only([
                'points', 'color', 'size', 'line_style', 'thickness', 'arrow_type', 'text', 'z_index'
            ]);

            $validator = Validator::make($data, [
                'points' => 'nullable|array|min:1|max:10000',
                'points.*.x' => 'required_with:points|numeric|between:-100000,100000',
                'points.*.y' => 'required_with:points|numeric|between:-100000,100000',
                'color' => 'nullable|string|max:7|regex:/^#[a-fA-F0-9]{6}$/',
                'size' => 'nullable|numeric|min:0.5|max:50',
                'line_style' => 'nullable|string|in:solid,dashed,dotted',
                'thickness' => 'nullable|numeric|min:0.5|max:50',
                'arrow_type' => 'nullable|string|in:none,one-way,two-way',
                'text' => 'nullable|string|max:500',
                'z_index' => 'nullable|integer|between:0,10000',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 422, ['errors' => $validator->errors()]);
            }

            $drawing->fill($validator->validated());
            $drawing->save();

            // Broadcast drawing updated event
            DrawingUpdated::dispatch($drawing, $user);

            return $this->successResponse([
                'drawing' => $drawing->toArray(),
                'message' => 'Drawing updated successfully',
            ]);
        } catch (\Exception $e) {
            Log::error('Update drawing failed', ['error' => $e->getMessage()]);
            return $this->errorResponse('Failed to update drawing', 500);
        }
    }

    /**
     * Delete a drawing.
     */
    public function destroyDrawing(Request $request, string $investigationId, string $drawingId): JsonResponse
    {
        try {
            $user = $this->getAuthenticatedUser($request);

            $investigation = Investigation::find($investigationId);
            if (!$investigation) {
                return $this->errorResponse('Investigation not found', 404);
            }

            $plugin = $this->getPlugin();
            if (!$plugin->checkDataAccess($investigation, $user, 'update')) {
                return $this->errorResponse('Permission denied', 403);
            }

            $drawing = InvestigationDrawing::where('record_id', $drawingId)
                ->where('investigation_id', $investigationId)
                ->first();
            if (!$drawing) {
                return $this->errorResponse('Drawing not found', 404);
            }

            // Soft delete with audit trail
            $drawing->deleted_by = $user->record_id;
            $drawing->delete();

            // Broadcast drawing removed event
            DrawingRemoved::dispatch($drawingId, $investigationId, $user);

            return $this->successResponse([
                'message' => 'Drawing deleted successfully',
            ]);
        } catch (\Exception $e) {
            Log::error('Delete drawing failed', ['error' => $e->getMessage()]);
            return $this->errorResponse('Failed to delete drawing', 500);
        }
    }

    /**
     * Batch create/update drawings (for performance during drawing sessions).
     */
    public function batchUpdateDrawings(Request $request, string $investigationId): JsonResponse
    {
        try {
            $user = $this->getAuthenticatedUser($request);

            $investigation = Investigation::find($investigationId);
            if (!$investigation) {
                return $this->errorResponse('Investigation not found', 404);
            }

            $plugin = $this->getPlugin();
            if (!$plugin->checkDataAccess($investigation, $user, 'update')) {
                return $this->errorResponse('Permission denied', 403);
            }

            $drawings = $request->input('drawings', []);
            if (empty($drawings) || !is_array($drawings)) {
                return $this->errorResponse('Invalid drawings data', 400);
            }

            // Limit batch size to prevent DoS
            if (count($drawings) > 100) {
                return $this->errorResponse('Too many drawings in batch (max 100)', 400);
            }

            $validTools = InvestigationDrawing::VALID_TOOLS;
            $validLineStyles = ['solid', 'dashed', 'dotted'];
            $validArrowTypes = ['none', 'one-way', 'two-way'];
            $createdDrawings = [];
            $updatedDrawings = [];

            DB::transaction(function () use ($drawings, $investigationId, $investigation, $validTools, $validLineStyles, $validArrowTypes, &$createdDrawings, &$updatedDrawings) {
                foreach ($drawings as $drawingData) {
                    // Skip invalid entries - validate tool
                    if (!isset($drawingData['tool']) || !in_array($drawingData['tool'], $validTools)) {
                        continue;
                    }

                    // Validate points array exists and has valid structure
                    if (!isset($drawingData['points']) || !is_array($drawingData['points']) || empty($drawingData['points'])) {
                        continue;
                    }

                    // Limit points array size to prevent DoS
                    if (count($drawingData['points']) > 10000) {
                        continue;
                    }

                    // Validate and sanitize points - skip drawings with invalid coordinates
                    $validPoints = [];
                    $pointsValid = true;
                    foreach ($drawingData['points'] as $point) {
                        if (!isset($point['x'], $point['y']) || !is_numeric($point['x']) || !is_numeric($point['y'])) {
                            $pointsValid = false;
                            break;
                        }
                        $x = (float) $point['x'];
                        $y = (float) $point['y'];
                        if ($x < -100000 || $x > 100000 || $y < -100000 || $y > 100000) {
                            $pointsValid = false;
                            break;
                        }
                        $validPoints[] = ['x' => $x, 'y' => $y];
                    }
                    if (!$pointsValid || empty($validPoints)) {
                        continue;
                    }

                    // Validate and sanitize optional fields
                    $color = '#000000';
                    if (isset($drawingData['color']) && is_string($drawingData['color']) && preg_match('/^#[a-fA-F0-9]{6}$/', $drawingData['color'])) {
                        $color = $drawingData['color'];
                    }

                    $size = 2;
                    if (isset($drawingData['size']) && is_numeric($drawingData['size'])) {
                        $size = max(0.5, min(50, (float) $drawingData['size']));
                    }

                    $zIndex = 0;
                    if (isset($drawingData['z_index']) && is_numeric($drawingData['z_index'])) {
                        $zIndex = max(0, min(10000, (int) $drawingData['z_index']));
                    }

                    $lineStyle = null;
                    if (isset($drawingData['line_style']) && in_array($drawingData['line_style'], $validLineStyles)) {
                        $lineStyle = $drawingData['line_style'];
                    }

                    $thickness = null;
                    if (isset($drawingData['thickness']) && is_numeric($drawingData['thickness'])) {
                        $thickness = max(0.5, min(20, (float) $drawingData['thickness']));
                    }

                    $arrowType = null;
                    if (isset($drawingData['arrow_type']) && in_array($drawingData['arrow_type'], $validArrowTypes)) {
                        $arrowType = $drawingData['arrow_type'];
                    }

                    $text = null;
                    if (isset($drawingData['text']) && is_string($drawingData['text'])) {
                        $text = mb_substr($drawingData['text'], 0, 500);
                    }

                    // Check if updating existing or creating new
                    if (isset($drawingData['record_id']) && is_string($drawingData['record_id'])) {
                        $drawing = InvestigationDrawing::where('record_id', $drawingData['record_id'])
                            ->where('investigation_id', $investigationId)
                            ->first();

                        if ($drawing) {
                            $drawing->fill([
                                'points' => $validPoints,
                                'color' => $color,
                                'size' => $size,
                                'z_index' => $zIndex,
                            ]);
                            $drawing->save();
                            $updatedDrawings[] = $drawing;
                            continue;
                        }
                    }

                    // Create new drawing
                    $newDrawing = InvestigationDrawing::create([
                        'investigation_id' => $investigationId,
                        'partition_id' => $investigation->partition_id,
                        'tool' => $drawingData['tool'],
                        'points' => $validPoints,
                        'color' => $color,
                        'size' => $size,
                        'line_style' => $lineStyle,
                        'thickness' => $thickness,
                        'arrow_type' => $arrowType,
                        'text' => $text,
                        'z_index' => $zIndex,
                    ]);
                    $createdDrawings[] = $newDrawing;
                }
            });

            // Broadcast drawing events after transaction commits
            foreach ($createdDrawings as $drawing) {
                DrawingAdded::dispatch($drawing, $user);
            }
            foreach ($updatedDrawings as $drawing) {
                DrawingUpdated::dispatch($drawing, $user);
            }

            return $this->successResponse([
                'message' => 'Drawings processed successfully',
                'created' => count($createdDrawings),
                'updated' => count($updatedDrawings),
            ]);
        } catch (\Exception $e) {
            Log::error('Batch update drawings failed', ['error' => $e->getMessage()]);
            return $this->errorResponse('Failed to process drawings', 500);
        }
    }

    /**
     * Find entity by ID for relationship management.
     * SECURITY: Validates partition access to prevent IDOR attacks.
     */
    protected function findEntity(string $id): ?Investigation
    {
        $entity = Investigation::find($id);

        if (! $entity) {
            return null;
        }

        // SECURITY: Validate entity belongs to user's accessible partitions
        try {
            $user = $this->getAuthenticatedUser(request());
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            return null; // Unauthenticated - prevent information disclosure
        }
        if (! $this->canAccessEntityPartition($entity, $user)) {
            return null; // Return null to prevent information disclosure
        }

        return $entity;
    }

    /**
     * Channel authorization callback — called by WebSocket service
     * to verify whether a user can access an investigation canvas channel.
     *
     * Protected by service.token middleware (service-to-service auth).
     */
    public function channelAuth(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'user_id' => 'required|string',
                'partition_id' => 'required|string',
                'resource_id' => 'required|string',
            ]);

            $userId = $request->input('user_id');
            $partitionId = $request->input('partition_id');
            $resourceId = $request->input('resource_id');

            $investigation = Investigation::where('record_id', $resourceId)
                ->where('partition_id', $partitionId)
                ->first();

            if (!$investigation) {
                return response()->json(['authorized' => false]);
            }

            $user = IdentityUser::find($userId);
            if (!$user) {
                return response()->json(['authorized' => false]);
            }

            if ($investigation->canAccess($user, 'read')) {
                return response()->json([
                    'authorized' => true,
                    'user_info' => ['id' => $userId, 'name' => $user->username ?? 'Unknown'],
                ]);
            }

            return response()->json(['authorized' => false]);
        } catch (\Exception $e) {
            Log::error('InvestigationsController channelAuth error', [
                'error' => $e->getMessage(),
            ]);

            return response()->json(['authorized' => false]);
        }
    }
}
