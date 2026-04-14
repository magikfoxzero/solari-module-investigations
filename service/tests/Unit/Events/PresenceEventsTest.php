<?php

namespace Tests\Unit\Events;

use NewSolari\Identity\Models\IdentityPartition;
use NewSolari\Identity\Models\IdentityUser;
use NewSolari\Investigations\Events\CanvasStateUpdated;
use NewSolari\Investigations\Events\UserCursorMoved;
use NewSolari\Investigations\Events\UserJoinedCanvas;
use NewSolari\Investigations\Events\UserLeftCanvas;
use NewSolari\Investigations\Models\Investigation;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PresenceEventsTest extends TestCase
{
    use RefreshDatabase;

    protected $partition;
    protected $user;
    protected $investigation;

    protected function setUp(): void
    {
        parent::setUp();

        $this->partition = IdentityPartition::create([
            'record_id' => 'presence-events-partition',
            'name' => 'Presence Events Test Partition',
            'description' => 'Test partition for presence events',
        ]);

        $this->user = IdentityUser::create([
            'record_id' => 'presence-events-user',
            'username' => 'presenceeventsuser',
            'email' => 'presenceevents@example.com',
            'password_hash' => 'password',
            'partition_id' => $this->partition->record_id,
            'is_active' => true,
        ]);

        $this->investigation = Investigation::create([
            'record_id' => 'presence-events-investigation',
            'title' => 'Presence Events Test Investigation',
            'case_number' => 'CASE-PRESENCE-001',
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
            'is_public' => true,
        ]);
    }

    /** @test */
    public function user_joined_canvas_event_broadcasts_on_correct_channel()
    {
        $event = new UserJoinedCanvas($this->investigation, $this->user);
        $channels = $event->broadcastOn();

        $this->assertCount(1, $channels);
        $this->assertInstanceOf(PresenceChannel::class, $channels[0]);
        $this->assertEquals('presence-investigation.canvas.'.$this->investigation->record_id, $channels[0]->name);
    }

    /** @test */
    public function user_joined_canvas_event_has_correct_broadcast_name()
    {
        $event = new UserJoinedCanvas($this->investigation, $this->user);
        $this->assertEquals('user.joined', $event->broadcastAs());
    }

    /** @test */
    public function user_joined_canvas_event_broadcasts_with_correct_data()
    {
        $event = new UserJoinedCanvas($this->investigation, $this->user);
        $data = $event->broadcastWith();

        $this->assertArrayHasKey('user', $data);
        $this->assertArrayHasKey('investigation_id', $data);
        $this->assertArrayHasKey('joined_at', $data);

        $this->assertEquals($this->user->record_id, $data['user']['record_id']);
        $this->assertEquals($this->user->username, $data['user']['username']);
        $this->assertEquals($this->investigation->record_id, $data['investigation_id']);
    }

    /** @test */
    public function user_left_canvas_event_broadcasts_on_correct_channel()
    {
        $event = new UserLeftCanvas($this->investigation, $this->user);
        $channels = $event->broadcastOn();

        $this->assertCount(1, $channels);
        $this->assertInstanceOf(PresenceChannel::class, $channels[0]);
        $this->assertEquals('presence-investigation.canvas.'.$this->investigation->record_id, $channels[0]->name);
    }

    /** @test */
    public function user_left_canvas_event_has_correct_broadcast_name()
    {
        $event = new UserLeftCanvas($this->investigation, $this->user);
        $this->assertEquals('user.left', $event->broadcastAs());
    }

    /** @test */
    public function user_left_canvas_event_broadcasts_with_correct_data()
    {
        $event = new UserLeftCanvas($this->investigation, $this->user);
        $data = $event->broadcastWith();

        $this->assertArrayHasKey('user', $data);
        $this->assertArrayHasKey('investigation_id', $data);
        $this->assertArrayHasKey('left_at', $data);

        $this->assertEquals($this->user->record_id, $data['user']['record_id']);
        $this->assertEquals($this->user->username, $data['user']['username']);
        $this->assertEquals($this->investigation->record_id, $data['investigation_id']);
    }

    /** @test */
    public function canvas_state_updated_event_broadcasts_on_correct_channel()
    {
        $canvasState = ['zoom' => 1.5, 'panX' => 100, 'panY' => 200];
        $event = new CanvasStateUpdated($this->investigation, $this->user, $canvasState);
        $channels = $event->broadcastOn();

        $this->assertCount(1, $channels);
        $this->assertInstanceOf(PresenceChannel::class, $channels[0]);
        $this->assertEquals('presence-investigation.canvas.'.$this->investigation->record_id, $channels[0]->name);
    }

    /** @test */
    public function canvas_state_updated_event_has_correct_broadcast_name()
    {
        $canvasState = ['zoom' => 1.0];
        $event = new CanvasStateUpdated($this->investigation, $this->user, $canvasState);
        $this->assertEquals('canvas.state.updated', $event->broadcastAs());
    }

    /** @test */
    public function canvas_state_updated_event_broadcasts_with_correct_data()
    {
        $canvasState = [
            'zoom' => 2.0,
            'panX' => 150,
            'panY' => 250,
            'layout' => 'grid',
        ];

        $event = new CanvasStateUpdated($this->investigation, $this->user, $canvasState);
        $data = $event->broadcastWith();

        $this->assertArrayHasKey('investigation_id', $data);
        $this->assertArrayHasKey('canvas_state', $data);
        $this->assertArrayHasKey('user', $data);
        $this->assertArrayHasKey('timestamp', $data);

        $this->assertEquals($this->investigation->record_id, $data['investigation_id']);
        $this->assertEquals(2.0, $data['canvas_state']['zoom']);
        $this->assertEquals(150, $data['canvas_state']['panX']);
        $this->assertEquals(250, $data['canvas_state']['panY']);
        $this->assertEquals('grid', $data['canvas_state']['layout']);
        $this->assertEquals($this->user->record_id, $data['user']['record_id']);
    }

    /** @test */
    public function user_cursor_moved_event_broadcasts_on_correct_channel()
    {
        $event = new UserCursorMoved($this->investigation->record_id, $this->user, 100.5, 200.5);
        $channels = $event->broadcastOn();

        $this->assertCount(1, $channels);
        $this->assertInstanceOf(PresenceChannel::class, $channels[0]);
        $this->assertEquals('presence-investigation.canvas.'.$this->investigation->record_id, $channels[0]->name);
    }

    /** @test */
    public function user_cursor_moved_event_has_correct_broadcast_name()
    {
        $event = new UserCursorMoved($this->investigation->record_id, $this->user, 0, 0);
        $this->assertEquals('user.cursor.moved', $event->broadcastAs());
    }

    /** @test */
    public function user_cursor_moved_event_broadcasts_with_correct_data()
    {
        $event = new UserCursorMoved($this->investigation->record_id, $this->user, 350.75, 450.25);
        $data = $event->broadcastWith();

        $this->assertArrayHasKey('user', $data);
        $this->assertArrayHasKey('x', $data);
        $this->assertArrayHasKey('y', $data);

        $this->assertEquals($this->user->record_id, $data['user']['record_id']);
        $this->assertEquals($this->user->username, $data['user']['username']);
        $this->assertEquals(350.75, $data['x']);
        $this->assertEquals(450.25, $data['y']);
    }

    /** @test */
    public function user_cursor_moved_event_handles_negative_coordinates()
    {
        $event = new UserCursorMoved($this->investigation->record_id, $this->user, -50.5, -100.25);
        $data = $event->broadcastWith();

        $this->assertEquals(-50.5, $data['x']);
        $this->assertEquals(-100.25, $data['y']);
    }

    /** @test */
    public function canvas_state_updated_event_handles_empty_state()
    {
        $event = new CanvasStateUpdated($this->investigation, $this->user, []);
        $data = $event->broadcastWith();

        $this->assertArrayHasKey('canvas_state', $data);
        $this->assertIsArray($data['canvas_state']);
        $this->assertEmpty($data['canvas_state']);
    }
}
