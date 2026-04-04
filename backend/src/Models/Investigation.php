<?php

namespace NewSolari\Investigations\Models;

use NewSolari\Core\Entity\BaseEntity;
use NewSolari\Core\Identity\Models\IdentityUser;
use NewSolari\Core\Entity\Traits\HasUnifiedRelationships;
use NewSolari\Core\Entity\Traits\Shareable;
use NewSolari\Core\Entity\Traits\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Investigation model - container for linked entities on a canvas.
 *
 * An Investigation aggregates entities from mini-apps (People, Places, Events, etc.)
 * into a visual canvas for analysis. It stores:
 * - Investigation metadata (title, status, priority, dates)
 * - Canvas state (zoom, pan, layout preferences)
 * - Linked nodes (via InvestigationNode)
 * - Visual connections (via InvestigationConnection)
 *
 * Security:
 * - Uses Shareable trait for record sharing
 * - Respects partition isolation
 * - Privacy controlled via is_public field
 */
class Investigation extends BaseEntity
{
    use HasUnifiedRelationships;
    use Shareable;
    use SoftDeletes;

    /**
     * Relationships to cascade soft delete.
     */
    protected static array $cascadeOnDelete = ['nodes', 'connections', 'drawings'];

    /**
     * The table associated with the model.
     */
    protected $table = 'investigations';

    /**
     * The attributes that are mass assignable.
     * Note: Some columns come from the original schema (start_date, end_date)
     * while others are added by the meta-app migration (canvas_state, etc.)
     */
    protected $fillable = [
        'record_id',
        'title',
        'description',
        'status',
        'priority',
        'case_number',
        'start_date',     // Original schema column (mapped from opened_at)
        'end_date',       // Original schema column (mapped from closed_at)
        'due_date',       // Added by meta-app migration
        'canvas_state',   // Added by meta-app migration
        'default_layout', // Added by meta-app migration
        'partition_id',
        'created_by',
        'updated_by',
        'is_public',      // Added by meta-app migration
        'deleted',        // Added by meta-app migration
        'deleted_by',     // Added by meta-app migration
        // Original schema columns
        'lead_investigator_id',
        'lead_investigator_name',
        'case_type',
        'jurisdiction',
        'location',
        'agency',
        'is_confidential',
        'is_sensitive',
        'access_level',
        'tags',
        'related_cases',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'record_id' => 'string',
        'title' => 'string',
        'description' => 'string',
        'status' => 'string',
        'priority' => 'string',
        'case_number' => 'string',
        'start_date' => 'date',
        'end_date' => 'date',
        'due_date' => 'date',
        'canvas_state' => 'array',
        'default_layout' => 'string',
        'partition_id' => 'string',
        'created_by' => 'string',
        'updated_by' => 'string',
        'is_public' => 'boolean',
        'deleted' => 'boolean',
        'deleted_by' => 'string',
        'is_confidential' => 'boolean',
        'is_sensitive' => 'boolean',
    ];

    protected $validations = [
        'record_id' => 'nullable|string|max:36',
        'partition_id' => 'sometimes|string|max:36|exists:identity_partitions,record_id',
        'title' => 'required|string|max:255',
        'description' => 'nullable|string',
        'status' => 'nullable|string|in:open,in_progress,on_hold,closed,archived',
        'priority' => 'nullable|string|in:low,medium,high,critical',
        'case_number' => 'nullable|string|max:50',
        'start_date' => 'nullable|date',
        'end_date' => 'nullable|date|after_or_equal:start_date',
        'due_date' => 'nullable|date',
        'canvas_state' => 'nullable|array',
        'default_layout' => 'nullable|string|in:freeform,grid,timeline,hierarchical,radial,force-directed',
        'is_public' => 'boolean',
        'deleted' => 'boolean',
        'deleted_by' => 'nullable|string|max:36|exists:identity_users,record_id',
        'lead_investigator_id' => 'nullable|string|max:36|exists:identity_users,record_id',
        'lead_investigator_name' => 'nullable|string|max:255',
        'case_type' => 'nullable|string|max:100',
        'jurisdiction' => 'nullable|string|max:100',
        'location' => 'nullable|string|max:500',
        'agency' => 'nullable|string|max:255',
        'is_confidential' => 'boolean',
        'is_sensitive' => 'boolean',
        'access_level' => 'nullable|string|max:50',
        'tags' => 'nullable|string|max:500',
        'related_cases' => 'nullable|string|max:500',
        'created_by' => 'sometimes|string|max:36|exists:identity_users,record_id',
        'updated_by' => 'nullable|string|max:36|exists:identity_users,record_id',
    ];

    /**
     * Status constants.
     * Note: Original schema uses 'open' - we support both for compatibility
     */
    public const STATUS_OPEN = 'open';
    public const STATUS_ACTIVE = 'open';  // Alias for compatibility
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_ON_HOLD = 'on_hold';
    public const STATUS_CLOSED = 'closed';
    public const STATUS_ARCHIVED = 'archived';

    /**
     * Priority constants.
     */
    public const PRIORITY_LOW = 'low';
    public const PRIORITY_MEDIUM = 'medium';
    public const PRIORITY_HIGH = 'high';
    public const PRIORITY_CRITICAL = 'critical';

    /**
     * Layout constants (matching MindCanvas layouts).
     */
    public const LAYOUT_FREEFORM = 'freeform';
    public const LAYOUT_GRID = 'grid';
    public const LAYOUT_TIMELINE = 'timeline';
    public const LAYOUT_HIERARCHICAL = 'hierarchical';
    public const LAYOUT_RADIAL = 'radial';
    public const LAYOUT_FORCE = 'force-directed';

    /**
     * Valid layout types.
     */
    public const VALID_LAYOUTS = [
        self::LAYOUT_FREEFORM,
        self::LAYOUT_GRID,
        self::LAYOUT_TIMELINE,
        self::LAYOUT_HIERARCHICAL,
        self::LAYOUT_RADIAL,
        self::LAYOUT_FORCE,
    ];

    /**
     * Boot the model.
     */
    protected static function boot()
    {
        parent::boot();

        // Auto-generate case_number if not provided
        static::creating(function ($investigation) {
            if (empty($investigation->case_number)) {
                $investigation->case_number = self::generateCaseNumber();
            }
        });
    }

    /**
     * Get the nodes for this investigation.
     */
    public function nodes(): HasMany
    {
        return $this->hasMany(InvestigationNode::class, 'investigation_id', 'record_id');
    }

    /**
     * Get the connections for this investigation.
     */
    public function connections(): HasMany
    {
        return $this->hasMany(InvestigationConnection::class, 'investigation_id', 'record_id');
    }

    /**
     * Get the drawings/annotations for this investigation.
     */
    public function drawings(): HasMany
    {
        return $this->hasMany(InvestigationDrawing::class, 'investigation_id', 'record_id');
    }

    /**
     * Get the creator of this investigation.
     */
    public function creator()
    {
        return $this->belongsTo(IdentityUser::class, 'created_by', 'record_id');
    }

    /**
     * Get the investigation's status info.
     */
    public function getStatusInfoAttribute(): array
    {
        $statuses = [
            self::STATUS_OPEN => ['icon' => 'search', 'color' => 'green', 'label' => 'Open'],
            self::STATUS_IN_PROGRESS => ['icon' => 'play', 'color' => 'blue', 'label' => 'In Progress'],
            self::STATUS_ON_HOLD => ['icon' => 'pause', 'color' => 'yellow', 'label' => 'On Hold'],
            self::STATUS_CLOSED => ['icon' => 'check-circle', 'color' => 'blue', 'label' => 'Closed'],
            self::STATUS_ARCHIVED => ['icon' => 'archive', 'color' => 'gray', 'label' => 'Archived'],
        ];

        return $statuses[$this->status] ?? ['icon' => 'search', 'color' => 'gray', 'label' => 'Unknown'];
    }

    /**
     * Get the investigation's priority info.
     */
    public function getPriorityInfoAttribute(): array
    {
        $priorities = [
            self::PRIORITY_LOW => ['icon' => 'arrow-down', 'color' => 'green', 'label' => 'Low'],
            self::PRIORITY_MEDIUM => ['icon' => 'minus', 'color' => 'yellow', 'label' => 'Medium'],
            self::PRIORITY_HIGH => ['icon' => 'arrow-up', 'color' => 'orange', 'label' => 'High'],
            self::PRIORITY_CRITICAL => ['icon' => 'alert-circle', 'color' => 'red', 'label' => 'Critical'],
        ];

        return $priorities[$this->priority] ?? ['icon' => 'minus', 'color' => 'gray', 'label' => 'Unknown'];
    }

    /**
     * Get the count of nodes on this investigation.
     */
    public function getNodeCountAttribute(): int
    {
        return $this->nodes()->count();
    }

    /**
     * Get the count of connections on this investigation.
     */
    public function getConnectionCountAttribute(): int
    {
        return $this->connections()->count();
    }

    /**
     * Get the count of drawings on this investigation.
     */
    public function getDrawingCountAttribute(): int
    {
        return $this->drawings()->count();
    }

    /**
     * Check if the investigation is overdue.
     */
    public function getIsOverdueAttribute(): bool
    {
        if (! $this->due_date) {
            return false;
        }

        // Check if open/active and past due date
        $activeStatuses = [self::STATUS_OPEN, self::STATUS_IN_PROGRESS];
        return $this->due_date->isPast() && in_array($this->status, $activeStatuses);
    }

    /**
     * Get the canvas zoom level from canvas_state.
     */
    public function getCanvasZoomAttribute(): float
    {
        return $this->canvas_state['zoom'] ?? 1.0;
    }

    /**
     * Get the canvas pan X position from canvas_state.
     */
    public function getCanvasPanXAttribute(): float
    {
        return $this->canvas_state['panX'] ?? 0.0;
    }

    /**
     * Get the canvas pan Y position from canvas_state.
     */
    public function getCanvasPanYAttribute(): float
    {
        return $this->canvas_state['panY'] ?? 0.0;
    }

    /**
     * Update the canvas state.
     */
    public function updateCanvasState(array $state): bool
    {
        $currentState = $this->canvas_state ?? [];
        $this->canvas_state = array_merge($currentState, $state);
        return $this->save();
    }

    /**
     * Get all entity IDs currently on the canvas.
     */
    public function getLinkedEntityIds(): array
    {
        return $this->nodes()
            ->select(['entity_type', 'entity_id'])
            ->get()
            ->map(fn($node) => ['type' => $node->entity_type, 'id' => $node->entity_id])
            ->toArray();
    }

    /**
     * Check if an entity is already on this investigation.
     */
    public function hasEntity(string $entityType, string $entityId): bool
    {
        return $this->nodes()
            ->where('entity_type', $entityType)
            ->where('entity_id', $entityId)
            ->exists();
    }

    /**
     * Generate a unique case number.
     */
    public static function generateCaseNumber(): string
    {
        $prefix = 'INV';
        $year = date('Y');
        $timestamp = now()->format('mdHis');
        $random = strtoupper(substr(md5(uniqid()), 0, 4));

        return "{$prefix}-{$year}-{$timestamp}-{$random}";
    }

    /**
     * Check if a user can access this investigation.
     * Used by WebSocket channel authorization.
     */
    public function canAccess(IdentityUser $user, string $action = 'read'): bool
    {
        // System admins can do anything
        if ($user->is_system_user) {
            return true;
        }

        // Must be in same partition
        if ($user->partition_id !== $this->partition_id) {
            return false;
        }

        // Check partition admin status
        if ($user->isPartitionAdmin($this->partition_id)) {
            return true;
        }

        // Check ownership
        if ($this->created_by === $user->record_id) {
            return true;
        }

        // For read/view actions, check if data is public
        if ($action === 'read' && $this->is_public) {
            return true;
        }

        // Check share-based access
        $shareAction = ($action === 'read') ? 'view' : $action;
        if ($this->userHasShareAccess($user, $shareAction)) {
            return true;
        }

        return false;
    }

    /**
     * Get broadcast channel info for WebSocket access revocation.
     * Used by Shareable trait to notify clients when shares are revoked.
     *
     * @return array|null Array with 'type' and 'id' keys for the channel
     */
    protected function getBroadcastChannelInfo(): ?array
    {
        return [
            'type' => 'investigation.canvas',
            'id' => $this->record_id,
        ];
    }
}
