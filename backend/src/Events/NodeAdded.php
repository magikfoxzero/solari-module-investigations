<?php

namespace NewSolari\Investigations\Events;

use NewSolari\Identity\Models\IdentityUser;
use NewSolari\Investigations\Models\InvestigationNode;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NodeAdded implements ShouldBroadcast
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
            'node' => [
                'record_id' => $this->node->record_id,
                'investigation_id' => $this->node->investigation_id,
                'entity_type' => $this->node->entity_type,
                'entity_id' => $this->node->entity_id,
                'x' => (float) $this->node->x,
                'y' => (float) $this->node->y,
                'width' => (float) $this->node->width,
                'height' => (float) $this->node->height,
                'z_index' => $this->node->z_index,
                'style' => $this->node->style,
                'label_override' => $this->node->label_override,
                'notes' => $this->node->notes,
                'tags' => $this->node->tags,
                'is_pinned' => $this->node->is_pinned,
                'is_collapsed' => $this->node->is_collapsed,
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
        return 'node.added';
    }
}
