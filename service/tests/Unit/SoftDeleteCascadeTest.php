<?php

namespace Tests\Unit;

use NewSolari\Identity\Models\IdentityPartition;
use NewSolari\Identity\Models\IdentityUser;
use NewSolari\Investigations\Models\Investigation;
use NewSolari\Investigations\Models\InvestigationConnection;
use NewSolari\Investigations\Models\InvestigationDrawing;
use NewSolari\Investigations\Models\InvestigationNode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SoftDeleteCascadeTest extends TestCase
{
    use RefreshDatabase;

    protected $partition;
    protected $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->partition = IdentityPartition::create([
            'record_id' => 'cascade-test-partition',
            'name' => 'Cascade Test',
            'description' => 'Test partition',
        ]);

        $this->user = IdentityUser::create([
            'record_id' => 'cascade-test-user',
            'username' => 'cascadetestuser',
            'email' => 'cascade@test.com',
            'password_hash' => 'password',
            'partition_id' => $this->partition->record_id,
            'is_active' => true,
        ]);
        $this->user->setSystemUser(true);
    }

    /** @test */
    public function it_cascades_investigation_soft_delete_to_nodes_connections_drawings()
    {
        $investigation = Investigation::createWithValidation([
            'title' => 'Test Investigation',
            'description' => 'A test investigation',
            'status' => 'open',
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
        ]);

        $node = InvestigationNode::create([
            'investigation_id' => $investigation->record_id,
            'entity_type' => 'person',
            'entity_id' => $this->user->record_id,
            'x' => 100,
            'y' => 100,
            'partition_id' => $this->partition->record_id,
        ]);

        $node2 = InvestigationNode::create([
            'investigation_id' => $investigation->record_id,
            'entity_type' => 'note',
            'entity_id' => $this->partition->record_id,
            'x' => 200,
            'y' => 200,
            'partition_id' => $this->partition->record_id,
        ]);

        $connection = InvestigationConnection::create([
            'investigation_id' => $investigation->record_id,
            'from_node_id' => $node->record_id,
            'to_node_id' => $node2->record_id,
            'connection_type' => 'related_to',
            'partition_id' => $this->partition->record_id,
        ]);

        $drawing = InvestigationDrawing::create([
            'investigation_id' => $investigation->record_id,
            'tool' => 'rectangle',
            'points' => [['x' => 0, 'y' => 0], ['x' => 100, 'y' => 100]],
            'partition_id' => $this->partition->record_id,
        ]);

        $investigation->delete();

        $investigation->refresh();
        $node->refresh();
        $node2->refresh();
        $connection->refresh();
        $drawing->refresh();

        $this->assertTrue($investigation->deleted);
        $this->assertTrue($node->deleted, 'Node 1 should be cascade deleted');
        $this->assertTrue($node2->deleted, 'Node 2 should be cascade deleted');
        $this->assertTrue($connection->deleted, 'Connection should be cascade deleted');
        $this->assertTrue($drawing->deleted, 'Drawing should be cascade deleted');
    }
}
