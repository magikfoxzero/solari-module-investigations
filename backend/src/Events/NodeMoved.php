<?php

namespace NewSolari\Investigations\Events;

use NewSolari\Identity\Models\IdentityUser;
use NewSolari\Investigations\Models\InvestigationNode;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NodeMoved implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public InvestigationNode $node;

    public IdentityUser $user;

    public function __construct(InvestigationNode $node, IdentityUser $user)
    {
        $this->node = $node;
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
            new PresenceChannel('investigation.canvas.'.$this->node->investigation_id),
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
            'node_id' => $this->node->record_id,
            'investigation_id' => $this->node->investigation_id,
            'x' => (float) $this->node->x,
            'y' => (float) $this->node->y,
            'z_index' => $this->node->z_index,
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
        return 'node.moved';
    }
}
