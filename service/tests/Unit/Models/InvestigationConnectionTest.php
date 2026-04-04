<?php

namespace Tests\Unit\Models;

use NewSolari\Core\Identity\Models\IdentityPartition;
use NewSolari\Core\Identity\Models\IdentityUser;
use NewSolari\Investigations\Models\Investigation;
use NewSolari\Investigations\Models\InvestigationConnection;
use NewSolari\Investigations\Models\InvestigationNode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvestigationConnectionTest extends TestCase
{
    use RefreshDatabase;

    protected $partition;
    protected $user;
    protected $investigation;
    protected $node1;
    protected $node2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->partition = IdentityPartition::create([
            'record_id' => 'connection-test-partition',
            'name' => 'Connection Test Partition',
            'description' => 'Test partition for investigation connection tests',
        ]);

        $this->user = IdentityUser::create([
            'record_id' => 'connection-test-user',
            'username' => 'connectiontestuser',
            'email' => 'connectiontest@example.com',
            'password_hash' => 'password',
            'partition_id' => $this->partition->record_id,
            'is_active' => true,
        ]);

        $this->investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Test Investigation for Connections', 'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
        ]);

        $this->node1 = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 100,
            'y' => 100,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->node2 = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'place',
            'entity_id' => (string) \Str::uuid(),
            'x' => 400,
            'y' => 100,
            'partition_id' => $this->partition->record_id,
        ]);
    }

    /** @test */
    public function it_can_create_a_connection()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'relationship_type' => 'located_at',
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertInstanceOf(InvestigationConnection::class, $connection);
        $this->assertEquals('located_at', $connection->relationship_type);
    }

    /** @test */
    public function it_auto_generates_uuid()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertNotEmpty($connection->record_id);
        $this->assertTrue(\Str::isUuid($connection->record_id));
    }

    /** @test */
    public function it_has_correct_line_style_constants()
    {
        $this->assertEquals('solid', InvestigationConnection::STYLE_SOLID);
        $this->assertEquals('dashed', InvestigationConnection::STYLE_DASHED);
        $this->assertEquals('dotted', InvestigationConnection::STYLE_DOTTED);
    }

    /** @test */
    public function it_has_correct_path_type_constants()
    {
        $this->assertEquals('curved', InvestigationConnection::PATH_CURVED);
        $this->assertEquals('straight', InvestigationConnection::PATH_STRAIGHT);
        $this->assertEquals('orthogonal', InvestigationConnection::PATH_ORTHOGONAL);
    }

    /** @test */
    public function it_has_correct_arrow_type_constants()
    {
        $this->assertEquals('none', InvestigationConnection::ARROW_NONE);
        $this->assertEquals('forward', InvestigationConnection::ARROW_FORWARD);
        $this->assertEquals('backward', InvestigationConnection::ARROW_BACKWARD);
        $this->assertEquals('both', InvestigationConnection::ARROW_BOTH);
    }

    /** @test */
    public function it_has_predefined_relationship_types()
    {
        $types = InvestigationConnection::RELATIONSHIP_TYPES;

        $this->assertIsArray($types);
        $this->assertArrayHasKey('suspects', $types);
        $this->assertArrayHasKey('witnessed', $types);
        $this->assertArrayHasKey('owns', $types);
        $this->assertArrayHasKey('located_at', $types);
        $this->assertArrayHasKey('works_at', $types);
        $this->assertArrayHasKey('related_to', $types);
        $this->assertArrayHasKey('contacted', $types);
        $this->assertArrayHasKey('met_with', $types);
        $this->assertArrayHasKey('employed_by', $types);
        $this->assertArrayHasKey('associated_with', $types);
        $this->assertArrayHasKey('leads_to', $types);
        $this->assertArrayHasKey('caused_by', $types);
        $this->assertArrayHasKey('evidence_of', $types);
        $this->assertArrayHasKey('contradicts', $types);
        $this->assertArrayHasKey('supports', $types);
        $this->assertArrayHasKey('custom', $types);
    }

    /** @test */
    public function it_returns_correct_stroke_dash_array_for_solid()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'style' => InvestigationConnection::STYLE_SOLID,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals('none', $connection->stroke_dash_array);
    }

    /** @test */
    public function it_returns_correct_stroke_dash_array_for_dashed()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'style' => InvestigationConnection::STYLE_DASHED,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals('8,4', $connection->stroke_dash_array);
    }

    /** @test */
    public function it_returns_correct_stroke_dash_array_for_dotted()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'style' => InvestigationConnection::STYLE_DOTTED,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals('2,4', $connection->stroke_dash_array);
    }

    /** @test */
    public function it_detects_source_arrow_correctly()
    {
        $connectionBackward = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'arrow_type' => InvestigationConnection::ARROW_BACKWARD,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertTrue($connectionBackward->hasSourceArrow());
        $this->assertFalse($connectionBackward->hasTargetArrow());

        $connectionBoth = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node2->record_id,
            'to_node_id' => $this->node1->record_id,
            'arrow_type' => InvestigationConnection::ARROW_BOTH,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertTrue($connectionBoth->hasSourceArrow());
        $this->assertTrue($connectionBoth->hasTargetArrow());
    }

    /** @test */
    public function it_detects_target_arrow_correctly()
    {
        $connectionForward = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'arrow_type' => InvestigationConnection::ARROW_FORWARD,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertFalse($connectionForward->hasSourceArrow());
        $this->assertTrue($connectionForward->hasTargetArrow());

        $connectionNone = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node2->record_id,
            'to_node_id' => $this->node1->record_id,
            'arrow_type' => InvestigationConnection::ARROW_NONE,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertFalse($connectionNone->hasSourceArrow());
        $this->assertFalse($connectionNone->hasTargetArrow());
    }

    /** @test */
    public function it_returns_visual_properties()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'style' => InvestigationConnection::STYLE_DASHED,
            'path_type' => InvestigationConnection::PATH_CURVED,
            'color' => '#ff0000',
            'thickness' => 3.0,
            'arrow_type' => InvestigationConnection::ARROW_FORWARD,
            'partition_id' => $this->partition->record_id,
        ]);

        $visuals = $connection->visual_properties;

        $this->assertIsArray($visuals);
        $this->assertEquals('dashed', $visuals['style']);
        $this->assertEquals('curved', $visuals['pathType']);
        $this->assertEquals('#ff0000', $visuals['color']);
        $this->assertEquals(3.0, $visuals['thickness']);
        $this->assertEquals('forward', $visuals['arrowType']);
        $this->assertEquals('8,4', $visuals['strokeDashArray']);
        $this->assertFalse($visuals['hasSourceArrow']);
        $this->assertTrue($visuals['hasTargetArrow']);
    }

    /** @test */
    public function it_returns_default_visual_properties()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'partition_id' => $this->partition->record_id,
        ]);

        $visuals = $connection->visual_properties;

        $this->assertEquals('solid', $visuals['style']);
        $this->assertEquals('curved', $visuals['pathType']);
        $this->assertEquals('#6b7280', $visuals['color']);
        $this->assertEquals(2.0, $visuals['thickness']);
        $this->assertEquals('forward', $visuals['arrowType']);
    }

    /** @test */
    public function it_returns_relationship_properties()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'relationship_type' => 'located_at',
            'weight' => 8,
            'notes' => 'Some important notes',
            'partition_id' => $this->partition->record_id,
        ]);

        $props = $connection->relationship_properties;

        $this->assertIsArray($props);
        $this->assertEquals('located_at', $props['type']);
        $this->assertEquals('Located At', $props['label']);
        $this->assertEquals(8, $props['weight']);
        $this->assertEquals('high', $props['confidence']);
        $this->assertEquals('Some important notes', $props['notes']);
    }

    /** @test */
    public function it_uses_custom_relationship_label()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'relationship_type' => 'custom',
            'relationship_label' => 'My Custom Relationship',
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals('My Custom Relationship', $connection->display_label);
    }

    /** @test */
    public function it_falls_back_to_relationship_type_label()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'relationship_type' => 'suspects',
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals('Suspects', $connection->display_label);
    }

    /** @test */
    public function it_calculates_confidence_level_correctly()
    {
        $lowConfidence = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'weight' => 2,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals('low', $lowConfidence->confidence_level);

        $mediumConfidence = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node2->record_id,
            'to_node_id' => $this->node1->record_id,
            'weight' => 5,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals('medium', $mediumConfidence->confidence_level);
    }

    /** @test */
    public function it_calculates_high_confidence_level()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'weight' => 9,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals('high', $connection->confidence_level);
    }

    /** @test */
    public function it_checks_if_connection_involves_node()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertTrue($connection->involvesNode($this->node1->record_id));
        $this->assertTrue($connection->involvesNode($this->node2->record_id));
        $this->assertFalse($connection->involvesNode('non-existent-id'));
    }

    /** @test */
    public function it_gets_other_node_id()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals($this->node2->record_id, $connection->getOtherNodeId($this->node1->record_id));
        $this->assertEquals($this->node1->record_id, $connection->getOtherNodeId($this->node2->record_id));
        $this->assertNull($connection->getOtherNodeId('non-existent-id'));
    }

    /** @test */
    public function it_has_investigation_relationship()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertInstanceOf(Investigation::class, $connection->investigation);
        $this->assertEquals($this->investigation->record_id, $connection->investigation->record_id);
    }

    /** @test */
    public function it_has_from_node_relationship()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertInstanceOf(InvestigationNode::class, $connection->fromNode);
        $this->assertEquals($this->node1->record_id, $connection->fromNode->record_id);
    }

    /** @test */
    public function it_has_to_node_relationship()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertInstanceOf(InvestigationNode::class, $connection->toNode);
        $this->assertEquals($this->node2->record_id, $connection->toNode->record_id);
    }

    /** @test */
    public function it_stores_notes()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'notes' => 'Important connection details',
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals('Important connection details', $connection->notes);
    }

    /** @test */
    public function it_casts_thickness_correctly()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'thickness' => 2.5,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals(2.5, (float) $connection->thickness);
    }

    /** @test */
    public function it_has_correct_anchor_constants()
    {
        $this->assertEquals('top', InvestigationConnection::ANCHOR_TOP);
        $this->assertEquals('top-right', InvestigationConnection::ANCHOR_TOP_RIGHT);
        $this->assertEquals('right', InvestigationConnection::ANCHOR_RIGHT);
        $this->assertEquals('bottom-right', InvestigationConnection::ANCHOR_BOTTOM_RIGHT);
        $this->assertEquals('bottom', InvestigationConnection::ANCHOR_BOTTOM);
        $this->assertEquals('bottom-left', InvestigationConnection::ANCHOR_BOTTOM_LEFT);
        $this->assertEquals('left', InvestigationConnection::ANCHOR_LEFT);
        $this->assertEquals('top-left', InvestigationConnection::ANCHOR_TOP_LEFT);
    }

    /** @test */
    public function it_has_all_valid_anchors()
    {
        $this->assertCount(8, InvestigationConnection::VALID_ANCHORS);
        $this->assertContains('top', InvestigationConnection::VALID_ANCHORS);
        $this->assertContains('top-right', InvestigationConnection::VALID_ANCHORS);
        $this->assertContains('right', InvestigationConnection::VALID_ANCHORS);
        $this->assertContains('bottom-right', InvestigationConnection::VALID_ANCHORS);
        $this->assertContains('bottom', InvestigationConnection::VALID_ANCHORS);
        $this->assertContains('bottom-left', InvestigationConnection::VALID_ANCHORS);
        $this->assertContains('left', InvestigationConnection::VALID_ANCHORS);
        $this->assertContains('top-left', InvestigationConnection::VALID_ANCHORS);
    }

    /** @test */
    public function it_stores_anchor_positions()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'from_side' => InvestigationConnection::ANCHOR_RIGHT,
            'to_side' => InvestigationConnection::ANCHOR_LEFT,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals('right', $connection->from_side);
        $this->assertEquals('left', $connection->to_side);
    }

    /** @test */
    public function it_includes_anchor_positions_in_visual_properties()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'from_side' => InvestigationConnection::ANCHOR_BOTTOM,
            'to_side' => InvestigationConnection::ANCHOR_TOP,
            'partition_id' => $this->partition->record_id,
        ]);

        $visuals = $connection->visual_properties;

        $this->assertArrayHasKey('fromSide', $visuals);
        $this->assertArrayHasKey('toSide', $visuals);
        $this->assertEquals('bottom', $visuals['fromSide']);
        $this->assertEquals('top', $visuals['toSide']);
    }

    /** @test */
    public function it_uses_default_anchor_positions()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'partition_id' => $this->partition->record_id,
        ]);

        $visuals = $connection->visual_properties;

        // Default anchors should be right -> left
        $this->assertEquals('right', $visuals['fromSide']);
        $this->assertEquals('left', $visuals['toSide']);
    }

    /** @test */
    public function it_has_correct_sentiment_constants()
    {
        $this->assertEquals('neutral', InvestigationConnection::SENTIMENT_NEUTRAL);
        $this->assertEquals('positive', InvestigationConnection::SENTIMENT_POSITIVE);
        $this->assertEquals('negative', InvestigationConnection::SENTIMENT_NEGATIVE);
    }

    /** @test */
    public function it_has_sentiment_color_mapping()
    {
        $colors = InvestigationConnection::SENTIMENT_COLORS;

        $this->assertArrayHasKey('neutral', $colors);
        $this->assertArrayHasKey('positive', $colors);
        $this->assertArrayHasKey('negative', $colors);

        $this->assertEquals('#6b7280', $colors['neutral']);
        $this->assertEquals('#22c55e', $colors['positive']);
        $this->assertEquals('#ef4444', $colors['negative']);
    }

    /** @test */
    public function it_stores_sentiment()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'sentiment' => InvestigationConnection::SENTIMENT_POSITIVE,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals('positive', $connection->sentiment);
    }

    /** @test */
    public function it_includes_sentiment_in_visual_properties()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'sentiment' => InvestigationConnection::SENTIMENT_NEGATIVE,
            'partition_id' => $this->partition->record_id,
        ]);

        $visuals = $connection->visual_properties;

        $this->assertArrayHasKey('sentiment', $visuals);
        $this->assertArrayHasKey('sentimentColor', $visuals);
        $this->assertEquals('negative', $visuals['sentiment']);
        $this->assertEquals('#ef4444', $visuals['sentimentColor']);
    }

    /** @test */
    public function it_uses_neutral_sentiment_by_default()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'partition_id' => $this->partition->record_id,
        ]);

        $visuals = $connection->visual_properties;

        $this->assertEquals('neutral', $visuals['sentiment']);
        $this->assertEquals('#6b7280', $visuals['sentimentColor']);
    }

    /** @test */
    public function it_includes_sentiment_in_relationship_properties()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'sentiment' => InvestigationConnection::SENTIMENT_POSITIVE,
            'partition_id' => $this->partition->record_id,
        ]);

        $props = $connection->relationship_properties;

        $this->assertArrayHasKey('sentiment', $props);
        $this->assertEquals('positive', $props['sentiment']);
    }

    /** @test */
    public function it_can_soft_delete()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'partition_id' => $this->partition->record_id,
        ]);

        $recordId = $connection->record_id;
        $connection->delete();

        // Should not be found normally
        $this->assertNull(InvestigationConnection::find($recordId));

        // Should be found with withDeleted scope
        $trashedConnection = InvestigationConnection::withDeleted()->find($recordId);
        $this->assertNotNull($trashedConnection);
        $this->assertTrue($trashedConnection->deleted);
    }

    /** @test */
    public function it_tracks_deleted_by()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->node1->record_id,
            'to_node_id' => $this->node2->record_id,
            'partition_id' => $this->partition->record_id,
        ]);

        $connection->deleted_by = $this->user->record_id;
        $connection->delete();

        $trashedConnection = InvestigationConnection::withDeleted()->find($connection->record_id);
        $this->assertEquals($this->user->record_id, $trashedConnection->deleted_by);
    }
}
