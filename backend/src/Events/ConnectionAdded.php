<?php

namespace NewSolari\Investigations\Events;

use NewSolari\Core\Identity\Models\IdentityUser;
use NewSolari\Investigations\Models\InvestigationConnection;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ConnectionAdded implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    // Named 'investigationConnection' to avoid conflict with Laravel's queue $connection lookup
    public InvestigationConnection $investigationConnection;

    public IdentityUser $user;

    public function __construct(InvestigationConnection $investigationConnection, IdentityUser $user)
    {
        $this->investigationConnection = $investigationConnection;
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
            new PresenceChannel('investigation.canvas.'.$this->investigationConnection->investigation_id),
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
            'connection' => [
                'record_id' => $this->investigationConnection->record_id,
                'investigation_id' => $this->investigationConnection->investigation_id,
                'from_node_id' => $this->investigationConnection->from_node_id,
                'to_node_id' => $this->investigationConnection->to_node_id,
                'from_side' => $this->investigationConnection->from_side,
                'to_side' => $this->investigationConnection->to_side,
                'style' => $this->investigationConnection->style,
                'path_type' => $this->investigationConnection->path_type,
                'color' => $this->investigationConnection->color,
                'thickness' => (float) $this->investigationConnection->thickness,
                'arrow_type' => $this->investigationConnection->arrow_type,
                'relationship_type' => $this->investigationConnection->relationship_type,
                'relationship_label' => $this->investigationConnection->relationship_label,
                'sentiment' => $this->investigationConnection->sentiment,
                'weight' => $this->investigationConnection->weight,
                'notes' => $this->investigationConnection->notes,
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
        return 'connection.added';
    }
}
