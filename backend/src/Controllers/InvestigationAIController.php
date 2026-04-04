<?php

namespace NewSolari\Investigations\Controllers;

use NewSolari\Core\Identity\Models\IdentityUser;
use NewSolari\Investigations\InvestigationsPlugin;
use NewSolari\Investigations\Models\Investigation;
use NewSolari\AIService\Contracts\AIServiceInterface;
use NewSolari\AIService\Exceptions\AIServiceException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

use NewSolari\Core\Http\BaseController;

class InvestigationAIController extends BaseController
{
    protected ?InvestigationsPlugin $plugin = null;
    protected ?AIServiceInterface $aiService = null;

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
     * Get the Claude AI service instance.
     */
    protected function getAIService(): AIServiceInterface
    {
        if (!$this->aiService) {
            $this->aiService = app(AIServiceInterface::class);
        }
        return $this->aiService;
    }

    /**
     * Validate user and investigation access.
     *
     * @return array{user: IdentityUser, investigation: Investigation}|JsonResponse
     */
    protected function validateAccess(Request $request, string $investigationId): array|JsonResponse
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user || !$user instanceof IdentityUser) {
            return $this->errorResponse('Authentication required', 401);
        }

        $plugin = $this->getPlugin();
        if (!$plugin->checkUserPermission($user, 'investigations.update')) {
            return $this->errorResponse('Permission denied', 403);
        }

        $investigation = Investigation::find($investigationId);
        if (!$investigation) {
            return $this->errorResponse('Investigation not found', 404);
        }

        if (!$plugin->checkDataAccess($investigation, $user, 'update')) {
            return $this->errorResponse('Access denied to this investigation', 403);
        }

        return ['user' => $user, 'investigation' => $investigation];
    }

    /**
     * Summarize a selected node's content.
     */
    public function summarizeNode(Request $request, string $id): JsonResponse
    {
        try {
            $access = $this->validateAccess($request, $id);
            if ($access instanceof JsonResponse) {
                return $access;
            }

            $validator = Validator::make($request->all(), [
                'node_id' => 'required|string|max:36',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 422, ['errors' => $validator->errors()]);
            }

            $investigation = $access['investigation'];
            $nodeId = $request->input('node_id');

            // Find the node
            $node = $investigation->nodes()->where('record_id', $nodeId)->first();
            if (!$node) {
                return $this->errorResponse('Node not found', 404);
            }

            // Get the linked entity content
            $plugin = $this->getPlugin();
            $entity = $plugin->resolveEntity($node->entity_type, $node->entity_id);

            if (!$entity) {
                return $this->errorResponse('Entity not found', 404);
            }

            // Extract text content from the entity
            $content = $this->extractEntityContent($entity, $node->entity_type);

            if (empty($content)) {
                return $this->successResponse([
                    'summary' => 'No content available to summarize.',
                    'keyPoints' => [],
                ]);
            }

            $aiService = $this->getAIService();
            $result = $aiService->summarizeText($content);

            return $this->successResponse($result);
        } catch (AIServiceException $e) {
            Log::error('AI summarize node failed', [
                'error' => $e->getMessage(),
                'user_message' => $e->userMessage,
                'retryable' => $e->isRetryable,
                'investigation_id' => $id,
            ]);
            return $this->errorResponse($e->userMessage, 503);
        } catch (\Exception $e) {
            Log::error('AI summarize node failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'investigation_id' => $id,
            ]);
            return $this->errorResponse('Failed to summarize node. Please try again.', 500);
        }
    }

    /**
     * Summarize an uploaded file.
     */
    public function summarizeFile(Request $request, string $id): JsonResponse
    {
        try {
            $access = $this->validateAccess($request, $id);
            if ($access instanceof JsonResponse) {
                return $access;
            }

            $validator = Validator::make($request->all(), [
                'file' => 'required|file|max:20480', // 20MB max
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 422, ['errors' => $validator->errors()]);
            }

            $file = $request->file('file');

            // Validate file type
            $allowedMimes = [
                'image/jpeg', 'image/png', 'image/gif', 'image/webp',
                'application/pdf',
                'text/plain', 'text/markdown', 'text/csv',
                'application/json', 'application/xml', 'text/xml',
            ];

            if (!in_array($file->getMimeType(), $allowedMimes)) {
                return $this->errorResponse('Unsupported file type', 422);
            }

            $aiService = $this->getAIService();
            $result = $aiService->summarizeFile($file);

            return $this->successResponse($result);
        } catch (AIServiceException $e) {
            Log::error('AI summarize file failed', [
                'error' => $e->getMessage(),
                'user_message' => $e->userMessage,
                'retryable' => $e->isRetryable,
                'investigation_id' => $id,
            ]);
            return $this->errorResponse($e->userMessage, 503);
        } catch (\Exception $e) {
            Log::error('AI summarize file failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'investigation_id' => $id,
            ]);
            return $this->errorResponse('Failed to summarize file. Please try again.', 500);
        }
    }

    /**
     * Summarize the entire investigation canvas.
     */
    public function summarizeInvestigation(Request $request, string $id): JsonResponse
    {
        try {
            $access = $this->validateAccess($request, $id);
            if ($access instanceof JsonResponse) {
                return $access;
            }

            $investigation = $access['investigation'];
            $plugin = $this->getPlugin();

            // Get all nodes with their entity content
            $nodes = $investigation->nodes()->get();
            $connections = $investigation->connections()->get();

            $nodeData = [];
            foreach ($nodes as $node) {
                $entity = $plugin->resolveEntity($node->entity_type, $node->entity_id);
                $content = $entity ? $this->extractEntityContent($entity, $node->entity_type) : $node->label_override ?? 'Unknown';

                $nodeData[] = [
                    'id' => $node->record_id,
                    'type' => $node->entity_type,
                    'content' => $content,
                ];
            }

            $connectionData = [];
            foreach ($connections as $conn) {
                $connectionData[] = [
                    'from' => $conn->from_node_id,
                    'to' => $conn->to_node_id,
                    'relationshipType' => $conn->relationship_type ?? 'related',
                ];
            }

            if (empty($nodeData)) {
                return $this->successResponse([
                    'overview' => 'This investigation canvas is empty.',
                    'totalNodes' => 0,
                    'totalConnections' => 0,
                    'mainThemes' => [],
                    'suggestions' => ['Add entities to the canvas to begin your investigation.'],
                ]);
            }

            $aiService = $this->getAIService();
            $result = $aiService->summarizeInvestigation($nodeData, $connectionData);

            return $this->successResponse($result);
        } catch (AIServiceException $e) {
            Log::error('AI summarize investigation failed', [
                'error' => $e->getMessage(),
                'user_message' => $e->userMessage,
                'retryable' => $e->isRetryable,
                'investigation_id' => $id,
            ]);
            return $this->errorResponse($e->userMessage, 503);
        } catch (\Exception $e) {
            Log::error('AI summarize investigation failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'investigation_id' => $id,
            ]);
            return $this->errorResponse('Failed to summarize investigation. Please try again.', 500);
        }
    }

    /**
     * Analyze correlations and patterns in the investigation.
     */
    public function analyzeCorrelations(Request $request, string $id): JsonResponse
    {
        try {
            $access = $this->validateAccess($request, $id);
            if ($access instanceof JsonResponse) {
                return $access;
            }

            $investigation = $access['investigation'];
            $plugin = $this->getPlugin();

            // Get all nodes with their entity content
            $nodes = $investigation->nodes()->get();
            $connections = $investigation->connections()->get();

            if ($nodes->count() < 2) {
                return $this->errorResponse('At least 2 nodes are required for correlation analysis', 422);
            }

            $nodeData = [];
            foreach ($nodes as $node) {
                $entity = $plugin->resolveEntity($node->entity_type, $node->entity_id);
                $content = $entity ? $this->extractEntityContent($entity, $node->entity_type) : $node->label_override ?? 'Unknown';
                $tags = [];
                if (is_array($node->tags)) {
                    $tags = $node->tags;
                } elseif (is_string($node->tags) && !empty($node->tags)) {
                    $decoded = json_decode($node->tags, true);
                    $tags = is_array($decoded) ? $decoded : [];
                }

                $nodeData[] = [
                    'id' => $node->record_id,
                    'type' => $node->entity_type,
                    'content' => $content,
                    'tags' => $tags,
                ];
            }

            $connectionData = [];
            foreach ($connections as $conn) {
                $connectionData[] = [
                    'from' => $conn->from_node_id,
                    'to' => $conn->to_node_id,
                    'relationshipType' => $conn->relationship_type ?? 'related',
                ];
            }

            $aiService = $this->getAIService();
            $result = $aiService->analyzeCorrelations($nodeData, $connectionData);

            return $this->successResponse($result);
        } catch (AIServiceException $e) {
            Log::error('AI analyze correlations failed', [
                'error' => $e->getMessage(),
                'user_message' => $e->userMessage,
                'retryable' => $e->isRetryable,
                'investigation_id' => $id,
            ]);
            return $this->errorResponse($e->userMessage, 503);
        } catch (\Exception $e) {
            Log::error('AI analyze correlations failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'investigation_id' => $id,
            ]);
            return $this->errorResponse('Failed to analyze correlations. Please try again.', 500);
        }
    }

    /**
     * Generate a mind map from an uploaded document.
     */
    public function generateMindMap(Request $request, string $id): JsonResponse
    {
        try {
            $access = $this->validateAccess($request, $id);
            if ($access instanceof JsonResponse) {
                return $access;
            }

            $validator = Validator::make($request->all(), [
                'file' => 'required|file|max:20480', // 20MB max
                'detail_level' => 'nullable|string|in:brief,standard,comprehensive',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 422, ['errors' => $validator->errors()]);
            }

            $file = $request->file('file');
            $detailLevel = $request->input('detail_level', 'standard');

            // Validate file type
            // Note: .doc/.docx not supported - would require additional libraries to extract text
            $allowedMimes = [
                'image/jpeg', 'image/png', 'image/gif', 'image/webp',
                'application/pdf',
                'text/plain', 'text/markdown', 'text/csv',
                'application/json', 'application/xml', 'text/xml',
            ];

            if (!in_array($file->getMimeType(), $allowedMimes)) {
                return $this->errorResponse('Unsupported file type', 422);
            }

            $aiService = $this->getAIService();
            $result = $aiService->generateMindMap($file, $detailLevel);

            return $this->successResponse($result);
        } catch (AIServiceException $e) {
            Log::error('AI generate mind map failed', [
                'error' => $e->getMessage(),
                'user_message' => $e->userMessage,
                'retryable' => $e->isRetryable,
                'investigation_id' => $id,
            ]);
            return $this->errorResponse($e->userMessage, 503);
        } catch (\Exception $e) {
            Log::error('AI generate mind map failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'investigation_id' => $id,
            ]);
            return $this->errorResponse('Failed to generate mind map. Please try again.', 500);
        }
    }

    /**
     * Entity type mapping from AI node types to app entity types.
     * Maps AI-generated types to model classes and entity_type keys.
     */
    protected const ENTITY_TYPE_MAP = [
        'person' => [
            'class' => \NewSolari\People\Models\Person::class,
            'entity_type' => 'person',
        ],
        'place' => [
            'class' => \NewSolari\Places\Models\Place::class,
            'entity_type' => 'place',
        ],
        'organization' => [
            'class' => \NewSolari\Entities\Models\Entity::class,
            'entity_type' => 'entity',
        ],
        'event' => [
            'class' => \NewSolari\Events\Models\Event::class,
            'entity_type' => 'event',
        ],
        'hypothesis' => [
            'class' => \NewSolari\Hypotheses\Models\Hypothesis::class,
            'entity_type' => 'hypothesis',
        ],
        'idea' => [
            'class' => \NewSolari\Hypotheses\Models\Hypothesis::class,
            'entity_type' => 'hypothesis',
        ],
        'motive' => [
            'class' => \NewSolari\Motives\Models\Motive::class,
            'entity_type' => 'motive',
        ],
        'object' => [
            'class' => \NewSolari\InventoryObjects\Models\InventoryObject::class,
            'entity_type' => 'inventory_object',
        ],
        'inventory_object' => [
            'class' => \NewSolari\InventoryObjects\Models\InventoryObject::class,
            'entity_type' => 'inventory_object',
        ],
        // Default fallback types map to Note
        'concept' => [
            'class' => \NewSolari\Notes\Models\Note::class,
            'entity_type' => 'note',
        ],
        'note' => [
            'class' => \NewSolari\Notes\Models\Note::class,
            'entity_type' => 'note',
        ],
    ];

    /**
     * Apply generated mind map results by creating entities and adding them to the canvas.
     * Supports incremental updates - reuses existing nodes when content matches.
     * Creates appropriate entity types based on AI node classification.
     */
    public function applyMindMap(Request $request, string $id): JsonResponse
    {
        try {
            $access = $this->validateAccess($request, $id);
            if ($access instanceof JsonResponse) {
                return $access;
            }

            $validator = Validator::make($request->all(), [
                'nodes' => 'required|array',
                'nodes.*.id' => 'required|string',
                'nodes.*.content' => 'required|string|max:500',
                'nodes.*.type' => 'required|string',
                'nodes.*.description' => 'nullable|string|max:2000',
                'nodes.*.tags' => 'nullable|array',
                'nodes.*.startDate' => 'nullable|date_format:Y-m-d',
                'nodes.*.endDate' => 'nullable|date_format:Y-m-d',
                'connections' => 'nullable|array',
                'connections.*.fromId' => 'required|string',
                'connections.*.toId' => 'required|string',
                'connections.*.label' => 'nullable|string|max:100',
                'connections.*.relationshipType' => 'nullable|string|in:positive,negative,neutral',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 422, ['errors' => $validator->errors()]);
            }

            $investigation = $access['investigation'];
            $user = $access['user'];
            $nodes = $request->input('nodes', []);
            $connections = $request->input('connections', []);

            // Get existing nodes on this canvas to check for duplicates and calculate positions
            $existingNodes = $investigation->nodes()->get();
            $existingConnections = $investigation->connections()->get();

            // Build a map of existing node titles to their investigation node IDs
            $existingTitleMap = [];
            foreach ($existingNodes as $existingNode) {
                // Use resolveEntity() method since there's no eager-loadable relationship
                $entity = $existingNode->resolveEntity();
                if ($entity) {
                    // Check for full_name (Person), title (Note/Event), or name (most entities)
                    $title = $entity->full_name ?? $entity->title ?? $entity->name ?? $existingNode->label_override ?? '';
                    $normalizedTitle = strtolower(trim($title));
                    if (!empty($normalizedTitle)) {
                        $existingTitleMap[$normalizedTitle] = $existingNode->record_id;
                    }
                } elseif (!empty($existingNode->label_override)) {
                    // Fallback to label_override if entity can't be resolved
                    $normalizedTitle = strtolower(trim($existingNode->label_override));
                    $existingTitleMap[$normalizedTitle] = $existingNode->record_id;
                }
            }

            // Calculate starting position based on existing nodes to avoid overlap
            $maxY = 100;
            foreach ($existingNodes as $existingNode) {
                if ($existingNode->y > $maxY) {
                    $maxY = $existingNode->y;
                }
            }
            $startY = $maxY + 250; // Start below existing nodes with some padding

            $createdNodes = [];
            $reusedNodes = [];
            $nodeIdMap = []; // Map from generated ID to actual node record_id
            $newNodeIndex = 0;

            // Process each node - reuse existing or create new
            foreach ($nodes as $nodeData) {
                $normalizedContent = strtolower(trim($nodeData['content']));

                // Check if a node with this title already exists on the canvas
                if (isset($existingTitleMap[$normalizedContent])) {
                    // Reuse existing node
                    $nodeIdMap[$nodeData['id']] = $existingTitleMap[$normalizedContent];
                    $reusedNodes[] = [
                        'id' => $existingTitleMap[$normalizedContent],
                        'title' => $nodeData['content'],
                        'reused' => true,
                    ];
                } else {
                    // Create appropriate entity based on AI node type
                    $entityResult = $this->createEntityFromNodeData($nodeData, $user, $investigation->record_id);
                    if ($entityResult === null) {
                        continue; // Skip if entity creation failed
                    }

                    // Calculate position in a grid layout starting from startY
                    $row = intdiv($newNodeIndex, 4);
                    $col = $newNodeIndex % 4;
                    $posX = 100 + ($col * 300);
                    $posY = $startY + ($row * 200);

                    // Add the entity as a node to the investigation
                    $investigationNode = $investigation->nodes()->create([
                        'entity_type' => $entityResult['entity_type'],
                        'entity_id' => $entityResult['entity_id'],
                        'x' => $posX,
                        'y' => $posY,
                        'tags' => $nodeData['tags'] ?? [],
                        'partition_id' => $user->partition_id,
                    ]);

                    $nodeIdMap[$nodeData['id']] = $investigationNode->record_id;
                    $existingTitleMap[$normalizedContent] = $investigationNode->record_id;
                    $createdNodes[] = [
                        'id' => $investigationNode->record_id,
                        'entity_type' => $entityResult['entity_type'],
                        'entity_id' => $entityResult['entity_id'],
                        'title' => $nodeData['content'],
                    ];
                    $newNodeIndex++;
                }
            }

            // Build a set of existing connections to avoid duplicates
            $existingConnectionSet = [];
            foreach ($existingConnections as $conn) {
                $key = $conn->from_node_id . '->' . $conn->to_node_id;
                $existingConnectionSet[$key] = true;
            }

            // Create connections between nodes (only if they don't already exist)
            $createdConnections = [];
            $skippedConnections = 0;
            foreach ($connections as $connData) {
                $fromNodeId = $nodeIdMap[$connData['fromId']] ?? null;
                $toNodeId = $nodeIdMap[$connData['toId']] ?? null;

                if ($fromNodeId && $toNodeId) {
                    $connectionKey = $fromNodeId . '->' . $toNodeId;

                    // Check if connection already exists
                    if (isset($existingConnectionSet[$connectionKey])) {
                        $skippedConnections++;
                        continue;
                    }

                    $connection = $investigation->connections()->create([
                        'from_node_id' => $fromNodeId,
                        'to_node_id' => $toNodeId,
                        'relationship_type' => $connData['label'] ?? 'related',
                        'sentiment' => $connData['relationshipType'] ?? 'neutral',
                        'style' => 'solid',
                        'path_type' => 'curved',
                        'arrow_type' => 'forward',
                        'partition_id' => $user->partition_id,
                    ]);

                    $existingConnectionSet[$connectionKey] = true;
                    $createdConnections[] = [
                        'id' => $connection->record_id,
                        'from' => $fromNodeId,
                        'to' => $toNodeId,
                    ];
                }
            }

            return $this->successResponse([
                'nodesCreated' => count($createdNodes),
                'nodesReused' => count($reusedNodes),
                'connectionsCreated' => count($createdConnections),
                'connectionsSkipped' => $skippedConnections,
                'nodes' => $createdNodes,
                'reusedNodes' => $reusedNodes,
                'connections' => $createdConnections,
            ]);
        } catch (\Exception $e) {
            Log::error('AI apply mind map failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'investigation_id' => $id,
            ]);
            return $this->errorResponse('Failed to apply mind map. Please try again.', 500);
        }
    }

    /**
     * Create an entity from AI node data based on the node type.
     * Returns array with entity_type and entity_id, or null on failure.
     *
     * @param array $nodeData The AI-generated node data
     * @param mixed $user The current user
     * @param string $investigationId The investigation record ID for source tracking
     * @return array{entity_type: string, entity_id: string}|null
     */
    protected function createEntityFromNodeData(array $nodeData, $user, string $investigationId): ?array
    {
        $aiType = strtolower($nodeData['type'] ?? 'note');
        $content = $nodeData['content'] ?? '';
        $description = $nodeData['description'] ?? '';

        // Map AI type to entity config, fallback to note
        $entityConfig = self::ENTITY_TYPE_MAP[$aiType] ?? self::ENTITY_TYPE_MAP['note'];
        $modelClass = $entityConfig['class'];
        $entityType = $entityConfig['entity_type'];

        // Check if model class exists
        if (!class_exists($modelClass)) {
            // Fallback to Note if entity type not available
            $modelClass = \NewSolari\Notes\Models\Note::class;
            $entityType = 'note';
            if (!class_exists($modelClass)) {
                return null;
            }
        }

        try {
            $entity = new $modelClass();

            // Set common fields based on entity type
            switch ($entityType) {
                case 'person':
                    // Parse name into first/last - simple split on first space
                    $nameParts = explode(' ', $content, 2);
                    $entity->first_name = $nameParts[0];
                    $entity->last_name = $nameParts[1] ?? $nameParts[0]; // Use first name as last if only one word
                    $entity->notes = $description;
                    $entity->partition_id = $user->partition_id;
                    $entity->created_by = $user->record_id;
                    $entity->source_plugin = 'investigations-meta-app';
                    $entity->source_record_id = $investigationId;
                    break;

                case 'place':
                    $entity->name = $content;
                    $entity->description = $description;
                    $entity->partition_id = $user->partition_id;
                    $entity->created_by = $user->record_id;
                    $entity->source_plugin = 'investigations-meta-app';
                    $entity->source_record_id = $investigationId;
                    break;

                case 'entity': // Organization
                    $entity->name = $content;
                    $entity->description = $description;
                    $entity->entity_type = 'organization';
                    $entity->partition_id = $user->partition_id;
                    $entity->created_by = $user->record_id;
                    $entity->source_plugin = 'investigations-meta-app';
                    $entity->source_record_id = $investigationId;
                    break;

                case 'event':
                    $entity->title = $content;
                    $entity->description = $description;
                    // Use AI-extracted dates if available, otherwise default to today
                    $today = now()->format('Y-m-d');
                    $startDate = !empty($nodeData['startDate']) ? $nodeData['startDate'] : $today;
                    $endDate = !empty($nodeData['endDate']) ? $nodeData['endDate'] : $startDate;
                    $entity->start_date = $startDate;
                    $entity->end_date = $endDate;
                    $entity->partition_id = $user->partition_id;
                    $entity->created_by = $user->record_id;
                    $entity->source_plugin = 'investigations-meta-app';
                    $entity->source_record_id = $investigationId;
                    break;

                case 'hypothesis':
                    $entity->name = $content;
                    $entity->description = $description;
                    $entity->partition_id = $user->partition_id;
                    $entity->created_by = $user->record_id;
                    $entity->source_plugin = 'investigations-meta-app';
                    $entity->source_record_id = $investigationId;
                    break;

                case 'motive':
                    $entity->name = $content;
                    $entity->description = $description;
                    $entity->partition_id = $user->partition_id;
                    $entity->created_by = $user->record_id;
                    $entity->source_plugin = 'investigations-meta-app';
                    $entity->source_record_id = $investigationId;
                    break;

                case 'inventory_object':
                    $entity->name = $content;
                    $entity->description = $description;
                    $entity->partition_id = $user->partition_id;
                    $entity->created_by = $user->record_id;
                    $entity->source_plugin = 'investigations-meta-app';
                    $entity->source_record_id = $investigationId;
                    break;

                case 'note':
                default:
                    $entity->title = $content;
                    $entity->content = $description;
                    $entity->partition_id = $user->partition_id;
                    $entity->created_by = $user->record_id;
                    $entity->source_plugin = 'investigations-meta-app';
                    $entity->source_record_id = $investigationId;
                    break;
            }

            $entity->save();

            return [
                'entity_type' => $entityType,
                'entity_id' => $entity->record_id,
            ];
        } catch (\Exception $e) {
            Log::warning('Failed to create entity from AI node', [
                'type' => $entityType,
                'content' => $content,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Extract content from an entity based on its type.
     */
    protected function extractEntityContent($entity, string $entityType): string
    {
        $content = [];

        // Common fields
        if (isset($entity->name)) {
            $content[] = "Name: {$entity->name}";
        }
        if (isset($entity->title)) {
            $content[] = "Title: {$entity->title}";
        }
        if (isset($entity->description)) {
            $content[] = "Description: {$entity->description}";
        }
        if (isset($entity->content)) {
            $content[] = "Content: {$entity->content}";
        }
        if (isset($entity->notes)) {
            $content[] = "Notes: {$entity->notes}";
        }

        // Type-specific fields
        switch ($entityType) {
            case 'person':
                if (isset($entity->first_name, $entity->last_name)) {
                    $content[] = "Full Name: {$entity->first_name} {$entity->last_name}";
                }
                if (isset($entity->occupation)) {
                    $content[] = "Occupation: {$entity->occupation}";
                }
                if (isset($entity->bio)) {
                    $content[] = "Bio: {$entity->bio}";
                }
                break;

            case 'place':
                if (isset($entity->address)) {
                    $content[] = "Address: {$entity->address}";
                }
                if (isset($entity->city)) {
                    $content[] = "City: {$entity->city}";
                }
                break;

            case 'event':
                if (isset($entity->event_date)) {
                    $content[] = "Date: {$entity->event_date}";
                }
                if (isset($entity->location)) {
                    $content[] = "Location: {$entity->location}";
                }
                break;

            case 'note':
            case 'blocknote':
                if (isset($entity->body)) {
                    $content[] = $entity->body;
                }
                break;

            case 'file':
                if (isset($entity->original_name)) {
                    $content[] = "File: {$entity->original_name}";
                }
                if (isset($entity->file_type)) {
                    $content[] = "Type: {$entity->file_type}";
                }
                break;

            case 'hypothesis':
                if (isset($entity->hypothesis)) {
                    $content[] = "Hypothesis: {$entity->hypothesis}";
                }
                if (isset($entity->evidence)) {
                    $content[] = "Evidence: {$entity->evidence}";
                }
                if (isset($entity->status)) {
                    $content[] = "Status: {$entity->status}";
                }
                break;

            case 'motive':
                if (isset($entity->motive)) {
                    $content[] = "Motive: {$entity->motive}";
                }
                break;

            case 'task':
                if (isset($entity->status)) {
                    $content[] = "Status: {$entity->status}";
                }
                if (isset($entity->priority)) {
                    $content[] = "Priority: {$entity->priority}";
                }
                if (isset($entity->due_date)) {
                    $content[] = "Due: {$entity->due_date}";
                }
                break;
        }

        return implode("\n", array_filter($content));
    }

    /**
     * Analyze investigation for duplicate entities and missing connections.
     * Uses both exact matching and AI-powered semantic analysis.
     */
    public function analyzeSuggestions(Request $request, string $id): JsonResponse
    {
        try {
            $access = $this->validateAccess($request, $id);
            if ($access instanceof JsonResponse) {
                return $access;
            }

            $investigation = $access['investigation'];
            $user = $access['user'];

            // Get the suggestion analysis service
            $suggestionService = new \NewSolari\Investigations\Services\SuggestionAnalysisService(
                $this->getPlugin(),
                $this->getAIService()
            );

            $result = $suggestionService->analyze($investigation, $user);

            return $this->successResponse($result);
        } catch (AIServiceException $e) {
            Log::warning('AI suggestion analysis failed', [
                'error' => $e->getMessage(),
                'user_message' => $e->userMessage,
            ]);
            return $this->errorResponse($e->userMessage, $e->isRetryable ? 503 : 400);
        } catch (\Exception $e) {
            Log::error('Suggestion analysis failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'investigation_id' => $id,
            ]);
            return $this->errorResponse('Failed to analyze suggestions. Please try again.', 500);
        }
    }

    /**
     * Accept a duplicate suggestion by merging two nodes.
     * Transfers connections from the deleted node to the kept node.
     */
    public function acceptDuplicateSuggestion(Request $request, string $id): JsonResponse
    {
        try {
            $access = $this->validateAccess($request, $id);
            if ($access instanceof JsonResponse) {
                return $access;
            }

            $validator = Validator::make($request->all(), [
                'keepNodeId' => 'required|string|max:36',
                'deleteNodeId' => 'required|string|max:36',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 422, ['errors' => $validator->errors()]);
            }

            $investigation = $access['investigation'];
            $keepNodeId = $request->input('keepNodeId');
            $deleteNodeId = $request->input('deleteNodeId');

            // Verify both nodes exist in this investigation
            $keepNode = $investigation->nodes()->where('record_id', $keepNodeId)->first();
            $deleteNode = $investigation->nodes()->where('record_id', $deleteNodeId)->first();

            if (!$keepNode) {
                return $this->errorResponse('Node to keep not found', 404);
            }
            if (!$deleteNode) {
                return $this->errorResponse('Node to delete not found', 404);
            }

            // Get the suggestion analysis service for merge operation
            $suggestionService = new \NewSolari\Investigations\Services\SuggestionAnalysisService(
                $this->getPlugin(),
                $this->getAIService()
            );

            $result = $suggestionService->mergeNodes($investigation, $keepNodeId, $deleteNodeId);

            return $this->successResponse([
                'transferredConnections' => $result['transferredConnections'],
                'message' => 'Nodes merged successfully',
            ]);
        } catch (\Exception $e) {
            Log::error('Accept duplicate suggestion failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'investigation_id' => $id,
            ]);
            return $this->errorResponse('Failed to merge nodes. Please try again.', 500);
        }
    }

    /**
     * Accept a connection suggestion by creating a new connection.
     */
    public function acceptConnectionSuggestion(Request $request, string $id): JsonResponse
    {
        try {
            $access = $this->validateAccess($request, $id);
            if ($access instanceof JsonResponse) {
                return $access;
            }

            $validator = Validator::make($request->all(), [
                'fromNodeId' => 'required|string|max:36',
                'toNodeId' => 'required|string|max:36',
                'relationshipType' => 'nullable|string|max:50',
                'relationshipLabel' => 'nullable|string|max:100',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 422, ['errors' => $validator->errors()]);
            }

            $investigation = $access['investigation'];
            $user = $access['user'];
            $fromNodeId = $request->input('fromNodeId');
            $toNodeId = $request->input('toNodeId');
            $relationshipType = $request->input('relationshipType', 'related_to');
            $relationshipLabel = $request->input('relationshipLabel', 'Related To');

            // Prevent self-connections
            if ($fromNodeId === $toNodeId) {
                return $this->errorResponse('Cannot create a connection from a node to itself', 422);
            }

            // Verify both nodes exist in this investigation
            $fromNode = $investigation->nodes()->where('record_id', $fromNodeId)->first();
            $toNode = $investigation->nodes()->where('record_id', $toNodeId)->first();

            if (!$fromNode) {
                return $this->errorResponse('Source node not found', 404);
            }
            if (!$toNode) {
                return $this->errorResponse('Target node not found', 404);
            }

            // Check if connection already exists
            $exists = $investigation->connections()
                ->where(function ($query) use ($fromNodeId, $toNodeId) {
                    $query->where(function ($q) use ($fromNodeId, $toNodeId) {
                        $q->where('from_node_id', $fromNodeId)
                            ->where('to_node_id', $toNodeId);
                    })->orWhere(function ($q) use ($fromNodeId, $toNodeId) {
                        $q->where('from_node_id', $toNodeId)
                            ->where('to_node_id', $fromNodeId);
                    });
                })
                ->exists();

            if ($exists) {
                return $this->errorResponse('Connection already exists between these nodes', 409);
            }

            // Create the connection
            $connection = $investigation->connections()->create([
                'from_node_id' => $fromNodeId,
                'to_node_id' => $toNodeId,
                'relationship_type' => $relationshipType,
                'relationship_label' => $relationshipLabel,
                'style' => 'solid',
                'path_type' => 'curved',
                'arrow_type' => 'forward',
                'partition_id' => $user->partition_id,
            ]);

            return $this->successResponse([
                'connection' => $connection->toArray(),
                'message' => 'Connection created successfully',
            ]);
        } catch (\Exception $e) {
            Log::error('Accept connection suggestion failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'investigation_id' => $id,
            ]);
            return $this->errorResponse('Failed to create connection. Please try again.', 500);
        }
    }
}
