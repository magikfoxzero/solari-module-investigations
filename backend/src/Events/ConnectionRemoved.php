<?php

namespace NewSolari\Investigations\Events;

use NewSolari\Identity\Models\IdentityUser;
use NewSolari\Core\Contracts\IdentityUserContract;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ConnectionRemoved implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public string $connectionId;

    public string $investigationId;

    public IdentityUserContract $user;

    public function __construct(string $connectionId, string $investigationId, IdentityUserContract $user)
    {
        $this->connectionId = $connectionId;
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
            'connection_id' => $this->connectionId,
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
        return 'connection.removed';
    }
}
