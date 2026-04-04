<?php

namespace Tests\Unit\Events;

use NewSolari\Core\Identity\Models\IdentityPartition;
use NewSolari\Core\Identity\Models\IdentityUser;
use NewSolari\Investigations\Events\NodeAdded;
use NewSolari\Investigations\Events\NodeMoved;
use NewSolari\Investigations\Events\NodeRemoved;
use NewSolari\Investigations\Events\NodeUpdated;
use NewSolari\Investigations\Models\Investigation;
use NewSolari\Investigations\Models\InvestigationNode;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NodeEventsTest extends TestCase
{
    use RefreshDatabase;

    protected $partition;
    protected $user;
    protected $investigation;
    protected $node;

    protected function setUp(): void
    {
        parent::setUp();

        $this->partition = IdentityPartition::create([
            'record_id' => 'node-events-partition',
            'name' => 'Node Events Test Partition',
            'description' => 'Test partition for node events',
        ]);

        $this->user = IdentityUser::create([
            'record_id' => 'node-events-user',
            'username' => 'nodeeventsuser',
            'email' => 'nodeevents@example.com',
            'password_hash' => 'password',
            'partition_id' => $this->partition->record_id,
            'is_active' => true,
        ]);

        $this->investigation = Investigation::create([
            'record_id' => 'node-events-investigation',
            'title' => 'Node Events Test Investigation',
            'case_number' => 'CASE-NODE-001',
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
            'is_public' => true,
        ]);

        $this->node = InvestigationNode::create([
            'record_id' => 'node-events-node',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 100,
            'y' => 200,
            'width' => 180,
            'height' => 80,
            'z_index' => 1,
            'partition_id' => $this->partition->record_id,
        ]);
    }

    /** @test */
    public function node_added_event_broadcasts_on_correct_channel()
    {
        $event = new NodeAdded($this->node, $this->user);
        $channels = $event->broadcastOn();

        $this->assertCount(1, $channels);
        $this->assertInstanceOf(PresenceChannel::class, $channels[0]);
        $this->assertEquals('presence-investigation.canvas.'.$this->investigation->record_id, $channels[0]->name);
    }

    /** @test */
    public function node_added_event_has_correct_broadcast_name()
    {
        $event = new NodeAdded($this->node, $this->user);
        $this->assertEquals('node.added', $event->broadcastAs());
    }

    /** @test */
    public function node_added_event_broadcasts_with_correct_data()
    {
        $event = new NodeAdded($this->node, $this->user);
        $data = $event->broadcastWith();

        $this->assertArrayHasKey('node', $data);
        $this->assertArrayHasKey('user', $data);
        $this->assertArrayHasKey('timestamp', $data);

        $this->assertEquals($this->node->record_id, $data['node']['record_id']);
        $this->assertEquals($this->node->investigation_id, $data['node']['investigation_id']);
        $this->assertEquals($this->node->entity_type, $data['node']['entity_type']);
        $this->assertEquals(100.0, $data['node']['x']);
        $this->assertEquals(200.0, $data['node']['y']);

        $this->assertEquals($this->user->record_id, $data['user']['record_id']);
        $this->assertEquals($this->user->username, $data['user']['username']);
    }

    /** @test */
    public function node_moved_event_broadcasts_on_correct_channel()
    {
        $event = new NodeMoved($this->node, $this->user);
        $channels = $event->broadcastOn();

        $this->assertCount(1, $channels);
        $this->assertInstanceOf(PresenceChannel::class, $channels[0]);
        $this->assertEquals('presence-investigation.canvas.'.$this->investigation->record_id, $channels[0]->name);
    }

    /** @test */
    public function node_moved_event_has_correct_broadcast_name()
    {
        $event = new NodeMoved($this->node, $this->user);
        $this->assertEquals('node.moved', $event->broadcastAs());
    }

    /** @test */
    public function node_moved_event_broadcasts_with_correct_data()
    {
        $this->node->x = 300;
        $this->node->y = 400;
        $this->node->save();

        $event = new NodeMoved($this->node, $this->user);
        $data = $event->broadcastWith();

        $this->assertArrayHasKey('node_id', $data);
        $this->assertArrayHasKey('investigation_id', $data);
        $this->assertArrayHasKey('x', $data);
        $this->assertArrayHasKey('y', $data);
        $this->assertArrayHasKey('z_index', $data);
        $this->assertArrayHasKey('user', $data);
        $this->assertArrayHasKey('timestamp', $data);

        $this->assertEquals($this->node->record_id, $data['node_id']);
        $this->assertEquals(300.0, $data['x']);
        $this->assertEquals(400.0, $data['y']);
    }

    /** @test */
    public function node_updated_event_broadcasts_on_correct_channel()
    {
        $event = new NodeUpdated($this->node, $this->user);
        $channels = $event->broadcastOn();

        $this->assertCount(1, $channels);
        $this->assertInstanceOf(PresenceChannel::class, $channels[0]);
    }

    /** @test */
    public function node_updated_event_has_correct_broadcast_name()
    {
        $event = new NodeUpdated($this->node, $this->user);
        $this->assertEquals('node.updated', $event->broadcastAs());
    }

    /** @test */
    public function node_updated_event_broadcasts_with_correct_data()
    {
        $this->node->label_override = 'New Label';
        $this->node->notes = 'Updated notes';
        $this->node->save();

        $event = new NodeUpdated($this->node, $this->user);
        $data = $event->broadcastWith();

        $this->assertArrayHasKey('node', $data);
        $this->assertEquals('New Label', $data['node']['label_override']);
        $this->assertEquals('Updated notes', $data['node']['notes']);
    }

    /** @test */
    public function node_removed_event_broadcasts_on_correct_channel()
    {
        $event = new NodeRemoved($this->node->record_id, $this->investigation->record_id, $this->user);
        $channels = $event->broadcastOn();

        $this->assertCount(1, $channels);
        $this->assertInstanceOf(PresenceChannel::class, $channels[0]);
        $this->assertEquals('presence-investigation.canvas.'.$this->investigation->record_id, $channels[0]->name);
    }

    /** @test */
    public function node_removed_event_has_correct_broadcast_name()
    {
        $event = new NodeRemoved($this->node->record_id, $this->investigation->record_id, $this->user);
        $this->assertEquals('node.removed', $event->broadcastAs());
    }

    /** @test */
    public function node_removed_event_broadcasts_with_correct_data()
    {
        $nodeId = $this->node->record_id;
        $event = new NodeRemoved($nodeId, $this->investigation->record_id, $this->user);
        $data = $event->broadcastWith();

        $this->assertArrayHasKey('node_id', $data);
        $this->assertArrayHasKey('investigation_id', $data);
        $this->assertArrayHasKey('user', $data);
        $this->assertArrayHasKey('timestamp', $data);

        $this->assertEquals($nodeId, $data['node_id']);
        $this->assertEquals($this->investigation->record_id, $data['investigation_id']);
        $this->assertEquals($this->user->record_id, $data['user']['record_id']);
    }

    /** @test */
    public function node_added_event_includes_all_node_properties()
    {
        $node = InvestigationNode::create([
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'event',
            'entity_id' => (string) \Str::uuid(),
            'x' => 50,
            'y' => 75,
            'width' => 200,
            'height' => 100,
            'z_index' => 5,
            'style' => ['backgroundColor' => '#ff0000'],
            'label_override' => 'Custom Label',
            'notes' => 'Some notes',
            'tags' => ['tag1', 'tag2'],
            'is_pinned' => true,
            'is_collapsed' => false,
            'partition_id' => $this->partition->record_id,
        ]);

        $event = new NodeAdded($node, $this->user);
        $data = $event->broadcastWith();

        $this->assertEquals('event', $data['node']['entity_type']);
        $this->assertEquals(50.0, $data['node']['x']);
        $this->assertEquals(75.0, $data['node']['y']);
        $this->assertEquals(200.0, $data['node']['width']);
        $this->assertEquals(100.0, $data['node']['height']);
        $this->assertEquals(5, $data['node']['z_index']);
        $this->assertEquals(['backgroundColor' => '#ff0000'], $data['node']['style']);
        $this->assertEquals('Custom Label', $data['node']['label_override']);
        $this->assertEquals('Some notes', $data['node']['notes']);
        $this->assertEquals(['tag1', 'tag2'], $data['node']['tags']);
        $this->assertTrue($data['node']['is_pinned']);
        $this->assertFalse($data['node']['is_collapsed']);
    }
}
