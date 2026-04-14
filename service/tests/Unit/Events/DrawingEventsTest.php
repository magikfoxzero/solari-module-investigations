<?php

namespace Tests\Unit\Events;

use NewSolari\Identity\Models\IdentityPartition;
use NewSolari\Identity\Models\IdentityUser;
use NewSolari\Investigations\Events\DrawingAdded;
use NewSolari\Investigations\Events\DrawingRemoved;
use NewSolari\Investigations\Events\DrawingUpdated;
use NewSolari\Investigations\Models\Investigation;
use NewSolari\Investigations\Models\InvestigationDrawing;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DrawingEventsTest extends TestCase
{
    use RefreshDatabase;

    protected $partition;
    protected $user;
    protected $investigation;
    protected $drawing;

    protected function setUp(): void
    {
        parent::setUp();

        $this->partition = IdentityPartition::create([
            'record_id' => 'draw-events-partition',
            'name' => 'Drawing Events Test Partition',
            'description' => 'Test partition for drawing events',
        ]);

        $this->user = IdentityUser::create([
            'record_id' => 'draw-events-user',
            'username' => 'draweventsuser',
            'email' => 'drawevents@example.com',
            'password_hash' => 'password',
            'partition_id' => $this->partition->record_id,
            'is_active' => true,
        ]);

        $this->investigation = Investigation::create([
            'record_id' => 'draw-events-investigation',
            'title' => 'Drawing Events Test Investigation',
            'case_number' => 'CASE-DRAW-001',
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
            'is_public' => true,
        ]);

        $this->drawing = InvestigationDrawing::create([
            'record_id' => 'draw-events-drawing',
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_PENCIL,
            'points' => [[0, 0], [50, 50], [100, 25]],
            'color' => '#3b82f6',
            'size' => 2,
            'thickness' => 1,
            'line_style' => InvestigationDrawing::STYLE_SOLID,
            'z_index' => 1,
            'partition_id' => $this->partition->record_id,
        ]);
    }

    /** @test */
    public function drawing_added_event_broadcasts_on_correct_channel()
    {
        $event = new DrawingAdded($this->drawing, $this->user);
        $channels = $event->broadcastOn();

        $this->assertCount(1, $channels);
        $this->assertInstanceOf(PresenceChannel::class, $channels[0]);
        $this->assertEquals('presence-investigation.canvas.'.$this->investigation->record_id, $channels[0]->name);
    }

    /** @test */
    public function drawing_added_event_has_correct_broadcast_name()
    {
        $event = new DrawingAdded($this->drawing, $this->user);
        $this->assertEquals('drawing.added', $event->broadcastAs());
    }

    /** @test */
    public function drawing_added_event_broadcasts_with_correct_data()
    {
        $event = new DrawingAdded($this->drawing, $this->user);
        $data = $event->broadcastWith();

        $this->assertArrayHasKey('drawing', $data);
        $this->assertArrayHasKey('user', $data);
        $this->assertArrayHasKey('timestamp', $data);

        $drawing = $data['drawing'];
        $this->assertEquals($this->drawing->record_id, $drawing['record_id']);
        $this->assertEquals($this->investigation->record_id, $drawing['investigation_id']);
        $this->assertEquals('pencil', $drawing['tool']);
        $this->assertEquals([[0, 0], [50, 50], [100, 25]], $drawing['points']);
        $this->assertEquals('#3b82f6', $drawing['color']);
        $this->assertEquals(2.0, $drawing['size']);
        $this->assertEquals(1.0, $drawing['thickness']);
        $this->assertEquals('solid', $drawing['line_style']);
        $this->assertEquals(1, $drawing['z_index']);

        $this->assertEquals($this->user->record_id, $data['user']['record_id']);
    }

    /** @test */
    public function drawing_updated_event_broadcasts_on_correct_channel()
    {
        $event = new DrawingUpdated($this->drawing, $this->user);
        $channels = $event->broadcastOn();

        $this->assertCount(1, $channels);
        $this->assertInstanceOf(PresenceChannel::class, $channels[0]);
    }

    /** @test */
    public function drawing_updated_event_has_correct_broadcast_name()
    {
        $event = new DrawingUpdated($this->drawing, $this->user);
        $this->assertEquals('drawing.updated', $event->broadcastAs());
    }

    /** @test */
    public function drawing_updated_event_broadcasts_with_updated_data()
    {
        $this->drawing->color = '#ef4444';
        $this->drawing->size = 5;
        $this->drawing->text = 'Updated text';
        $this->drawing->save();

        $event = new DrawingUpdated($this->drawing, $this->user);
        $data = $event->broadcastWith();

        $this->assertEquals('#ef4444', $data['drawing']['color']);
        $this->assertEquals(5.0, $data['drawing']['size']);
        $this->assertEquals('Updated text', $data['drawing']['text']);
    }

    /** @test */
    public function drawing_removed_event_broadcasts_on_correct_channel()
    {
        $event = new DrawingRemoved($this->drawing->record_id, $this->investigation->record_id, $this->user);
        $channels = $event->broadcastOn();

        $this->assertCount(1, $channels);
        $this->assertInstanceOf(PresenceChannel::class, $channels[0]);
        $this->assertEquals('presence-investigation.canvas.'.$this->investigation->record_id, $channels[0]->name);
    }

    /** @test */
    public function drawing_removed_event_has_correct_broadcast_name()
    {
        $event = new DrawingRemoved($this->drawing->record_id, $this->investigation->record_id, $this->user);
        $this->assertEquals('drawing.removed', $event->broadcastAs());
    }

    /** @test */
    public function drawing_removed_event_broadcasts_with_correct_data()
    {
        $drawingId = $this->drawing->record_id;
        $event = new DrawingRemoved($drawingId, $this->investigation->record_id, $this->user);
        $data = $event->broadcastWith();

        $this->assertArrayHasKey('drawing_id', $data);
        $this->assertArrayHasKey('investigation_id', $data);
        $this->assertArrayHasKey('user', $data);
        $this->assertArrayHasKey('timestamp', $data);

        $this->assertEquals($drawingId, $data['drawing_id']);
        $this->assertEquals($this->investigation->record_id, $data['investigation_id']);
        $this->assertEquals($this->user->record_id, $data['user']['record_id']);
    }

    /** @test */
    public function drawing_added_event_includes_all_drawing_properties()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_RECTANGLE,
            'points' => [[10, 20], [30, 40]],
            'color' => '#fbbf24',
            'size' => 20,
            'thickness' => 3,
            'line_style' => InvestigationDrawing::STYLE_DASHED,
            'arrow_type' => InvestigationDrawing::ARROW_ONE_WAY,
            'text' => 'Important area',
            'z_index' => 10,
            'partition_id' => $this->partition->record_id,
        ]);

        $event = new DrawingAdded($drawing, $this->user);
        $data = $event->broadcastWith();

        $d = $data['drawing'];
        $this->assertEquals('rectangle', $d['tool']);
        $this->assertEquals([[10, 20], [30, 40]], $d['points']);
        $this->assertEquals('#fbbf24', $d['color']);
        $this->assertEquals(20.0, $d['size']);
        $this->assertEquals(3.0, $d['thickness']);
        $this->assertEquals('dashed', $d['line_style']);
        $this->assertEquals('one-way', $d['arrow_type']);
        $this->assertEquals('Important area', $d['text']);
        $this->assertEquals(10, $d['z_index']);
    }
}
