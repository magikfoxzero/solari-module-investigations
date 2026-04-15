<?php

namespace NewSolari\Investigations\Events;

use NewSolari\Core\Contracts\IdentityUserContract;
use NewSolari\Investigations\Models\Investigation;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class UserLeftCanvas implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public Investigation $investigation;

    public IdentityUserContract $user;

    public function __construct(Investigation $investigation, IdentityUserContract $user)
    {
        $this->investigation = $investigation;
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
            new PresenceChannel('investigation.canvas.'.$this->investigation->record_id),
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
            'investigation_id' => $this->investigation->record_id,
            'left_at' => now()->toISOString(),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'user.left';
    }
}
