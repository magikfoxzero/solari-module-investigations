<?php

namespace NewSolari\Investigations\Services;

use NewSolari\Identity\Models\IdentityUser;
use NewSolari\Core\Entity\Models\EntityRelationship;
use NewSolari\Investigations\InvestigationsPlugin;
use NewSolari\Investigations\Models\Investigation;
use NewSolari\Investigations\Models\InvestigationConnection;
use NewSolari\Investigations\Models\InvestigationNode;
use NewSolari\AIService\Services\ClaudeAIService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Service for AI-powered analysis of investigation canvas to find:
 * - Duplicate entities (exact matches and semantic duplicates)
 * - Missing connections (database relationships and AI-suggested)
 */
class SuggestionAnalysisService
{
    protected InvestigationsPlugin $plugin;

    protected ClaudeAIService $aiService;

    /** @var array<string, int> Cached connection counts by node ID */
    protected array $connectionCounts = [];

    public function __construct(InvestigationsPlugin $plugin, ClaudeAIService $aiService)
    {
        $this->plugin = $plugin;
        $this->aiService = $aiService;
    }

    /**
     * Analyze an investigation for duplicates and missing connections.
     *
     * @return array{suggestions: array, summary: array}
     */
    public function analyze(Investigation $investigation, IdentityUser $user): array
    {
        $investigation->load(['nodes', 'connections']);

        // Build connection counts cache for all nodes
        $this->buildConnectionCountsCache($investigation);

        $visibleNodes = $this->plugin->getVisibleNodesForUser($investigation->nodes, $user);
        $existingConnections = $this->getExistingConnectionPairs($investigation);

        $suggestions = [];

        // Find exact duplicates (same entity_id on canvas multiple times)
        $exactDuplicates = $this->findExactDuplicates($visibleNodes);
        foreach ($exactDuplicates as $dup) {
            $suggestions[] = array_merge($dup, ['type' => 'exact_duplicate']);
        }

        // Find semantic duplicates using AI
        if (count($visibleNodes) >= 2) {
            $semanticDuplicates = $this->findSemanticDuplicates($visibleNodes);
            foreach ($semanticDuplicates as $dup) {
                // Skip if already identified as exact duplicate
                if ($this->isDuplicatePairAlreadySuggested($suggestions, $dup['keepNode']['record_id'], $dup['duplicateNode']['record_id'])) {
                    continue;
                }
                $suggestions[] = array_merge($dup, ['type' => 'semantic_duplicate']);
            }
        }

        // Find missing database connections
        $dbConnections = $this->findMissingDatabaseConnections($visibleNodes, $existingConnections, $investigation->partition_id);
        foreach ($dbConnections as $conn) {
            $suggestions[] = array_merge($conn, ['type' => 'database_connection']);
        }

        // Find AI-suggested connections
        if (count($visibleNodes) >= 2) {
            $aiConnections = $this->findAISuggestedConnections($visibleNodes, $existingConnections, $investigation->connections->toArray());
            foreach ($aiConnections as $conn) {
                // Skip if connection already suggested
                if ($this->isConnectionAlreadySuggested($suggestions, $conn['fromNode']['record_id'], $conn['toNode']['record_id'])) {
                    continue;
                }
                $suggestions[] = array_merge($conn, ['type' => 'ai_connection']);
            }
        }

        // Sort by confidence (highest first)
        usort($suggestions, fn ($a, $b) => ($b['confidence'] ?? 0) <=> ($a['confidence'] ?? 0));

        // Add unique IDs
        foreach ($suggestions as &$suggestion) {
            $suggestion['id'] = (string) Str::uuid();
        }

        $exactDuplicates = count(array_filter($suggestions, fn ($s) => $s['type'] === 'exact_duplicate'));
        $semanticDuplicates = count(array_filter($suggestions, fn ($s) => $s['type'] === 'semantic_duplicate'));
        $databaseConnections = count(array_filter($suggestions, fn ($s) => $s['type'] === 'database_connection'));
        $aiConnections = count(array_filter($suggestions, fn ($s) => $s['type'] === 'ai_connection'));

        return [
            'suggestions' => $suggestions,
            'summary' => [
                'exactDuplicates' => $exactDuplicates,
                'semanticDuplicates' => $semanticDuplicates,
                'databaseConnections' => $databaseConnections,
                'aiConnections' => $aiConnections,
                'total' => count($suggestions),
            ],
        ];
    }

    /**
     * Find exact duplicates (same entity_id appearing multiple times on canvas).
     */
    protected function findExactDuplicates(array $nodes): array
    {
        $duplicates = [];

        // Group nodes by entity_id
        $byEntityId = [];
        foreach ($nodes as $node) {
            $key = $node['entity_type'] . ':' . $node['entity_id'];
            $byEntityId[$key][] = $node;
        }

        // Find groups with more than one node
        foreach ($byEntityId as $entityKey => $group) {
            if (count($group) < 2) {
                continue;
            }

            // Use first node as "keep", mark others as duplicates
            $keepNode = $group[0];
            $keepConnectionCount = $this->countNodeConnections($keepNode['record_id'], $nodes);

            for ($i = 1; $i < count($group); $i++) {
                $duplicateNode = $group[$i];
                $dupConnectionCount = $this->countNodeConnections($duplicateNode['record_id'], $nodes);

                // Prefer to keep the node with more connections
                if ($dupConnectionCount > $keepConnectionCount) {
                    [$keepNode, $duplicateNode] = [$duplicateNode, $keepNode];
                    [$keepConnectionCount, $dupConnectionCount] = [$dupConnectionCount, $keepConnectionCount];
                }

                $duplicates[] = [
                    'keepNode' => $this->formatNodeForResponse($keepNode),
                    'duplicateNode' => $this->formatNodeForResponse($duplicateNode),
                    'connectionCount' => $dupConnectionCount,
                    'confidence' => 1.0,
                    'reason' => 'Exact duplicate: same entity appears multiple times on canvas',
                ];
            }
        }

        return $duplicates;
    }

    /**
     * Find semantic duplicates using AI analysis.
     */
    protected function findSemanticDuplicates(array $nodes): array
    {
        $duplicates = [];

        // Prepare entity data for AI analysis
        $entities = [];
        foreach ($nodes as $node) {
            $entity = $this->resolveNodeEntity($node);
            $entities[] = [
                'id' => $node['record_id'],
                'type' => $node['entity_type'],
                'label' => $node['display_label'] ?? $node['label_override'] ?? 'Unknown',
                'content' => $entity ? $this->extractEntityContent($entity, $node['entity_type']) : '',
            ];
        }

        try {
            $aiResult = $this->aiService->detectSemanticDuplicates($entities);

            foreach ($aiResult['duplicates'] ?? [] as $dup) {
                $node1 = $this->findNodeById($nodes, $dup['id1']);
                $node2 = $this->findNodeById($nodes, $dup['id2']);

                if (!$node1 || !$node2) {
                    continue;
                }

                // Determine which to keep (prefer one with more connections)
                $conn1 = $this->countNodeConnections($node1['record_id'], $nodes);
                $conn2 = $this->countNodeConnections($node2['record_id'], $nodes);

                if ($conn2 > $conn1) {
                    [$node1, $node2] = [$node2, $node1];
                    [$conn1, $conn2] = [$conn2, $conn1];
                }

                $duplicates[] = [
                    'keepNode' => $this->formatNodeForResponse($node1),
                    'duplicateNode' => $this->formatNodeForResponse($node2),
                    'connectionCount' => $conn2,
                    'confidence' => (float) ($dup['confidence'] ?? 0.8),
                    'reason' => $dup['reason'] ?? 'AI detected these entities may refer to the same thing',
                ];
            }
        } catch (\Exception $e) {
            Log::warning('AI semantic duplicate detection failed', ['error' => $e->getMessage()]);
        }

        return $duplicates;
    }

    /**
     * Find missing connections from database relationships.
     */
    protected function findMissingDatabaseConnections(array $nodes, array $existingConnections, string $partitionId): array
    {
        $connections = [];
        $nodeIds = array_column($nodes, 'record_id');

        // Build entity lookup
        $nodeByEntityKey = [];
        foreach ($nodes as $node) {
            $key = $node['entity_type'] . ':' . $node['entity_id'];
            $nodeByEntityKey[$key] = $node;
        }

        // Get all entity IDs on canvas
        $entityPairs = [];
        foreach ($nodes as $node) {
            $entityPairs[] = [
                'type' => $node['entity_type'],
                'id' => $node['entity_id'],
                'node_id' => $node['record_id'],
            ];
        }

        // Query relationships between entities on canvas
        $relationships = EntityRelationship::where('partition_id', $partitionId)
            ->where(function ($query) use ($entityPairs) {
                foreach ($entityPairs as $entity) {
                    $query->orWhere(function ($q) use ($entity) {
                        $q->where('source_entity_type', $entity['type'])
                            ->where('source_entity_id', $entity['id']);
                    });
                    $query->orWhere(function ($q) use ($entity) {
                        $q->where('target_entity_type', $entity['type'])
                            ->where('target_entity_id', $entity['id']);
                    });
                }
            })
            ->get();

        foreach ($relationships as $rel) {
            $sourceKey = $rel->source_entity_type . ':' . $rel->source_entity_id;
            $targetKey = $rel->target_entity_type . ':' . $rel->target_entity_id;

            $sourceNode = $nodeByEntityKey[$sourceKey] ?? null;
            $targetNode = $nodeByEntityKey[$targetKey] ?? null;

            // Both entities must be on canvas
            if (!$sourceNode || !$targetNode) {
                continue;
            }

            // Skip if connection already exists
            $pairKey = $this->getPairKey($sourceNode['record_id'], $targetNode['record_id']);
            if (isset($existingConnections[$pairKey])) {
                continue;
            }

            $connections[] = [
                'fromNode' => $this->formatNodeForResponse($sourceNode),
                'toNode' => $this->formatNodeForResponse($targetNode),
                'relationshipType' => $rel->relationship_type ?? 'related_to',
                'relationshipLabel' => $rel->relationship_label ?? ucfirst(str_replace('_', ' ', $rel->relationship_type ?? 'Related To')),
                'confidence' => 1.0,
                'reason' => 'Existing relationship found in database',
            ];
        }

        return $connections;
    }

    /**
     * Find AI-suggested connections based on content analysis.
     */
    protected function findAISuggestedConnections(array $nodes, array $existingConnections, array $canvasConnections): array
    {
        $connections = [];

        // Prepare entity data for AI analysis
        $entities = [];
        foreach ($nodes as $node) {
            $entity = $this->resolveNodeEntity($node);
            $entities[] = [
                'id' => $node['record_id'],
                'type' => $node['entity_type'],
                'label' => $node['display_label'] ?? $node['label_override'] ?? 'Unknown',
                'content' => $entity ? $this->extractEntityContent($entity, $node['entity_type']) : '',
            ];
        }

        // Format existing connections for AI
        $existingForAI = [];
        foreach ($canvasConnections as $conn) {
            $existingForAI[] = [
                'from' => $conn['from_node_id'],
                'to' => $conn['to_node_id'],
                'type' => $conn['relationship_type'] ?? 'related',
            ];
        }

        try {
            $aiResult = $this->aiService->suggestMissingConnections($entities, $existingForAI);

            foreach ($aiResult['suggestions'] ?? [] as $suggestion) {
                $fromNode = $this->findNodeById($nodes, $suggestion['fromId']);
                $toNode = $this->findNodeById($nodes, $suggestion['toId']);

                if (!$fromNode || !$toNode) {
                    continue;
                }

                // Skip if connection already exists
                $pairKey = $this->getPairKey($fromNode['record_id'], $toNode['record_id']);
                if (isset($existingConnections[$pairKey])) {
                    continue;
                }

                $connections[] = [
                    'fromNode' => $this->formatNodeForResponse($fromNode),
                    'toNode' => $this->formatNodeForResponse($toNode),
                    'relationshipType' => $suggestion['type'] ?? 'associated_with',
                    'relationshipLabel' => $suggestion['label'] ?? 'Associated With',
                    'confidence' => (float) ($suggestion['confidence'] ?? 0.7),
                    'reason' => $suggestion['reason'] ?? 'AI suggests these entities may be connected',
                ];
            }
        } catch (\Exception $e) {
            Log::warning('AI connection suggestion failed', ['error' => $e->getMessage()]);
        }

        return $connections;
    }

    /**
     * Merge two nodes: delete the duplicate and transfer its connections to the kept node.
     *
     * @return array{transferredConnections: int}
     */
    public function mergeNodes(Investigation $investigation, string $keepNodeId, string $deleteNodeId): array
    {
        $transferredCount = 0;

        DB::transaction(function () use ($investigation, $keepNodeId, $deleteNodeId, &$transferredCount) {
            // Get the node to delete
            $deleteNode = InvestigationNode::where('record_id', $deleteNodeId)
                ->where('investigation_id', $investigation->record_id)
                ->first();

            if (!$deleteNode) {
                throw new \Exception('Node to delete not found');
            }

            // Get connections involving the node to delete
            $connections = InvestigationConnection::where('investigation_id', $investigation->record_id)
                ->where(function ($q) use ($deleteNodeId) {
                    $q->where('from_node_id', $deleteNodeId)
                        ->orWhere('to_node_id', $deleteNodeId);
                })
                ->get();

            // Transfer connections to the kept node
            foreach ($connections as $conn) {
                $newFromId = $conn->from_node_id === $deleteNodeId ? $keepNodeId : $conn->from_node_id;
                $newToId = $conn->to_node_id === $deleteNodeId ? $keepNodeId : $conn->to_node_id;

                // Skip self-connections
                if ($newFromId === $newToId) {
                    $conn->delete();
                    continue;
                }

                // Check if connection already exists
                $exists = InvestigationConnection::where('investigation_id', $investigation->record_id)
                    ->where(function ($q) use ($newFromId, $newToId) {
                        $q->where(function ($q2) use ($newFromId, $newToId) {
                            $q2->where('from_node_id', $newFromId)
                                ->where('to_node_id', $newToId);
                        })->orWhere(function ($q2) use ($newFromId, $newToId) {
                            $q2->where('from_node_id', $newToId)
                                ->where('to_node_id', $newFromId);
                        });
                    })
                    ->exists();

                if ($exists) {
                    // Delete duplicate connection
                    $conn->delete();
                } else {
                    // Transfer connection
                    $conn->from_node_id = $newFromId;
                    $conn->to_node_id = $newToId;
                    $conn->save();
                    $transferredCount++;
                }
            }

            // Delete the duplicate node
            $deleteNode->delete();
        });

        return ['transferredConnections' => $transferredCount];
    }

    /**
     * Get existing connection pairs for quick lookup.
     */
    protected function getExistingConnectionPairs(Investigation $investigation): array
    {
        $pairs = [];
        foreach ($investigation->connections as $conn) {
            $key = $this->getPairKey($conn->from_node_id, $conn->to_node_id);
            $pairs[$key] = true;
        }

        return $pairs;
    }

    /**
     * Get a consistent key for a node pair (order-independent).
     */
    protected function getPairKey(string $id1, string $id2): string
    {
        return $id1 < $id2 ? "{$id1}:{$id2}" : "{$id2}:{$id1}";
    }

    /**
     * Build a cache of connection counts for all nodes in the investigation.
     */
    protected function buildConnectionCountsCache(Investigation $investigation): void
    {
        $this->connectionCounts = [];

        foreach ($investigation->connections as $conn) {
            $fromId = $conn->from_node_id;
            $toId = $conn->to_node_id;

            $this->connectionCounts[$fromId] = ($this->connectionCounts[$fromId] ?? 0) + 1;
            $this->connectionCounts[$toId] = ($this->connectionCounts[$toId] ?? 0) + 1;
        }
    }

    /**
     * Count connections for a node using the cached counts.
     */
    protected function countNodeConnections(string $nodeId, array $nodes): int
    {
        return $this->connectionCounts[$nodeId] ?? 0;
    }

    /**
     * Resolve the entity linked to a node.
     */
    protected function resolveNodeEntity(array $node): ?object
    {
        $nodeModel = InvestigationNode::find($node['record_id']);

        return $nodeModel?->resolveEntity();
    }

    /**
     * Extract content from an entity for AI analysis.
     */
    protected function extractEntityContent(object $entity, string $type): string
    {
        $content = [];

        // Common fields
        if (!empty($entity->title)) {
            $content[] = $entity->title;
        }
        if (!empty($entity->name)) {
            $content[] = $entity->name;
        }
        if (!empty($entity->description)) {
            $content[] = $entity->description;
        }
        if (!empty($entity->content)) {
            $content[] = is_string($entity->content) ? $entity->content : json_encode($entity->content);
        }
        if (!empty($entity->notes)) {
            $content[] = $entity->notes;
        }

        // Type-specific fields
        switch ($type) {
            case 'person':
                if (!empty($entity->full_name)) {
                    $content[] = $entity->full_name;
                }
                if (!empty($entity->occupation)) {
                    $content[] = "Occupation: {$entity->occupation}";
                }
                if (!empty($entity->organization)) {
                    $content[] = "Organization: {$entity->organization}";
                }
                break;

            case 'place':
                if (!empty($entity->address)) {
                    $content[] = "Address: {$entity->address}";
                }
                if (!empty($entity->city)) {
                    $content[] = "City: {$entity->city}";
                }
                break;

            case 'event':
                if (!empty($entity->start_date)) {
                    $content[] = "Date: {$entity->start_date}";
                }
                if (!empty($entity->location)) {
                    $content[] = "Location: {$entity->location}";
                }
                break;
        }

        return implode("\n", array_filter($content));
    }

    /**
     * Format a node for API response.
     */
    protected function formatNodeForResponse(array $node): array
    {
        return [
            'record_id' => $node['record_id'],
            'entity_type' => $node['entity_type'],
            'entity_id' => $node['entity_id'],
            'display_label' => $node['display_label'] ?? $node['label_override'] ?? 'Unknown',
            'x' => $node['x'] ?? 0,
            'y' => $node['y'] ?? 0,
        ];
    }

    /**
     * Find a node by its record_id.
     */
    protected function findNodeById(array $nodes, string $id): ?array
    {
        foreach ($nodes as $node) {
            if ($node['record_id'] === $id) {
                return $node;
            }
        }

        return null;
    }

    /**
     * Check if a duplicate pair is already suggested.
     */
    protected function isDuplicatePairAlreadySuggested(array $suggestions, string $id1, string $id2): bool
    {
        foreach ($suggestions as $suggestion) {
            if (!isset($suggestion['keepNode'], $suggestion['duplicateNode'])) {
                continue;
            }
            $keepId = $suggestion['keepNode']['record_id'];
            $dupId = $suggestion['duplicateNode']['record_id'];
            if (($keepId === $id1 && $dupId === $id2) || ($keepId === $id2 && $dupId === $id1)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if a connection is already suggested.
     */
    protected function isConnectionAlreadySuggested(array $suggestions, string $fromId, string $toId): bool
    {
        foreach ($suggestions as $suggestion) {
            if (!isset($suggestion['fromNode'], $suggestion['toNode'])) {
                continue;
            }
            $suggFromId = $suggestion['fromNode']['record_id'];
            $suggToId = $suggestion['toNode']['record_id'];
            if (($suggFromId === $fromId && $suggToId === $toId) || ($suggFromId === $toId && $suggToId === $fromId)) {
                return true;
            }
        }

        return false;
    }
}
