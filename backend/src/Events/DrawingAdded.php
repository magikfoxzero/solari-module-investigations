<?php

namespace NewSolari\Investigations\Events;

use NewSolari\Identity\Models\IdentityUser;
use NewSolari\Investigations\Models\InvestigationDrawing;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DrawingAdded implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public InvestigationDrawing $drawing;

    public IdentityUser $user;

    public function __construct(InvestigationDrawing $drawing, IdentityUser $user)
    {
        $this->drawing = $drawing;
        $this->user = $user;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PresenceChannel('investigation.canvas.'.$this->drawing->investigation_id),
        ];
    }

    /**
     * Get the data to broadcast.
     *
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'drawing' => [
                'record_id' => $this->drawing->record_id,
                'investigation_id' => $this->drawing->investigation_id,
                'tool' => $this->drawing->tool,
                'points' => $this->drawing->points,
                'color' => $this->drawing->color,
                'size' => (float) $this->drawing->size,
                'thickness' => (float) $this->drawing->thickness,
                'line_style' => $this->drawing->line_style,
                'arrow_type' => $this->drawing->arrow_type,
                'text' => $this->drawing->text,
                'z_index' => $this->drawing->z_index,
            ],
            'user' => [
                'record_id' => $this->user->record_id,
                'username' => $this->user->username,
            ],
            'timestamp' => now()->toISOString(),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'drawing.added';
    }
}
