<?php

namespace NewSolari\Investigations\Services;

use NewSolari\Identity\Models\IdentityUser;
use NewSolari\Core\Contracts\IdentityUserContract;
use NewSolari\Core\Entity\Models\EntityRelationship;
use NewSolari\Investigations\InvestigationsPlugin;
use NewSolari\Investigations\Models\Investigation;
use NewSolari\Investigations\Models\InvestigationConnection;
use Illuminate\Support\Collection;

/**
 * Service for detecting and suggesting relationships between entities on the canvas.
 *
 * This service handles:
 * - Finding existing database relationships between entities
 * - Suggesting potential connections based on entity data
 * - Auto-linking entities when added to the canvas
 * - Detecting relationship patterns
 */
class RelationshipDetectionService
{
    protected InvestigationsPlugin $plugin;

    public function __construct(InvestigationsPlugin $plugin)
    {
        $this->plugin = $plugin;
    }

    /**
     * Find existing relationships between canvas entities and a new entity.
     *
     * @param array $existingEntities Array of ['type' => ..., 'id' => ...] for entities on canvas
     * @param string $newEntityType Type of the new entity
     * @param string $newEntityId ID of the new entity
     * @param string $partitionId Partition ID for filtering
     * @return array Found relationships
     */
    public function findExistingRelationships(
        array $existingEntities,
        string $newEntityType,
        string $newEntityId,
        string $partitionId
    ): array {
        // Delegate to plugin method for now
        return $this->plugin->findExistingRelationships(
            $existingEntities,
            $newEntityType,
            $newEntityId,
            $partitionId
        );
    }

    /**
     * Find all relationships between entities currently on the canvas.
     *
     * @param Investigation $investigation The investigation to analyze
     * @param IdentityUserContract $user The user for access filtering
     * @return array Discovered relationships
     */
    public function discoverCanvasRelationships(Investigation $investigation, IdentityUserContract $user): array
    {
        $visibleNodes = $this->plugin->getVisibleNodesForUser($investigation->nodes, $user);
        $relationships = [];

        // Get existing connections to avoid duplicates
        $existingConnections = $this->getExistingConnectionPairs($investigation);

        // Build entity list
        $entities = [];
        foreach ($visibleNodes as $node) {
            $entities[$node['record_id']] = [
                'type' => $node['entity_type'],
                'id' => $node['entity_id'],
                'node_id' => $node['record_id'],
            ];
        }

        // Check each pair for relationships
        $nodeIds = array_keys($entities);
        $checkedPairs = [];

        foreach ($nodeIds as $i => $nodeId1) {
            foreach ($nodeIds as $j => $nodeId2) {
                if ($i >= $j) {
                    continue; // Skip self and already checked pairs
                }

                $pairKey = $this->getPairKey($nodeId1, $nodeId2);
                if (isset($checkedPairs[$pairKey]) || isset($existingConnections[$pairKey])) {
                    continue;
                }
                $checkedPairs[$pairKey] = true;

                $entity1 = $entities[$nodeId1];
                $entity2 = $entities[$nodeId2];

                // Find relationships between these entities
                $found = $this->findRelationshipsBetween(
                    $entity1['type'],
                    $entity1['id'],
                    $entity2['type'],
                    $entity2['id'],
                    $investigation->partition_id
                );

                foreach ($found as $rel) {
                    $relationships[] = array_merge($rel, [
                        'from_node_id' => $nodeId1,
                        'to_node_id' => $nodeId2,
                    ]);
                }
            }
        }

        return $relationships;
    }

    /**
     * Get existing connection pairs on an investigation.
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
     * Find relationships between two specific entities.
     */
    protected function findRelationshipsBetween(
        string $type1,
        string $id1,
        string $type2,
        string $id2,
        string $partitionId
    ): array {
        $relationships = [];

        // Query entity_relationships table in both directions
        $found = EntityRelationship::where('partition_id', $partitionId)
            ->where(function ($query) use ($type1, $id1, $type2, $id2) {
                $query->where(function ($q) use ($type1, $id1, $type2, $id2) {
                    $q->where('source_entity_type', $type1)
                        ->where('source_entity_id', $id1)
                        ->where('target_entity_type', $type2)
                        ->where('target_entity_id', $id2);
                })->orWhere(function ($q) use ($type1, $id1, $type2, $id2) {
                    $q->where('source_entity_type', $type2)
                        ->where('source_entity_id', $id2)
                        ->where('target_entity_type', $type1)
                        ->where('target_entity_id', $id1);
                });
            })
            ->get();

        foreach ($found as $rel) {
            $relationships[] = [
                'relationship_id' => $rel->record_id,
                'relationship_type' => $rel->relationship_type,
                'relationship_label' => $rel->relationship_label ?? $rel->relationship_type,
                'source_entity_type' => $rel->source_entity_type,
                'source_entity_id' => $rel->source_entity_id,
                'target_entity_type' => $rel->target_entity_type,
                'target_entity_id' => $rel->target_entity_id,
                'direction' => $rel->source_entity_id === $id1 ? 'forward' : 'reverse',
            ];
        }

        return $relationships;
    }

    /**
     * Suggest connections based on entity attributes (e.g., shared locations, dates).
     *
     * @param Investigation $investigation The investigation to analyze
     * @param IdentityUserContract $user The user for access filtering
     * @return array Suggested connections with reasons
     */
    public function suggestConnections(Investigation $investigation, IdentityUserContract $user): array
    {
        $visibleNodes = $this->plugin->getVisibleNodesForUser($investigation->nodes, $user);
        $suggestions = [];

        // Group nodes by entity type for pattern detection
        $nodesByType = [];
        foreach ($visibleNodes as $node) {
            $nodesByType[$node['entity_type']][] = $node;
        }

        // Suggest connections for people at same places
        $suggestions = array_merge($suggestions, $this->suggestBySharedLocation($nodesByType, $investigation->partition_id));

        // Suggest connections for entities with same dates
        $suggestions = array_merge($suggestions, $this->suggestBySharedDate($nodesByType, $investigation->partition_id));

        // Suggest connections for entities with similar tags
        $suggestions = array_merge($suggestions, $this->suggestBySharedTags($visibleNodes));

        return $suggestions;
    }

    /**
     * Suggest connections based on shared location.
     */
    protected function suggestBySharedLocation(array $nodesByType, string $partitionId): array
    {
        $suggestions = [];

        // Get people nodes
        $people = $nodesByType['person'] ?? [];
        $places = $nodesByType['place'] ?? [];

        if (empty($people) || empty($places)) {
            return $suggestions;
        }

        // This would require resolving entities and comparing locations
        // For now, return empty - can be enhanced later
        return $suggestions;
    }

    /**
     * Suggest connections based on shared dates.
     */
    protected function suggestBySharedDate(array $nodesByType, string $partitionId): array
    {
        $suggestions = [];

        // Get event nodes
        $events = $nodesByType['event'] ?? [];

        if (count($events) < 2) {
            return $suggestions;
        }

        // This would require resolving entities and comparing dates
        // For now, return empty - can be enhanced later
        return $suggestions;
    }

    /**
     * Suggest connections based on shared tags.
     */
    protected function suggestBySharedTags(array $nodes): array
    {
        $suggestions = [];
        $nodesByTag = [];

        // Group nodes by their tags
        foreach ($nodes as $node) {
            $tags = $node['tags'] ?? [];
            if (!is_array($tags)) {
                continue;
            }

            foreach ($tags as $tag) {
                $tagLower = strtolower(trim($tag));
                if (!isset($nodesByTag[$tagLower])) {
                    $nodesByTag[$tagLower] = [];
                }
                $nodesByTag[$tagLower][] = $node;
            }
        }

        // Suggest connections between nodes with shared tags
        foreach ($nodesByTag as $tag => $taggedNodes) {
            if (count($taggedNodes) < 2) {
                continue;
            }

            for ($i = 0; $i < count($taggedNodes) - 1; $i++) {
                for ($j = $i + 1; $j < count($taggedNodes); $j++) {
                    $suggestions[] = [
                        'from_node_id' => $taggedNodes[$i]['record_id'],
                        'to_node_id' => $taggedNodes[$j]['record_id'],
                        'reason' => 'shared_tag',
                        'tag' => $tag,
                        'suggested_label' => "Related ({$tag})",
                    ];
                }
            }
        }

        return $suggestions;
    }

    /**
     * Auto-create connections for discovered relationships.
     *
     * @param Investigation $investigation The investigation
     * @param array $relationships The relationships to create connections for
     * @param string|null $createdBy User ID creating the connections
     * @return array Created connections
     */
    public function autoCreateConnections(
        Investigation $investigation,
        array $relationships,
        ?string $createdBy = null
    ): array {
        $created = [];

        foreach ($relationships as $rel) {
            // Check if connection already exists
            $exists = InvestigationConnection::where('investigation_id', $investigation->record_id)
                ->where(function ($query) use ($rel) {
                    $query->where(function ($q) use ($rel) {
                        $q->where('from_node_id', $rel['from_node_id'])
                            ->where('to_node_id', $rel['to_node_id']);
                    })->orWhere(function ($q) use ($rel) {
                        $q->where('from_node_id', $rel['to_node_id'])
                            ->where('to_node_id', $rel['from_node_id']);
                    });
                })
                ->exists();

            if ($exists) {
                continue;
            }

            $connection = InvestigationConnection::create([
                'investigation_id' => $investigation->record_id,
                'from_node_id' => $rel['from_node_id'],
                'to_node_id' => $rel['to_node_id'],
                'relationship_type' => $rel['relationship_type'] ?? 'related',
                'relationship_label' => $rel['relationship_label'] ?? 'Related',
                'partition_id' => $investigation->partition_id,
            ]);

            $created[] = $connection->toArray();
        }

        return $created;
    }

    /**
     * Get relationship statistics for an investigation.
     */
    public function getRelationshipStats(Investigation $investigation): array
    {
        $connections = $investigation->connections;

        // Group by relationship type
        $byType = [];
        foreach ($connections as $conn) {
            $type = $conn->relationship_type ?? 'unknown';
            if (!isset($byType[$type])) {
                $byType[$type] = 0;
            }
            $byType[$type]++;
        }

        // Group by sentiment
        $bySentiment = [];
        foreach ($connections as $conn) {
            $sentiment = $conn->sentiment ?? 'neutral';
            if (!isset($bySentiment[$sentiment])) {
                $bySentiment[$sentiment] = 0;
            }
            $bySentiment[$sentiment]++;
        }

        return [
            'total_connections' => $connections->count(),
            'by_type' => $byType,
            'by_sentiment' => $bySentiment,
        ];
    }
}
