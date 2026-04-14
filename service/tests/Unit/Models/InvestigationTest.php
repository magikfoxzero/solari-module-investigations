<?php

namespace Tests\Unit\Models;

use NewSolari\Identity\Models\IdentityPartition;
use NewSolari\Identity\Models\IdentityUser;
use NewSolari\Investigations\Models\Investigation;
use NewSolari\Investigations\Models\InvestigationConnection;
use NewSolari\Investigations\Models\InvestigationNode;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvestigationTest extends TestCase
{
    use RefreshDatabase;

    protected $partition;
    protected $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->partition = IdentityPartition::create([
            'record_id' => 'investigation-test-partition',
            'name' => 'Investigation Test Partition',
            'description' => 'Test partition for investigation tests',
        ]);

        $this->user = IdentityUser::create([
            'record_id' => 'investigation-test-user',
            'username' => 'investigationtestuser',
            'email' => 'investigationtest@example.com',
            'password_hash' => 'password',
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'is_active' => true,
        ]);
    }

    /** @test */
    public function it_can_create_an_investigation()
    {
        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Test Investigation', 'case_number' => 'CASE-' . \Str::random(8),
            'description' => 'A test investigation',
            'status' => Investigation::STATUS_ACTIVE,
            'priority' => Investigation::PRIORITY_HIGH,
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
        ]);

        $this->assertInstanceOf(Investigation::class, $investigation);
        $this->assertEquals('Test Investigation', $investigation->title);
        $this->assertEquals(Investigation::STATUS_ACTIVE, $investigation->status);
        $this->assertEquals(Investigation::PRIORITY_HIGH, $investigation->priority);
    }

    /** @test */
    public function it_has_correct_status_constants()
    {
        $this->assertEquals('open', Investigation::STATUS_OPEN);
        $this->assertEquals('open', Investigation::STATUS_ACTIVE); // Alias
        $this->assertEquals('in_progress', Investigation::STATUS_IN_PROGRESS);
        $this->assertEquals('on_hold', Investigation::STATUS_ON_HOLD);
        $this->assertEquals('closed', Investigation::STATUS_CLOSED);
        $this->assertEquals('archived', Investigation::STATUS_ARCHIVED);
    }

    /** @test */
    public function it_has_correct_priority_constants()
    {
        $this->assertEquals('low', Investigation::PRIORITY_LOW);
        $this->assertEquals('medium', Investigation::PRIORITY_MEDIUM);
        $this->assertEquals('high', Investigation::PRIORITY_HIGH);
        $this->assertEquals('critical', Investigation::PRIORITY_CRITICAL);
    }

    /** @test */
    public function it_has_correct_layout_constants()
    {
        $this->assertEquals('freeform', Investigation::LAYOUT_FREEFORM);
        $this->assertEquals('grid', Investigation::LAYOUT_GRID);
        $this->assertEquals('timeline', Investigation::LAYOUT_TIMELINE);
        $this->assertEquals('hierarchical', Investigation::LAYOUT_HIERARCHICAL);
        $this->assertEquals('radial', Investigation::LAYOUT_RADIAL);
        $this->assertEquals('force-directed', Investigation::LAYOUT_FORCE);
    }

    /** @test */
    public function it_returns_correct_status_info()
    {
        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Test Investigation', 'case_number' => 'CASE-' . \Str::random(8),
            'status' => Investigation::STATUS_OPEN,
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
        ]);

        $statusInfo = $investigation->status_info;

        $this->assertIsArray($statusInfo);
        $this->assertEquals('search', $statusInfo['icon']);
        $this->assertEquals('green', $statusInfo['color']);
        $this->assertEquals('Open', $statusInfo['label']);
    }

    /** @test */
    public function it_returns_correct_priority_info()
    {
        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Test Investigation', 'case_number' => 'CASE-' . \Str::random(8),
            'priority' => Investigation::PRIORITY_CRITICAL,
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
        ]);

        $priorityInfo = $investigation->priority_info;

        $this->assertIsArray($priorityInfo);
        $this->assertEquals('alert-circle', $priorityInfo['icon']);
        $this->assertEquals('red', $priorityInfo['color']);
        $this->assertEquals('Critical', $priorityInfo['label']);
    }

    /** @test */
    public function it_can_store_and_retrieve_canvas_state()
    {
        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Canvas State Test',
            'canvas_state' => ['zoom' => 1.5, 'panX' => 100, 'panY' => -50],
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
        ]);

        $this->assertEquals(1.5, $investigation->canvas_zoom);
        $this->assertEquals(100, $investigation->canvas_pan_x);
        $this->assertEquals(-50, $investigation->canvas_pan_y);
    }

    /** @test */
    public function it_returns_default_canvas_values_when_not_set()
    {
        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'No Canvas State',
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
        ]);

        $this->assertEquals(1.0, $investigation->canvas_zoom);
        $this->assertEquals(0.0, $investigation->canvas_pan_x);
        $this->assertEquals(0.0, $investigation->canvas_pan_y);
    }

    /** @test */
    public function it_can_update_canvas_state()
    {
        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Update Canvas Test',
            'canvas_state' => ['zoom' => 1.0, 'panX' => 0, 'panY' => 0],
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
        ]);

        $result = $investigation->updateCanvasState(['zoom' => 2.0, 'panX' => 200]);

        $this->assertTrue($result);
        $investigation->refresh();
        $this->assertEquals(2.0, $investigation->canvas_zoom);
        $this->assertEquals(200, $investigation->canvas_pan_x);
        $this->assertEquals(0, $investigation->canvas_pan_y); // Preserved from original
    }

    /** @test */
    public function it_detects_overdue_investigations()
    {
        $overdueInvestigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Overdue Investigation',
            'status' => Investigation::STATUS_OPEN,
            'due_date' => Carbon::yesterday(),
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
        ]);

        $this->assertTrue($overdueInvestigation->is_overdue);

        // Closed investigation should not be overdue even with past due date
        $closedInvestigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Closed Investigation',
            'status' => Investigation::STATUS_CLOSED,
            'due_date' => Carbon::yesterday(),
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
        ]);

        $this->assertFalse($closedInvestigation->is_overdue);
    }

    /** @test */
    public function it_not_overdue_without_due_date()
    {
        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'No Due Date',
            'status' => Investigation::STATUS_OPEN,
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
        ]);

        $this->assertFalse($investigation->is_overdue);
    }

    /** @test */
    public function it_has_nodes_relationship()
    {
        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'With Nodes',
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
        ]);

        InvestigationNode::create([
            'record_id' => (string) \Str::uuid(),
            'investigation_id' => $investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 100,
            'y' => 200,
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
        ]);

        InvestigationNode::create([
            'record_id' => (string) \Str::uuid(),
            'investigation_id' => $investigation->record_id,
            'entity_type' => 'place',
            'entity_id' => (string) \Str::uuid(),
            'x' => 300,
            'y' => 200,
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals(2, $investigation->node_count);
        $this->assertCount(2, $investigation->nodes);
    }

    /** @test */
    public function it_can_check_if_entity_exists_on_canvas()
    {
        $entityId = (string) \Str::uuid();

        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Entity Check Test',
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
        ]);

        InvestigationNode::create([
            'record_id' => (string) \Str::uuid(),
            'investigation_id' => $investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => $entityId,
            'x' => 100,
            'y' => 100,
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertTrue($investigation->hasEntity('person', $entityId));
        $this->assertFalse($investigation->hasEntity('person', (string) \Str::uuid()));
        $this->assertFalse($investigation->hasEntity('place', $entityId));
    }

    /** @test */
    public function it_can_get_linked_entity_ids()
    {
        $entityId1 = (string) \Str::uuid();
        $entityId2 = (string) \Str::uuid();

        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Linked Entities Test',
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
        ]);

        InvestigationNode::create([
            'record_id' => (string) \Str::uuid(),
            'investigation_id' => $investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => $entityId1,
            'x' => 100,
            'y' => 100,
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
        ]);

        InvestigationNode::create([
            'record_id' => (string) \Str::uuid(),
            'investigation_id' => $investigation->record_id,
            'entity_type' => 'event',
            'entity_id' => $entityId2,
            'x' => 300,
            'y' => 100,
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
        ]);

        $linkedEntities = $investigation->getLinkedEntityIds();

        $this->assertCount(2, $linkedEntities);
        $this->assertContains(['type' => 'person', 'id' => $entityId1], $linkedEntities);
        $this->assertContains(['type' => 'event', 'id' => $entityId2], $linkedEntities);
    }

    /** @test */
    public function it_has_connections_relationship()
    {
        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'With Connections',
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
        ]);

        $node1 = InvestigationNode::create([
            'record_id' => (string) \Str::uuid(),
            'investigation_id' => $investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 100,
            'y' => 100,
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
        ]);

        $node2 = InvestigationNode::create([
            'record_id' => (string) \Str::uuid(),
            'investigation_id' => $investigation->record_id,
            'entity_type' => 'place',
            'entity_id' => (string) \Str::uuid(),
            'x' => 300,
            'y' => 100,
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
        ]);

        InvestigationConnection::create([
            'record_id' => (string) \Str::uuid(),
            'investigation_id' => $investigation->record_id,
            'from_node_id' => $node1->record_id,
            'to_node_id' => $node2->record_id,
            'relationship_type' => 'located_at',
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals(1, $investigation->connection_count);
        $this->assertCount(1, $investigation->connections);
    }

    /** @test */
    public function it_has_creator_relationship()
    {
        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'With Creator',
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
        ]);

        $this->assertInstanceOf(IdentityUser::class, $investigation->creator);
        $this->assertEquals($this->user->record_id, $investigation->creator->record_id);
    }

    /** @test */
    public function it_casts_dates_correctly()
    {
        $startDate = Carbon::now()->subDays(5);
        $dueDate = Carbon::now()->addDays(10);

        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Date Casting Test',
            'start_date' => $startDate,
            'due_date' => $dueDate,
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
        ]);

        $this->assertInstanceOf(Carbon::class, $investigation->start_date);
        $this->assertInstanceOf(Carbon::class, $investigation->due_date);
        $this->assertTrue($investigation->start_date->isSameDay($startDate));
        $this->assertTrue($investigation->due_date->isSameDay($dueDate));
    }

    /** @test */
    public function it_uses_shareable_trait()
    {
        $investigation = new Investigation();

        $this->assertTrue(method_exists($investigation, 'shares'));
        $this->assertTrue(method_exists($investigation, 'shareWith'));
        $this->assertTrue(method_exists($investigation, 'userHasShareAccess'));
    }

    /** @test */
    public function it_uses_has_unified_relationships_trait()
    {
        $investigation = new Investigation();

        // The HasUnifiedRelationships trait provides relationship methods
        $this->assertTrue(method_exists($investigation, 'allRelationships'));
        $this->assertTrue(method_exists($investigation, 'attachEntity'));
        $this->assertTrue(method_exists($investigation, 'detachEntity'));
    }

    // =========================================================================
    // canAccess Method Tests (WebSocket Authorization)
    // =========================================================================

    /** @test */
    public function can_access_returns_true_for_system_user()
    {
        $systemUser = IdentityUser::create([
            'record_id' => 'can-access-system-user',
            'username' => 'canaccesssystem',
            'email' => 'canaccesssystem@example.com',
            'password_hash' => 'password',
            'partition_id' => $this->partition->record_id,
            'is_active' => true,
        ]);
        $systemUser->setSystemUser(true);

        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'System Access Test',
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
            'is_public' => false,
        ]);

        $this->assertTrue($investigation->canAccess($systemUser, 'read'));
        $this->assertTrue($investigation->canAccess($systemUser, 'update'));
        $this->assertTrue($investigation->canAccess($systemUser, 'delete'));
    }

    /** @test */
    public function can_access_returns_false_for_different_partition()
    {
        $otherPartition = IdentityPartition::create([
            'record_id' => 'can-access-other-partition',
            'name' => 'Other Partition',
            'description' => 'Another partition',
        ]);

        $otherUser = IdentityUser::create([
            'record_id' => 'can-access-other-user',
            'username' => 'canaccessother',
            'email' => 'canaccessother@example.com',
            'password_hash' => 'password',
            'partition_id' => $otherPartition->record_id,
            'is_active' => true,
        ]);

        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Cross Partition Test',
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
            'is_public' => true, // Even if public, cross-partition should fail
        ]);

        $this->assertFalse($investigation->canAccess($otherUser, 'read'));
    }

    /** @test */
    public function can_access_returns_true_for_owner()
    {
        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Owner Access Test',
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
            'is_public' => false,
        ]);

        $this->assertTrue($investigation->canAccess($this->user, 'read'));
        $this->assertTrue($investigation->canAccess($this->user, 'update'));
        $this->assertTrue($investigation->canAccess($this->user, 'delete'));
    }

    /** @test */
    public function can_access_returns_true_for_public_read()
    {
        $otherUser = IdentityUser::create([
            'record_id' => 'can-access-public-user',
            'username' => 'canaccesspublic',
            'email' => 'canaccesspublic@example.com',
            'password_hash' => 'password',
            'partition_id' => $this->partition->record_id,
            'is_active' => true,
        ]);

        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Public Read Test',
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
            'is_public' => true,
        ]);

        $this->assertTrue($investigation->canAccess($otherUser, 'read'));
    }

    /** @test */
    public function can_access_returns_false_for_public_write()
    {
        $otherUser = IdentityUser::create([
            'record_id' => 'can-access-public-write-user',
            'username' => 'canaccesspublicwrite',
            'email' => 'canaccesspublicwrite@example.com',
            'password_hash' => 'password',
            'partition_id' => $this->partition->record_id,
            'is_active' => true,
        ]);

        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Public Write Test',
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
            'is_public' => true,
        ]);

        // Public allows read but not update/delete
        $this->assertFalse($investigation->canAccess($otherUser, 'update'));
        $this->assertFalse($investigation->canAccess($otherUser, 'delete'));
    }

    /** @test */
    public function can_access_returns_false_for_private_investigation()
    {
        $otherUser = IdentityUser::create([
            'record_id' => 'can-access-private-user',
            'username' => 'canaccessprivate',
            'email' => 'canaccessprivate@example.com',
            'password_hash' => 'password',
            'partition_id' => $this->partition->record_id,
            'is_active' => true,
        ]);

        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Private Access Test',
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
            'is_public' => false,
        ]);

        $this->assertFalse($investigation->canAccess($otherUser, 'read'));
        $this->assertFalse($investigation->canAccess($otherUser, 'update'));
        $this->assertFalse($investigation->canAccess($otherUser, 'delete'));
    }

    /** @test */
    public function can_access_returns_true_for_shared_user()
    {
        $sharedUser = IdentityUser::create([
            'record_id' => 'can-access-shared-user',
            'username' => 'canaccessshared',
            'email' => 'canaccessshared@example.com',
            'password_hash' => 'password',
            'partition_id' => $this->partition->record_id,
            'is_active' => true,
        ]);

        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Shared Access Test',
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
            'is_public' => false,
        ]);

        // Share with the user for 'read' action
        $investigation->shareWith($sharedUser, $this->user, 'read');

        $this->assertTrue($investigation->canAccess($sharedUser, 'read'));
    }

    /** @test */
    public function can_access_returns_true_for_shared_edit_permission()
    {
        $sharedUser = IdentityUser::create([
            'record_id' => 'can-access-shared-edit-user',
            'username' => 'canaccesssharededit',
            'email' => 'canaccesssharededit@example.com',
            'password_hash' => 'password',
            'partition_id' => $this->partition->record_id,
            'is_active' => true,
        ]);

        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Shared Edit Access Test',
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
            'is_public' => false,
        ]);

        // Share with 'write' permission
        $investigation->shareWith($sharedUser, $this->user, 'write');

        $this->assertTrue($investigation->canAccess($sharedUser, 'update'));
    }
}
