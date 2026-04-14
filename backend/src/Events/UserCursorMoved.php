<?php

namespace NewSolari\Investigations\Events;

use NewSolari\Identity\Models\IdentityUser;
use NewSolari\Core\Contracts\IdentityUserContract;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * UserCursorMoved - broadcasts cursor position for real-time collaboration.
 *
 * This event is designed for high-frequency updates to show other users'
 * cursor positions on the canvas in real-time.
 */
class UserCursorMoved implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public string $investigationId;

    public IdentityUserContract $user;

    public float $x;

    public float $y;

    public function __construct(string $investigationId, IdentityUserContract $user, float $x, float $y)
    {
        $this->investigationId = $investigationId;
        $this->user = $user;
        $this->x = $x;
        $this->y = $y;
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
            'user' => [
                'record_id' => $this->user->record_id,
                'username' => $this->user->username,
            ],
            'x' => $this->x,
            'y' => $this->y,
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'user.cursor.moved';
    }
}
