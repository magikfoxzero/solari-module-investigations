<?php

namespace NewSolari\Investigations\Events;

use NewSolari\Identity\Models\IdentityUser;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DrawingRemoved implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public string $drawingId;

    public string $investigationId;

    public IdentityUser $user;

    public function __construct(string $drawingId, string $investigationId, IdentityUser $user)
    {
        $this->drawingId = $drawingId;
        $this->investigationId = $investigationId;
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
            new PresenceChannel('investigation.canvas.'.$this->investigationId),
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
            'drawing_id' => $this->drawingId,
            'investigation_id' => $this->investigationId,
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
        return 'drawing.removed';
    }
}
