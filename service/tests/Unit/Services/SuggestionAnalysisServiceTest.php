<?php

namespace Tests\Unit\Services;

use NewSolari\Core\Identity\Models\IdentityPartition;
use NewSolari\Core\Identity\Models\IdentityUser;
use NewSolari\Investigations\InvestigationsPlugin;
use NewSolari\Investigations\Models\Investigation;
use NewSolari\Investigations\Models\InvestigationConnection;
use NewSolari\Investigations\Models\InvestigationNode;
use NewSolari\Investigations\Services\SuggestionAnalysisService;
use NewSolari\AIService\Services\ClaudeAIService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class SuggestionAnalysisServiceTest extends TestCase
{
    use RefreshDatabase;

    protected SuggestionAnalysisService $service;

    protected InvestigationsPlugin $plugin;

    protected $partition;

    protected $user;

    protected $investigation;

    protected $mockAIService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->plugin = new InvestigationsPlugin();

        // Mock the AI service to avoid actual API calls
        $this->mockAIService = Mockery::mock(ClaudeAIService::class);
        $this->mockAIService->shouldReceive('detectSemanticDuplicates')
            ->andReturn(['duplicates' => []])
            ->byDefault();
        $this->mockAIService->shouldReceive('suggestMissingConnections')
            ->andReturn(['suggestions' => []])
            ->byDefault();

        $this->service = new SuggestionAnalysisService($this->plugin, $this->mockAIService);

        $this->partition = IdentityPartition::create([
            'record_id' => 'suggestion-test-partition',
            'name' => 'Suggestion Analysis Test Partition',
            'description' => 'Test partition for suggestion analysis service tests',
        ]);

        $this->user = IdentityUser::create([
            'record_id' => 'suggestion-test-user',
            'username' => 'suggestiontestuser',
            'email' => 'suggestiontest@example.com',
            'password_hash' => 'password',
            'partition_id' => $this->partition->record_id,
            'is_active' => true,
        ]);
        $this->user->setSystemUser(true);

        $this->investigation = Investigation::create([
            'record_id' => 'suggestion-test-investigation',
            'title' => 'Suggestion Analysis Test Investigation',
            'case_number' => 'CASE-SUGGESTION-001',
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
            'is_public' => true,
        ]);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    /** @test */
    public function it_returns_empty_suggestions_for_investigation_without_nodes()
    {
        $result = $this->service->analyze($this->investigation, $this->user);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('suggestions', $result);
        $this->assertArrayHasKey('summary', $result);
        $this->assertEmpty($result['suggestions']);
        $this->assertEquals(0, $result['summary']['exactDuplicates']);
        $this->assertEquals(0, $result['summary']['semanticDuplicates']);
        $this->assertEquals(0, $result['summary']['databaseConnections']);
        $this->assertEquals(0, $result['summary']['aiConnections']);
        $this->assertEquals(0, $result['summary']['total']);
    }

    /** @test */
    public function it_finds_exact_duplicates_via_protected_method()
    {
        // Test the exact duplicate detection logic directly since the database
        // enforces uniqueness (investigation_id, entity_type, entity_id)
        $nodes = [
            [
                'record_id' => 'dup-node-1',
                'entity_type' => 'person',
                'entity_id' => 'same-person-id',
                'display_label' => 'John Doe',
                'x' => 100,
                'y' => 100,
            ],
            [
                'record_id' => 'dup-node-2',
                'entity_type' => 'person',
                'entity_id' => 'same-person-id',
                'display_label' => 'John Doe',
                'x' => 300,
                'y' => 100,
            ],
        ];

        $result = $this->callProtectedMethod($this->service, 'findExactDuplicates', [$nodes]);

        $this->assertCount(1, $result);
        $this->assertEquals(1.0, $result[0]['confidence']);
        $this->assertArrayHasKey('keepNode', $result[0]);
        $this->assertArrayHasKey('duplicateNode', $result[0]);
    }

    /** @test */
    public function it_handles_multiple_duplicates_of_same_entity_via_protected_method()
    {
        // Test with three nodes pointing to the same entity
        $nodes = [
            ['record_id' => 'triple-1', 'entity_type' => 'person', 'entity_id' => 'triple-person', 'display_label' => 'Person', 'x' => 100, 'y' => 100],
            ['record_id' => 'triple-2', 'entity_type' => 'person', 'entity_id' => 'triple-person', 'display_label' => 'Person', 'x' => 200, 'y' => 100],
            ['record_id' => 'triple-3', 'entity_type' => 'person', 'entity_id' => 'triple-person', 'display_label' => 'Person', 'x' => 300, 'y' => 100],
        ];

        $result = $this->callProtectedMethod($this->service, 'findExactDuplicates', [$nodes]);

        // Should create 2 suggestions (node2 and node3 are duplicates of node1)
        $this->assertCount(2, $result);
    }

    /** @test */
    public function it_does_not_find_duplicates_for_different_entities()
    {
        InvestigationNode::create([
            'record_id' => 'unique-node-1',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'person-1',
            'partition_id' => $this->partition->record_id,
            'x' => 100,
            'y' => 100,
        ]);

        InvestigationNode::create([
            'record_id' => 'unique-node-2',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'person-2',
            'partition_id' => $this->partition->record_id,
            'x' => 300,
            'y' => 100,
        ]);

        $result = $this->service->analyze($this->investigation, $this->user);

        $this->assertEquals(0, $result['summary']['exactDuplicates']);
    }

    /** @test */
    public function it_merges_nodes_and_transfers_connections()
    {
        // Create nodes - use different entity_ids since DB enforces uniqueness
        $keepNode = InvestigationNode::create([
            'record_id' => 'merge-keep-node',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'merge-person-keep',
            'partition_id' => $this->partition->record_id,
            'x' => 100,
            'y' => 100,
        ]);

        $deleteNode = InvestigationNode::create([
            'record_id' => 'merge-delete-node',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'merge-person-delete',
            'partition_id' => $this->partition->record_id,
            'x' => 300,
            'y' => 100,
        ]);

        $otherNode = InvestigationNode::create([
            'record_id' => 'merge-other-node',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'place',
            'entity_id' => 'some-place',
            'partition_id' => $this->partition->record_id,
            'x' => 500,
            'y' => 100,
        ]);

        // Create a connection from the node that will be deleted
        InvestigationConnection::create([
            'record_id' => 'merge-connection-1',
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $deleteNode->record_id,
            'to_node_id' => $otherNode->record_id,
            'relationship_type' => 'visited',
            'partition_id' => $this->partition->record_id,
        ]);

        $result = $this->service->mergeNodes(
            $this->investigation,
            $keepNode->record_id,
            $deleteNode->record_id
        );

        // Verify connection was transferred
        $this->assertEquals(1, $result['transferredConnections']);

        // Verify deleted node is gone
        $this->assertNull(InvestigationNode::find($deleteNode->record_id));

        // Verify kept node still exists
        $this->assertNotNull(InvestigationNode::find($keepNode->record_id));

        // Verify connection now points to kept node
        $connection = InvestigationConnection::find('merge-connection-1');
        $this->assertNotNull($connection);
        $this->assertEquals($keepNode->record_id, $connection->from_node_id);
        $this->assertEquals($otherNode->record_id, $connection->to_node_id);
    }

    /** @test */
    public function it_avoids_creating_self_connections_when_merging()
    {
        // Create nodes - use different entity_ids since DB enforces uniqueness
        $keepNode = InvestigationNode::create([
            'record_id' => 'self-conn-keep',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'self-person-keep',
            'partition_id' => $this->partition->record_id,
            'x' => 100,
            'y' => 100,
        ]);

        $deleteNode = InvestigationNode::create([
            'record_id' => 'self-conn-delete',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'self-person-delete',
            'partition_id' => $this->partition->record_id,
            'x' => 300,
            'y' => 100,
        ]);

        // Create a connection between the two nodes (would become self-connection after merge)
        InvestigationConnection::create([
            'record_id' => 'self-connection',
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $deleteNode->record_id,
            'to_node_id' => $keepNode->record_id,
            'relationship_type' => 'knows',
            'partition_id' => $this->partition->record_id,
        ]);

        $result = $this->service->mergeNodes(
            $this->investigation,
            $keepNode->record_id,
            $deleteNode->record_id
        );

        // Self-connection should be deleted, not transferred
        $this->assertEquals(0, $result['transferredConnections']);
        $this->assertNull(InvestigationConnection::find('self-connection'));
    }

    /** @test */
    public function it_avoids_duplicate_connections_when_merging()
    {
        // Create nodes - use different entity_ids since DB enforces uniqueness
        $keepNode = InvestigationNode::create([
            'record_id' => 'dup-conn-keep',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'dup-conn-person-keep',
            'partition_id' => $this->partition->record_id,
            'x' => 100,
            'y' => 100,
        ]);

        $deleteNode = InvestigationNode::create([
            'record_id' => 'dup-conn-delete',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'dup-conn-person-delete',
            'partition_id' => $this->partition->record_id,
            'x' => 300,
            'y' => 100,
        ]);

        $otherNode = InvestigationNode::create([
            'record_id' => 'dup-conn-other',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'place',
            'entity_id' => 'dup-conn-place',
            'partition_id' => $this->partition->record_id,
            'x' => 500,
            'y' => 100,
        ]);

        // Both nodes have connections to the same other node
        InvestigationConnection::create([
            'record_id' => 'keep-to-other',
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $keepNode->record_id,
            'to_node_id' => $otherNode->record_id,
            'relationship_type' => 'visited',
            'partition_id' => $this->partition->record_id,
        ]);

        InvestigationConnection::create([
            'record_id' => 'delete-to-other',
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $deleteNode->record_id,
            'to_node_id' => $otherNode->record_id,
            'relationship_type' => 'visited',
            'partition_id' => $this->partition->record_id,
        ]);

        $result = $this->service->mergeNodes(
            $this->investigation,
            $keepNode->record_id,
            $deleteNode->record_id
        );

        // Duplicate connection should be deleted, not transferred
        $this->assertEquals(0, $result['transferredConnections']);

        // Only one connection should remain
        $remainingConnections = InvestigationConnection::where('investigation_id', $this->investigation->record_id)
            ->count();
        $this->assertEquals(1, $remainingConnections);
    }

    /** @test */
    public function it_throws_exception_when_delete_node_not_found()
    {
        $keepNode = InvestigationNode::create([
            'record_id' => 'merge-throw-keep',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'throw-person',
            'partition_id' => $this->partition->record_id,
            'x' => 100,
            'y' => 100,
        ]);

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Node to delete not found');

        $this->service->mergeNodes(
            $this->investigation,
            $keepNode->record_id,
            'non-existent-node-id'
        );
    }

    /** @test */
    public function it_generates_unique_suggestion_ids()
    {
        // Setup mock to return a semantic duplicate to test suggestion IDs
        $this->mockAIService->shouldReceive('detectSemanticDuplicates')
            ->once()
            ->andReturn([
                'duplicates' => [
                    [
                        'id1' => 'uuid-test-node-1',
                        'id2' => 'uuid-test-node-2',
                        'confidence' => 0.85,
                        'reason' => 'Similar names',
                    ],
                ],
            ]);

        $this->service = new SuggestionAnalysisService($this->plugin, $this->mockAIService);

        InvestigationNode::create([
            'record_id' => 'uuid-test-node-1',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'uuid-test-person-1',
            'partition_id' => $this->partition->record_id,
            'x' => 100,
            'y' => 100,
        ]);

        InvestigationNode::create([
            'record_id' => 'uuid-test-node-2',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'uuid-test-person-2',
            'partition_id' => $this->partition->record_id,
            'x' => 300,
            'y' => 100,
        ]);

        $result = $this->service->analyze($this->investigation, $this->user);

        foreach ($result['suggestions'] as $suggestion) {
            $this->assertArrayHasKey('id', $suggestion);
            $this->assertMatchesRegularExpression(
                '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/',
                $suggestion['id']
            );
        }
    }

    /** @test */
    public function it_formats_node_for_response_correctly()
    {
        // Test the formatNodeForResponse method directly
        $node = [
            'record_id' => 'format-test-node',
            'entity_type' => 'person',
            'entity_id' => 'format-test-person',
            'label_override' => 'Custom Label',
            'x' => 150,
            'y' => 250,
        ];

        $result = $this->callProtectedMethod($this->service, 'formatNodeForResponse', [$node]);

        $this->assertArrayHasKey('record_id', $result);
        $this->assertArrayHasKey('entity_type', $result);
        $this->assertArrayHasKey('entity_id', $result);
        $this->assertArrayHasKey('display_label', $result);
        $this->assertArrayHasKey('x', $result);
        $this->assertArrayHasKey('y', $result);
        $this->assertEquals('format-test-node', $result['record_id']);
        $this->assertEquals('Custom Label', $result['display_label']);
    }

    /** @test */
    public function it_uses_ai_for_semantic_duplicate_detection()
    {
        // Setup mock to return a semantic duplicate
        $this->mockAIService->shouldReceive('detectSemanticDuplicates')
            ->once()
            ->andReturn([
                'duplicates' => [
                    [
                        'id1' => 'semantic-node-1',
                        'id2' => 'semantic-node-2',
                        'confidence' => 0.85,
                        'reason' => 'Names appear to be variations of the same person',
                    ],
                ],
            ]);

        // Re-create service with updated mock
        $this->service = new SuggestionAnalysisService($this->plugin, $this->mockAIService);

        InvestigationNode::create([
            'record_id' => 'semantic-node-1',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'person-jon-doe',
            'partition_id' => $this->partition->record_id,
            'label_override' => 'Jon Doe',
            'x' => 100,
            'y' => 100,
        ]);

        InvestigationNode::create([
            'record_id' => 'semantic-node-2',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'person-john-doe',
            'partition_id' => $this->partition->record_id,
            'label_override' => 'John Doe',
            'x' => 300,
            'y' => 100,
        ]);

        $result = $this->service->analyze($this->investigation, $this->user);

        $this->assertEquals(1, $result['summary']['semanticDuplicates']);

        $suggestion = $result['suggestions'][0];
        $this->assertEquals('semantic_duplicate', $suggestion['type']);
        $this->assertEquals(0.85, $suggestion['confidence']);
        $this->assertStringContainsString('variations', $suggestion['reason']);
    }

    /** @test */
    public function it_uses_ai_for_connection_suggestions()
    {
        // Setup mock to return a suggested connection
        $this->mockAIService->shouldReceive('suggestMissingConnections')
            ->once()
            ->andReturn([
                'suggestions' => [
                    [
                        'fromId' => 'ai-conn-node-1',
                        'toId' => 'ai-conn-node-2',
                        'type' => 'works_at',
                        'label' => 'Works At',
                        'confidence' => 0.75,
                        'reason' => 'Content mentions employment relationship',
                    ],
                ],
            ]);

        // Re-create service with updated mock
        $this->service = new SuggestionAnalysisService($this->plugin, $this->mockAIService);

        InvestigationNode::create([
            'record_id' => 'ai-conn-node-1',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'person-employee',
            'partition_id' => $this->partition->record_id,
            'label_override' => 'John Smith',
            'x' => 100,
            'y' => 100,
        ]);

        InvestigationNode::create([
            'record_id' => 'ai-conn-node-2',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'entity',
            'entity_id' => 'company-acme',
            'partition_id' => $this->partition->record_id,
            'label_override' => 'Acme Corp',
            'x' => 300,
            'y' => 100,
        ]);

        $result = $this->service->analyze($this->investigation, $this->user);

        $this->assertEquals(1, $result['summary']['aiConnections']);

        // Find the AI connection suggestion
        $aiSuggestion = null;
        foreach ($result['suggestions'] as $s) {
            if ($s['type'] === 'ai_connection') {
                $aiSuggestion = $s;
                break;
            }
        }

        $this->assertNotNull($aiSuggestion);
        $this->assertEquals('works_at', $aiSuggestion['relationshipType']);
        $this->assertEquals('Works At', $aiSuggestion['relationshipLabel']);
        $this->assertEquals(0.75, $aiSuggestion['confidence']);
    }

    /** @test */
    public function it_sorts_suggestions_by_confidence_descending()
    {
        // Setup mock to return both high and low confidence suggestions
        $this->mockAIService->shouldReceive('detectSemanticDuplicates')
            ->andReturn([
                'duplicates' => [
                    [
                        'id1' => 'sort-node-1',
                        'id2' => 'sort-node-2',
                        'confidence' => 0.95,
                        'reason' => 'High confidence duplicate',
                    ],
                ],
            ]);

        $this->mockAIService->shouldReceive('suggestMissingConnections')
            ->andReturn([
                'suggestions' => [
                    [
                        'fromId' => 'sort-node-1',
                        'toId' => 'sort-node-3',
                        'type' => 'knows',
                        'label' => 'Knows',
                        'confidence' => 0.5,
                        'reason' => 'Low confidence connection',
                    ],
                ],
            ]);

        $this->service = new SuggestionAnalysisService($this->plugin, $this->mockAIService);

        InvestigationNode::create([
            'record_id' => 'sort-node-1',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'sort-person-1',
            'partition_id' => $this->partition->record_id,
            'x' => 100,
            'y' => 100,
        ]);

        InvestigationNode::create([
            'record_id' => 'sort-node-2',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'sort-person-2',
            'partition_id' => $this->partition->record_id,
            'x' => 200,
            'y' => 100,
        ]);

        InvestigationNode::create([
            'record_id' => 'sort-node-3',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'sort-person-3',
            'partition_id' => $this->partition->record_id,
            'x' => 300,
            'y' => 100,
        ]);

        $result = $this->service->analyze($this->investigation, $this->user);

        // Should have at least 2 suggestions
        $this->assertGreaterThanOrEqual(2, count($result['suggestions']));

        // First suggestion should have highest confidence (0.95 for semantic duplicate)
        $this->assertEquals(0.95, $result['suggestions'][0]['confidence']);

        // Last suggestion should have lowest confidence (0.5 for AI connection)
        $lastIndex = count($result['suggestions']) - 1;
        $this->assertEquals(0.5, $result['suggestions'][$lastIndex]['confidence']);
    }

    /**
     * Helper method to call protected methods for testing.
     */
    protected function callProtectedMethod($object, $method, array $args = [])
    {
        $reflection = new \ReflectionClass(get_class($object));
        $method = $reflection->getMethod($method);
        $method->setAccessible(true);

        return $method->invokeArgs($object, $args);
    }
}
