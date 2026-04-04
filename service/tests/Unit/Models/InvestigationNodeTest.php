<?php

namespace Tests\Unit\Models;

use NewSolari\Core\Identity\Models\IdentityPartition;
use NewSolari\Core\Identity\Models\IdentityUser;
use NewSolari\Investigations\Models\Investigation;
use NewSolari\Investigations\Models\InvestigationConnection;
use NewSolari\Investigations\Models\InvestigationNode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvestigationNodeTest extends TestCase
{
    use RefreshDatabase;

    protected $partition;
    protected $user;
    protected $investigation;

    protected function setUp(): void
    {
        parent::setUp();

        $this->partition = IdentityPartition::create([
            'record_id' => 'node-test-partition',
            'name' => 'Node Test Partition',
            'description' => 'Test partition for investigation node tests',
        ]);

        $this->user = IdentityUser::create([
            'record_id' => 'node-test-user',
            'username' => 'nodetestuser',
            'email' => 'nodetest@example.com',
            'password_hash' => 'password',
            'partition_id' => $this->partition->record_id,
            'is_active' => true,
        ]);

        $this->investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Test Investigation for Nodes', 'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
        ]);
    }

    /** @test */
    public function it_can_create_a_node()
    {
        $entityId = (string) \Str::uuid();

        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => $entityId,
            'x' => 100.5,
            'y' => 200.75,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertInstanceOf(InvestigationNode::class, $node);
        $this->assertEquals('person', $node->entity_type);
        $this->assertEquals($entityId, $node->entity_id);
        $this->assertEquals(100.5, (float) $node->x);
        $this->assertEquals(200.75, (float) $node->y);
    }

    /** @test */
    public function it_auto_generates_uuid()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 0,
            'y' => 0,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertNotEmpty($node->record_id);
        $this->assertTrue(\Str::isUuid($node->record_id));
    }

    /** @test */
    public function it_sets_default_dimensions_for_person()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 0,
            'y' => 0,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals(180, (int) $node->width);
        $this->assertEquals(80, (int) $node->height);
    }

    /** @test */
    public function it_sets_default_dimensions_for_event()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'event',
            'entity_id' => (string) \Str::uuid(),
            'x' => 0,
            'y' => 0,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals(200, (int) $node->width);
        $this->assertEquals(100, (int) $node->height);
    }

    /** @test */
    public function it_sets_default_dimensions_for_note()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'note',
            'entity_id' => (string) \Str::uuid(),
            'x' => 0,
            'y' => 0,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals(160, (int) $node->width);
        $this->assertEquals(120, (int) $node->height);
    }

    /** @test */
    public function it_uses_default_dimensions_for_unknown_entity_type()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'unknown_type',
            'entity_id' => (string) \Str::uuid(),
            'x' => 0,
            'y' => 0,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals(180, (int) $node->width);
        $this->assertEquals(80, (int) $node->height);
    }

    /** @test */
    public function it_respects_custom_dimensions()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 0,
            'y' => 0,
            'width' => 300,
            'height' => 150,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals(300, (int) $node->width);
        $this->assertEquals(150, (int) $node->height);
    }

    /** @test */
    public function it_calculates_center_position()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 100,
            'y' => 200,
            'width' => 200,
            'height' => 100,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals(200, $node->center_x); // 100 + (200/2)
        $this->assertEquals(250, $node->center_y); // 200 + (100/2)
    }

    /** @test */
    public function it_returns_bounds()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 100,
            'y' => 200,
            'width' => 200,
            'height' => 100,
            'partition_id' => $this->partition->record_id,
        ]);

        $bounds = $node->bounds;

        $this->assertIsArray($bounds);
        $this->assertEquals(100, $bounds['left']);
        $this->assertEquals(200, $bounds['top']);
        $this->assertEquals(300, $bounds['right']); // 100 + 200
        $this->assertEquals(300, $bounds['bottom']); // 200 + 100
        $this->assertEquals(200, $bounds['width']);
        $this->assertEquals(100, $bounds['height']);
    }

    /** @test */
    public function it_can_update_position()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 100,
            'y' => 200,
            'partition_id' => $this->partition->record_id,
        ]);

        $result = $node->updatePosition(500.5, 300.25, 10);

        $this->assertTrue($result);
        $node->refresh();
        $this->assertEquals(500.5, (float) $node->x);
        $this->assertEquals(300.25, (float) $node->y);
        $this->assertEquals(10, $node->z_index);
    }

    /** @test */
    public function it_can_update_position_without_z_index()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 100,
            'y' => 200,
            'z_index' => 5,
            'partition_id' => $this->partition->record_id,
        ]);

        $result = $node->updatePosition(500, 300);

        $this->assertTrue($result);
        $node->refresh();
        $this->assertEquals(500, (float) $node->x);
        $this->assertEquals(300, (float) $node->y);
        $this->assertEquals(5, $node->z_index); // Unchanged
    }

    /** @test */
    public function it_can_update_size()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 100,
            'y' => 200,
            'partition_id' => $this->partition->record_id,
        ]);

        $result = $node->updateSize(300.5, 150.25);

        $this->assertTrue($result);
        $node->refresh();
        $this->assertEquals(300.5, (float) $node->width);
        $this->assertEquals(150.25, (float) $node->height);
    }

    /** @test */
    public function it_has_investigation_relationship()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 0,
            'y' => 0,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertInstanceOf(Investigation::class, $node->investigation);
        $this->assertEquals($this->investigation->record_id, $node->investigation->record_id);
    }

    /** @test */
    public function it_returns_correct_entity_type_visuals_for_person()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 0,
            'y' => 0,
            'partition_id' => $this->partition->record_id,
        ]);

        $style = $node->effective_style;

        $this->assertEquals('#dbeafe', $style['backgroundColor']);
        $this->assertEquals('#3b82f6', $style['borderColor']);
        $this->assertEquals('#1e40af', $style['textColor']);
    }

    /** @test */
    public function it_returns_correct_entity_type_visuals_for_event()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'event',
            'entity_id' => (string) \Str::uuid(),
            'x' => 0,
            'y' => 0,
            'partition_id' => $this->partition->record_id,
        ]);

        $style = $node->effective_style;

        $this->assertEquals('#fee2e2', $style['backgroundColor']);
        $this->assertEquals('#ef4444', $style['borderColor']);
        $this->assertEquals('#991b1b', $style['textColor']);
    }

    /** @test */
    public function it_merges_custom_style_with_defaults()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 0,
            'y' => 0,
            'style' => ['backgroundColor' => '#ff0000', 'borderWidth' => 3],
            'partition_id' => $this->partition->record_id,
        ]);

        $style = $node->effective_style;

        // Custom override
        $this->assertEquals('#ff0000', $style['backgroundColor']);
        // Custom addition
        $this->assertEquals(3, $style['borderWidth']);
        // Default preserved
        $this->assertEquals('#3b82f6', $style['borderColor']);
    }

    /** @test */
    public function it_tracks_outgoing_connections()
    {
        $node1 = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 0,
            'y' => 0,
            'partition_id' => $this->partition->record_id,
        ]);

        $node2 = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'place',
            'entity_id' => (string) \Str::uuid(),
            'x' => 200,
            'y' => 0,
            'partition_id' => $this->partition->record_id,
        ]);

        InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $node1->record_id,
            'to_node_id' => $node2->record_id,
            'relationship_type' => 'located_at',
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertCount(1, $node1->outgoingConnections);
        $this->assertCount(0, $node1->incomingConnections);
    }

    /** @test */
    public function it_tracks_incoming_connections()
    {
        $node1 = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 0,
            'y' => 0,
            'partition_id' => $this->partition->record_id,
        ]);

        $node2 = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'place',
            'entity_id' => (string) \Str::uuid(),
            'x' => 200,
            'y' => 0,
            'partition_id' => $this->partition->record_id,
        ]);

        InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $node1->record_id,
            'to_node_id' => $node2->record_id,
            'relationship_type' => 'located_at',
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertCount(0, $node2->outgoingConnections);
        $this->assertCount(1, $node2->incomingConnections);
    }

    /** @test */
    public function it_uses_label_override_when_set()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 0,
            'y' => 0,
            'label_override' => 'Custom Label',
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals('Custom Label', $node->display_label);
    }

    /** @test */
    public function it_can_be_pinned()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 0,
            'y' => 0,
            'is_pinned' => true,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertTrue($node->is_pinned);
    }

    /** @test */
    public function it_can_be_collapsed()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 0,
            'y' => 0,
            'is_collapsed' => true,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertTrue($node->is_collapsed);
    }

    /** @test */
    public function it_stores_notes()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 0,
            'y' => 0,
            'notes' => 'Important notes about this node',
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals('Important notes about this node', $node->notes);
    }

    /** @test */
    public function it_has_all_expected_entity_type_defaults()
    {
        $expectedTypes = [
            'person', 'entity', 'place', 'event', 'note', 'task',
            'file', 'hypothesis', 'motive', 'blocknote', 'inventory_object',
        ];

        foreach ($expectedTypes as $type) {
            $this->assertArrayHasKey($type, InvestigationNode::DEFAULT_DIMENSIONS);
        }
    }

    /** @test */
    public function it_stores_and_retrieves_tags_as_array()
    {
        $tags = ['suspect', 'interviewed', 'key-witness'];

        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 0,
            'y' => 0,
            'tags' => $tags,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertIsArray($node->tags);
        $this->assertCount(3, $node->tags);
        $this->assertEquals($tags, $node->tags);
    }

    /** @test */
    public function it_handles_empty_tags_array()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 0,
            'y' => 0,
            'tags' => [],
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertIsArray($node->tags);
        $this->assertEmpty($node->tags);
    }

    /** @test */
    public function it_handles_null_tags()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 0,
            'y' => 0,
            'partition_id' => $this->partition->record_id,
        ]);

        // Tags should be null when not set
        $this->assertNull($node->tags);
    }

    /** @test */
    public function it_can_update_tags()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 0,
            'y' => 0,
            'tags' => ['initial-tag'],
            'partition_id' => $this->partition->record_id,
        ]);

        $node->tags = ['updated-tag', 'new-tag'];
        $node->save();
        $node->refresh();

        $this->assertCount(2, $node->tags);
        $this->assertContains('updated-tag', $node->tags);
        $this->assertContains('new-tag', $node->tags);
    }

    /** @test */
    public function it_can_soft_delete()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 0,
            'y' => 0,
            'partition_id' => $this->partition->record_id,
        ]);

        $recordId = $node->record_id;
        $node->delete();

        // Should not be found normally
        $this->assertNull(InvestigationNode::find($recordId));

        // Should be found with withDeleted scope
        $trashedNode = InvestigationNode::withDeleted()->find($recordId);
        $this->assertNotNull($trashedNode);
        $this->assertTrue($trashedNode->deleted);
    }

    /** @test */
    public function it_tracks_deleted_by()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 0,
            'y' => 0,
            'partition_id' => $this->partition->record_id,
        ]);

        $node->deleted_by = $this->user->record_id;
        $node->delete();

        $trashedNode = InvestigationNode::withDeleted()->find($node->record_id);
        $this->assertEquals($this->user->record_id, $trashedNode->deleted_by);
    }
}
