<?php

namespace Tests\Unit\Services;

use NewSolari\Core\Identity\Models\IdentityPartition;
use NewSolari\Core\Identity\Models\IdentityUser;
use NewSolari\Investigations\InvestigationsPlugin;
use NewSolari\Investigations\Models\Investigation;
use NewSolari\Investigations\Models\InvestigationConnection;
use NewSolari\Investigations\Models\InvestigationNode;
use NewSolari\Investigations\Services\RelationshipDetectionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RelationshipDetectionServiceTest extends TestCase
{
    use RefreshDatabase;

    protected RelationshipDetectionService $service;
    protected InvestigationsPlugin $plugin;
    protected $partition;
    protected $user;
    protected $investigation;

    protected function setUp(): void
    {
        parent::setUp();

        $this->plugin = new InvestigationsPlugin();
        $this->service = new RelationshipDetectionService($this->plugin);

        $this->partition = IdentityPartition::create([
            'record_id' => 'rel-detect-test-partition',
            'name' => 'Relationship Detection Test Partition',
            'description' => 'Test partition for relationship detection service tests',
        ]);

        $this->user = IdentityUser::create([
            'record_id' => 'rel-detect-test-user',
            'username' => 'reldetecttestuser',
            'email' => 'reldetecttest@example.com',
            'password_hash' => 'password',
            'partition_id' => $this->partition->record_id,
            'is_active' => true,
        ]);
        $this->user->setSystemUser(true);

        $this->investigation = Investigation::create([
            'record_id' => 'rel-detect-test-investigation',
            'title' => 'Relationship Detection Test Investigation',
            'case_number' => 'CASE-RELDETECT-001',
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
            'is_public' => true,
        ]);
    }

    /** @test */
    public function it_returns_empty_relationships_for_investigation_without_nodes()
    {
        $relationships = $this->service->discoverCanvasRelationships($this->investigation, $this->user);

        $this->assertIsArray($relationships);
        $this->assertEmpty($relationships);
    }

    /** @test */
    public function it_suggests_connections_based_on_shared_tags()
    {
        $nodes = [
            [
                'record_id' => 'node1',
                'entity_type' => 'person',
                'entity_id' => 'person-1',
                'tags' => ['suspect', 'interviewed'],
            ],
            [
                'record_id' => 'node2',
                'entity_type' => 'person',
                'entity_id' => 'person-2',
                'tags' => ['suspect', 'unknown'],
            ],
            [
                'record_id' => 'node3',
                'entity_type' => 'person',
                'entity_id' => 'person-3',
                'tags' => ['witness'],
            ],
        ];

        $suggestions = $this->callProtectedMethod($this->service, 'suggestBySharedTags', [$nodes]);

        $this->assertIsArray($suggestions);
        // node1 and node2 share 'suspect' tag
        $this->assertNotEmpty($suggestions);

        $found = false;
        foreach ($suggestions as $suggestion) {
            if (
                ($suggestion['from_node_id'] === 'node1' && $suggestion['to_node_id'] === 'node2') ||
                ($suggestion['from_node_id'] === 'node2' && $suggestion['to_node_id'] === 'node1')
            ) {
                $found = true;
                $this->assertEquals('shared_tag', $suggestion['reason']);
                $this->assertEquals('suspect', $suggestion['tag']);
                break;
            }
        }

        $this->assertTrue($found, 'Should find suggestion for nodes with shared tag');
    }

    /** @test */
    public function it_does_not_suggest_connections_for_nodes_without_shared_tags()
    {
        $nodes = [
            [
                'record_id' => 'node1',
                'entity_type' => 'person',
                'entity_id' => 'person-1',
                'tags' => ['tag-a'],
            ],
            [
                'record_id' => 'node2',
                'entity_type' => 'person',
                'entity_id' => 'person-2',
                'tags' => ['tag-b'],
            ],
        ];

        $suggestions = $this->callProtectedMethod($this->service, 'suggestBySharedTags', [$nodes]);

        $this->assertEmpty($suggestions);
    }

    /** @test */
    public function it_handles_nodes_without_tags()
    {
        $nodes = [
            [
                'record_id' => 'node1',
                'entity_type' => 'person',
                'entity_id' => 'person-1',
            ],
            [
                'record_id' => 'node2',
                'entity_type' => 'person',
                'entity_id' => 'person-2',
                'tags' => ['tag-a'],
            ],
        ];

        $suggestions = $this->callProtectedMethod($this->service, 'suggestBySharedTags', [$nodes]);

        $this->assertIsArray($suggestions);
        $this->assertEmpty($suggestions);
    }

    /** @test */
    public function it_handles_nodes_with_non_array_tags()
    {
        $nodes = [
            [
                'record_id' => 'node1',
                'entity_type' => 'person',
                'entity_id' => 'person-1',
                'tags' => 'not-an-array',
            ],
            [
                'record_id' => 'node2',
                'entity_type' => 'person',
                'entity_id' => 'person-2',
                'tags' => ['tag-a'],
            ],
        ];

        $suggestions = $this->callProtectedMethod($this->service, 'suggestBySharedTags', [$nodes]);

        $this->assertIsArray($suggestions);
        // Should not crash, just skip invalid tags
    }

    /** @test */
    public function it_normalizes_tag_case_for_comparison()
    {
        $nodes = [
            [
                'record_id' => 'node1',
                'entity_type' => 'person',
                'entity_id' => 'person-1',
                'tags' => ['Suspect'],
            ],
            [
                'record_id' => 'node2',
                'entity_type' => 'person',
                'entity_id' => 'person-2',
                'tags' => ['SUSPECT'],
            ],
        ];

        $suggestions = $this->callProtectedMethod($this->service, 'suggestBySharedTags', [$nodes]);

        $this->assertNotEmpty($suggestions);
        $this->assertEquals('suspect', $suggestions[0]['tag']);
    }

    /** @test */
    public function it_auto_creates_connections_for_relationships()
    {
        // Create nodes
        $node1 = InvestigationNode::create([
            'record_id' => 'auto-node-1',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'person-auto-1',
            'partition_id' => $this->partition->record_id,
            'x' => 100,
            'y' => 100,
        ]);

        $node2 = InvestigationNode::create([
            'record_id' => 'auto-node-2',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'person-auto-2',
            'partition_id' => $this->partition->record_id,
            'x' => 300,
            'y' => 100,
        ]);

        $relationships = [
            [
                'from_node_id' => $node1->record_id,
                'to_node_id' => $node2->record_id,
                'relationship_type' => 'knows',
                'relationship_label' => 'Knows',
            ],
        ];

        $created = $this->service->autoCreateConnections($this->investigation, $relationships);

        $this->assertCount(1, $created);
        $this->assertEquals('knows', $created[0]['relationship_type']);
        $this->assertEquals('Knows', $created[0]['relationship_label']);

        // Verify connection was actually created
        $connection = InvestigationConnection::where('investigation_id', $this->investigation->record_id)
            ->where('from_node_id', $node1->record_id)
            ->where('to_node_id', $node2->record_id)
            ->first();

        $this->assertNotNull($connection);
    }

    /** @test */
    public function it_skips_existing_connections_when_auto_creating()
    {
        // Create nodes
        $node1 = InvestigationNode::create([
            'record_id' => 'skip-node-1',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'person-skip-1',
            'partition_id' => $this->partition->record_id,
            'x' => 100,
            'y' => 100,
        ]);

        $node2 = InvestigationNode::create([
            'record_id' => 'skip-node-2',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'person-skip-2',
            'partition_id' => $this->partition->record_id,
            'x' => 300,
            'y' => 100,
        ]);

        // Create existing connection
        InvestigationConnection::create([
            'record_id' => 'existing-conn-1',
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $node1->record_id,
            'to_node_id' => $node2->record_id,
            'relationship_type' => 'existing',
            'partition_id' => $this->partition->record_id,
        ]);

        $relationships = [
            [
                'from_node_id' => $node1->record_id,
                'to_node_id' => $node2->record_id,
                'relationship_type' => 'new_type',
                'relationship_label' => 'New Type',
            ],
        ];

        $created = $this->service->autoCreateConnections($this->investigation, $relationships);

        $this->assertEmpty($created);
    }

    /** @test */
    public function it_skips_existing_connections_regardless_of_direction()
    {
        // Create nodes
        $node1 = InvestigationNode::create([
            'record_id' => 'dir-node-1',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'person-dir-1',
            'partition_id' => $this->partition->record_id,
            'x' => 100,
            'y' => 100,
        ]);

        $node2 = InvestigationNode::create([
            'record_id' => 'dir-node-2',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'person-dir-2',
            'partition_id' => $this->partition->record_id,
            'x' => 300,
            'y' => 100,
        ]);

        // Create existing connection in one direction
        InvestigationConnection::create([
            'record_id' => 'existing-dir-conn',
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $node1->record_id,
            'to_node_id' => $node2->record_id,
            'relationship_type' => 'existing',
            'partition_id' => $this->partition->record_id,
        ]);

        // Try to create in reverse direction
        $relationships = [
            [
                'from_node_id' => $node2->record_id,
                'to_node_id' => $node1->record_id,
                'relationship_type' => 'reverse',
                'relationship_label' => 'Reverse',
            ],
        ];

        $created = $this->service->autoCreateConnections($this->investigation, $relationships);

        $this->assertEmpty($created);
    }

    /** @test */
    public function it_uses_default_relationship_type_when_not_specified()
    {
        // Create nodes
        $node1 = InvestigationNode::create([
            'record_id' => 'default-node-1',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'person-default-1',
            'partition_id' => $this->partition->record_id,
            'x' => 100,
            'y' => 100,
        ]);

        $node2 = InvestigationNode::create([
            'record_id' => 'default-node-2',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'person-default-2',
            'partition_id' => $this->partition->record_id,
            'x' => 300,
            'y' => 100,
        ]);

        $relationships = [
            [
                'from_node_id' => $node1->record_id,
                'to_node_id' => $node2->record_id,
                // No relationship_type or relationship_label
            ],
        ];

        $created = $this->service->autoCreateConnections($this->investigation, $relationships);

        $this->assertCount(1, $created);
        $this->assertEquals('related', $created[0]['relationship_type']);
        $this->assertEquals('Related', $created[0]['relationship_label']);
    }

    /** @test */
    public function it_gets_relationship_statistics()
    {
        // Create nodes
        $node1 = InvestigationNode::create([
            'record_id' => 'stats-node-1',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'person-stats-1',
            'partition_id' => $this->partition->record_id,
            'x' => 100,
            'y' => 100,
        ]);

        $node2 = InvestigationNode::create([
            'record_id' => 'stats-node-2',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'person-stats-2',
            'partition_id' => $this->partition->record_id,
            'x' => 300,
            'y' => 100,
        ]);

        $node3 = InvestigationNode::create([
            'record_id' => 'stats-node-3',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => 'person-stats-3',
            'partition_id' => $this->partition->record_id,
            'x' => 500,
            'y' => 100,
        ]);

        // Create connections
        InvestigationConnection::create([
            'record_id' => 'stats-conn-1',
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $node1->record_id,
            'to_node_id' => $node2->record_id,
            'relationship_type' => 'knows',
            'sentiment' => 'positive',
            'partition_id' => $this->partition->record_id,
        ]);

        InvestigationConnection::create([
            'record_id' => 'stats-conn-2',
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $node2->record_id,
            'to_node_id' => $node3->record_id,
            'relationship_type' => 'knows',
            'sentiment' => 'negative',
            'partition_id' => $this->partition->record_id,
        ]);

        InvestigationConnection::create([
            'record_id' => 'stats-conn-3',
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $node1->record_id,
            'to_node_id' => $node3->record_id,
            'relationship_type' => 'suspects',
            'sentiment' => 'neutral',
            'partition_id' => $this->partition->record_id,
        ]);

        // Reload investigation with connections
        $this->investigation->load('connections');

        $stats = $this->service->getRelationshipStats($this->investigation);

        $this->assertArrayHasKey('total_connections', $stats);
        $this->assertArrayHasKey('by_type', $stats);
        $this->assertArrayHasKey('by_sentiment', $stats);

        $this->assertEquals(3, $stats['total_connections']);
        $this->assertEquals(2, $stats['by_type']['knows']);
        $this->assertEquals(1, $stats['by_type']['suspects']);
        $this->assertEquals(1, $stats['by_sentiment']['positive']);
        $this->assertEquals(1, $stats['by_sentiment']['negative']);
        $this->assertEquals(1, $stats['by_sentiment']['neutral']);
    }

    /** @test */
    public function it_returns_empty_stats_for_investigation_without_connections()
    {
        $this->investigation->load('connections');
        $stats = $this->service->getRelationshipStats($this->investigation);

        $this->assertEquals(0, $stats['total_connections']);
        $this->assertEmpty($stats['by_type']);
        $this->assertEmpty($stats['by_sentiment']);
    }

    /**
     * Helper method to call protected suggestBySharedTags.
     */
    protected function callProtectedMethod($object, $method, array $args = [])
    {
        $reflection = new \ReflectionClass(get_class($object));
        $method = $reflection->getMethod($method);
        $method->setAccessible(true);
        return $method->invokeArgs($object, $args);
    }
}
