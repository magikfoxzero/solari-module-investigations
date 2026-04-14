<?php

namespace Tests\Unit\Events;

use NewSolari\Identity\Models\IdentityPartition;
use NewSolari\Identity\Models\IdentityUser;
use NewSolari\Investigations\Events\ConnectionAdded;
use NewSolari\Investigations\Events\ConnectionRemoved;
use NewSolari\Investigations\Events\ConnectionUpdated;
use NewSolari\Investigations\Models\Investigation;
use NewSolari\Investigations\Models\InvestigationConnection;
use NewSolari\Investigations\Models\InvestigationNode;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ConnectionEventsTest extends TestCase
{
    use RefreshDatabase;

    protected $partition;
    protected $user;
    protected $investigation;
    protected $fromNode;
    protected $toNode;
    protected $connection;

    protected function setUp(): void
    {
        parent::setUp();

        $this->partition = IdentityPartition::create([
            'record_id' => 'conn-events-partition',
            'name' => 'Connection Events Test Partition',
            'description' => 'Test partition for connection events',
        ]);

        $this->user = IdentityUser::create([
            'record_id' => 'conn-events-user',
            'username' => 'conneventsuser',
            'email' => 'connevents@example.com',
            'password_hash' => 'password',
            'partition_id' => $this->partition->record_id,
            'is_active' => true,
        ]);

        $this->investigation = Investigation::create([
            'record_id' => 'conn-events-investigation',
            'title' => 'Connection Events Test Investigation',
            'case_number' => 'CASE-CONN-001',
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
            'is_public' => true,
        ]);

        $this->fromNode = InvestigationNode::create([
            'record_id' => 'conn-events-from-node',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => (string) \Str::uuid(),
            'x' => 100,
            'y' => 100,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->toNode = InvestigationNode::create([
            'record_id' => 'conn-events-to-node',
            'investigation_id' => $this->investigation->record_id,
            'entity_type' => 'place',
            'entity_id' => (string) \Str::uuid(),
            'x' => 400,
            'y' => 100,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->connection = InvestigationConnection::create([
            'record_id' => 'conn-events-connection',
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->fromNode->record_id,
            'to_node_id' => $this->toNode->record_id,
            'style' => InvestigationConnection::STYLE_SOLID,
            'path_type' => InvestigationConnection::PATH_CURVED,
            'color' => '#3b82f6',
            'thickness' => 2,
            'arrow_type' => InvestigationConnection::ARROW_FORWARD,
            'relationship_type' => 'located_at',
            'partition_id' => $this->partition->record_id,
        ]);
    }

    /** @test */
    public function connection_added_event_broadcasts_on_correct_channel()
    {
        $event = new ConnectionAdded($this->connection, $this->user);
        $channels = $event->broadcastOn();

        $this->assertCount(1, $channels);
        $this->assertInstanceOf(PresenceChannel::class, $channels[0]);
        $this->assertEquals('presence-investigation.canvas.'.$this->investigation->record_id, $channels[0]->name);
    }

    /** @test */
    public function connection_added_event_has_correct_broadcast_name()
    {
        $event = new ConnectionAdded($this->connection, $this->user);
        $this->assertEquals('connection.added', $event->broadcastAs());
    }

    /** @test */
    public function connection_added_event_broadcasts_with_correct_data()
    {
        $event = new ConnectionAdded($this->connection, $this->user);
        $data = $event->broadcastWith();

        $this->assertArrayHasKey('connection', $data);
        $this->assertArrayHasKey('user', $data);
        $this->assertArrayHasKey('timestamp', $data);

        $conn = $data['connection'];
        $this->assertEquals($this->connection->record_id, $conn['record_id']);
        $this->assertEquals($this->connection->investigation_id, $conn['investigation_id']);
        $this->assertEquals($this->fromNode->record_id, $conn['from_node_id']);
        $this->assertEquals($this->toNode->record_id, $conn['to_node_id']);
        $this->assertEquals('solid', $conn['style']);
        $this->assertEquals('curved', $conn['path_type']);
        $this->assertEquals('#3b82f6', $conn['color']);
        $this->assertEquals(2.0, $conn['thickness']);
        $this->assertEquals('forward', $conn['arrow_type']);
        $this->assertEquals('located_at', $conn['relationship_type']);

        $this->assertEquals($this->user->record_id, $data['user']['record_id']);
    }

    /** @test */
    public function connection_updated_event_broadcasts_on_correct_channel()
    {
        $event = new ConnectionUpdated($this->connection, $this->user);
        $channels = $event->broadcastOn();

        $this->assertCount(1, $channels);
        $this->assertInstanceOf(PresenceChannel::class, $channels[0]);
    }

    /** @test */
    public function connection_updated_event_has_correct_broadcast_name()
    {
        $event = new ConnectionUpdated($this->connection, $this->user);
        $this->assertEquals('connection.updated', $event->broadcastAs());
    }

    /** @test */
    public function connection_updated_event_broadcasts_with_updated_data()
    {
        $this->connection->style = InvestigationConnection::STYLE_DASHED;
        $this->connection->color = '#ef4444';
        $this->connection->relationship_label = 'Custom relationship';
        $this->connection->save();

        $event = new ConnectionUpdated($this->connection, $this->user);
        $data = $event->broadcastWith();

        $this->assertEquals('dashed', $data['connection']['style']);
        $this->assertEquals('#ef4444', $data['connection']['color']);
        $this->assertEquals('Custom relationship', $data['connection']['relationship_label']);
    }

    /** @test */
    public function connection_removed_event_broadcasts_on_correct_channel()
    {
        $event = new ConnectionRemoved($this->connection->record_id, $this->investigation->record_id, $this->user);
        $channels = $event->broadcastOn();

        $this->assertCount(1, $channels);
        $this->assertInstanceOf(PresenceChannel::class, $channels[0]);
        $this->assertEquals('presence-investigation.canvas.'.$this->investigation->record_id, $channels[0]->name);
    }

    /** @test */
    public function connection_removed_event_has_correct_broadcast_name()
    {
        $event = new ConnectionRemoved($this->connection->record_id, $this->investigation->record_id, $this->user);
        $this->assertEquals('connection.removed', $event->broadcastAs());
    }

    /** @test */
    public function connection_removed_event_broadcasts_with_correct_data()
    {
        $connectionId = $this->connection->record_id;
        $event = new ConnectionRemoved($connectionId, $this->investigation->record_id, $this->user);
        $data = $event->broadcastWith();

        $this->assertArrayHasKey('connection_id', $data);
        $this->assertArrayHasKey('investigation_id', $data);
        $this->assertArrayHasKey('user', $data);
        $this->assertArrayHasKey('timestamp', $data);

        $this->assertEquals($connectionId, $data['connection_id']);
        $this->assertEquals($this->investigation->record_id, $data['investigation_id']);
        $this->assertEquals($this->user->record_id, $data['user']['record_id']);
    }

    /** @test */
    public function connection_added_event_includes_all_connection_properties()
    {
        $connection = InvestigationConnection::create([
            'investigation_id' => $this->investigation->record_id,
            'from_node_id' => $this->fromNode->record_id,
            'to_node_id' => $this->toNode->record_id,
            'from_side' => InvestigationConnection::ANCHOR_RIGHT,
            'to_side' => InvestigationConnection::ANCHOR_LEFT,
            'style' => InvestigationConnection::STYLE_DOTTED,
            'path_type' => InvestigationConnection::PATH_ORTHOGONAL,
            'color' => '#22c55e',
            'thickness' => 3,
            'arrow_type' => InvestigationConnection::ARROW_BOTH,
            'relationship_type' => 'suspects',
            'relationship_label' => 'Primary suspect',
            'sentiment' => InvestigationConnection::SENTIMENT_NEGATIVE,
            'weight' => 8,
            'notes' => 'High confidence connection',
            'partition_id' => $this->partition->record_id,
        ]);

        $event = new ConnectionAdded($connection, $this->user);
        $data = $event->broadcastWith();

        $conn = $data['connection'];
        $this->assertEquals('right', $conn['from_side']);
        $this->assertEquals('left', $conn['to_side']);
        $this->assertEquals('dotted', $conn['style']);
        $this->assertEquals('orthogonal', $conn['path_type']);
        $this->assertEquals('#22c55e', $conn['color']);
        $this->assertEquals(3.0, $conn['thickness']);
        $this->assertEquals('both', $conn['arrow_type']);
        $this->assertEquals('suspects', $conn['relationship_type']);
        $this->assertEquals('Primary suspect', $conn['relationship_label']);
        $this->assertEquals('negative', $conn['sentiment']);
        $this->assertEquals(8, $conn['weight']);
        $this->assertEquals('High confidence connection', $conn['notes']);
    }
}
