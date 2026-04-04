<?php

namespace NewSolari\Investigations\Models;

use NewSolari\Core\Entity\Traits\SoftDeletes;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * InvestigationConnection model - represents a visual connection between two nodes.
 *
 * Connections are visual-only (not stored in entity_relationships) and define
 * how nodes are connected on the canvas with styling and relationship semantics.
 *
 * Security:
 * - Access controlled via parent Investigation
 */
class InvestigationConnection extends Model
{
    use SoftDeletes;

    /**
     * The table associated with the model.
     */
    protected $table = 'investigation_connections';

    /**
     * The primary key for the model.
     */
    protected $primaryKey = 'record_id';

    /**
     * The "type" of the primary key ID.
     */
    protected $keyType = 'string';

    /**
     * Indicates if the IDs are auto-incrementing.
     */
    public $incrementing = false;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'record_id',
        'investigation_id',
        'from_node_id',
        'to_node_id',
        'from_side',
        'to_side',
        'style',
        'path_type',
        'color',
        'thickness',
        'arrow_type',
        'relationship_type',
        'relationship_label',
        'sentiment',
        'weight',
        'notes',
        'partition_id',
        'deleted',
        'deleted_by',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'record_id' => 'string',
        'investigation_id' => 'string',
        'from_node_id' => 'string',
        'to_node_id' => 'string',
        'from_side' => 'string',
        'to_side' => 'string',
        'style' => 'string',
        'path_type' => 'string',
        'color' => 'string',
        'thickness' => 'decimal:1',
        'arrow_type' => 'string',
        'relationship_type' => 'string',
        'relationship_label' => 'string',
        'sentiment' => 'string',
        'weight' => 'integer',
        'notes' => 'string',
        'partition_id' => 'string',
        'deleted' => 'boolean',
        'deleted_by' => 'string',
    ];

    protected $validations = [
        'record_id' => 'nullable|string|max:36',
        'partition_id' => 'sometimes|string|max:36|exists:identity_partitions,record_id',
        'investigation_id' => 'required|string|max:36|exists:investigations,record_id',
        'from_node_id' => 'required|string|max:36|exists:investigation_nodes,record_id',
        'to_node_id' => 'required|string|max:36|exists:investigation_nodes,record_id',
        'from_side' => 'nullable|string|in:top,top-right,right,bottom-right,bottom,bottom-left,left,top-left',
        'to_side' => 'nullable|string|in:top,top-right,right,bottom-right,bottom,bottom-left,left,top-left',
        'style' => 'nullable|string|in:solid,dashed,dotted',
        'path_type' => 'nullable|string|in:curved,straight,orthogonal',
        'color' => 'nullable|string|max:20',
        'thickness' => 'nullable|numeric|min:0.5|max:10',
        'arrow_type' => 'nullable|string|in:none,forward,backward,both',
        'relationship_type' => 'nullable|string|max:50',
        'relationship_label' => 'nullable|string|max:255',
        'sentiment' => 'nullable|string|in:neutral,positive,negative',
        'weight' => 'nullable|integer|min:1|max:10',
        'notes' => 'nullable|string',
        'deleted' => 'boolean',
        'deleted_by' => 'nullable|string|max:36|exists:identity_users,record_id',
    ];

    /**
     * Line style constants.
     */
    public const STYLE_SOLID = 'solid';
    public const STYLE_DASHED = 'dashed';
    public const STYLE_DOTTED = 'dotted';

    /**
     * Path type constants.
     */
    public const PATH_CURVED = 'curved';
    public const PATH_STRAIGHT = 'straight';
    public const PATH_ORTHOGONAL = 'orthogonal';

    /**
     * Arrow type constants.
     */
    public const ARROW_NONE = 'none';
    public const ARROW_FORWARD = 'forward';
    public const ARROW_BACKWARD = 'backward';
    public const ARROW_BOTH = 'both';

    /**
     * Connection anchor positions (8 points around node).
     */
    public const ANCHOR_TOP = 'top';
    public const ANCHOR_TOP_RIGHT = 'top-right';
    public const ANCHOR_RIGHT = 'right';
    public const ANCHOR_BOTTOM_RIGHT = 'bottom-right';
    public const ANCHOR_BOTTOM = 'bottom';
    public const ANCHOR_BOTTOM_LEFT = 'bottom-left';
    public const ANCHOR_LEFT = 'left';
    public const ANCHOR_TOP_LEFT = 'top-left';

    /**
     * Valid anchor positions.
     */
    public const VALID_ANCHORS = [
        self::ANCHOR_TOP,
        self::ANCHOR_TOP_RIGHT,
        self::ANCHOR_RIGHT,
        self::ANCHOR_BOTTOM_RIGHT,
        self::ANCHOR_BOTTOM,
        self::ANCHOR_BOTTOM_LEFT,
        self::ANCHOR_LEFT,
        self::ANCHOR_TOP_LEFT,
    ];

    /**
     * Sentiment constants (visual relationship sentiment).
     */
    public const SENTIMENT_NEUTRAL = 'neutral';
    public const SENTIMENT_POSITIVE = 'positive';
    public const SENTIMENT_NEGATIVE = 'negative';

    /**
     * Sentiment color mapping for frontend styling.
     */
    public const SENTIMENT_COLORS = [
        self::SENTIMENT_NEUTRAL => '#6b7280',  // gray
        self::SENTIMENT_POSITIVE => '#22c55e', // green
        self::SENTIMENT_NEGATIVE => '#ef4444', // red
    ];

    /**
     * Common relationship types for investigation connections.
     */
    public const RELATIONSHIP_TYPES = [
        'suspects' => 'Suspects',
        'witnessed' => 'Witnessed',
        'owns' => 'Owns',
        'located_at' => 'Located At',
        'works_at' => 'Works At',
        'related_to' => 'Related To',
        'contacted' => 'Contacted',
        'met_with' => 'Met With',
        'employed_by' => 'Employed By',
        'associated_with' => 'Associated With',
        'leads_to' => 'Leads To',
        'caused_by' => 'Caused By',
        'evidence_of' => 'Evidence Of',
        'contradicts' => 'Contradicts',
        'supports' => 'Supports',
        'custom' => 'Custom',
    ];

    /**
     * Boot the model.
     */
    protected static function boot()
    {
        parent::boot();

        // Auto-generate UUID for record_id
        static::creating(function ($model) {
            if (empty($model->record_id)) {
                $model->record_id = (string) Str::uuid();
            }
        });
    }

    /**
     * Get the investigation this connection belongs to.
     */
    public function investigation(): BelongsTo
    {
        return $this->belongsTo(Investigation::class, 'investigation_id', 'record_id');
    }

    /**
     * Get the source node.
     */
    public function fromNode(): BelongsTo
    {
        return $this->belongsTo(InvestigationNode::class, 'from_node_id', 'record_id');
    }

    /**
     * Get the target node.
     */
    public function toNode(): BelongsTo
    {
        return $this->belongsTo(InvestigationNode::class, 'to_node_id', 'record_id');
    }

    /**
     * Get the display label for the relationship.
     */
    public function getDisplayLabelAttribute(): ?string
    {
        // Use custom label if set
        if (! empty($this->relationship_label)) {
            return $this->relationship_label;
        }

        // Fall back to relationship type display name
        if (! empty($this->relationship_type)) {
            return self::RELATIONSHIP_TYPES[$this->relationship_type] ?? $this->relationship_type;
        }

        return null;
    }

    /**
     * Get the CSS dash array for the line style.
     */
    public function getStrokeDashArrayAttribute(): string
    {
        return match ($this->style) {
            self::STYLE_DASHED => '8,4',
            self::STYLE_DOTTED => '2,4',
            default => 'none',
        };
    }

    /**
     * Get the weight as a confidence level (1-10 normalized).
     */
    public function getConfidenceLevelAttribute(): string
    {
        $weight = $this->weight ?? 5;

        if ($weight <= 3) {
            return 'low';
        } elseif ($weight <= 6) {
            return 'medium';
        } else {
            return 'high';
        }
    }

    /**
     * Check if this connection has an arrow on the source end.
     */
    public function hasSourceArrow(): bool
    {
        return in_array($this->arrow_type, [self::ARROW_BACKWARD, self::ARROW_BOTH]);
    }

    /**
     * Check if this connection has an arrow on the target end.
     */
    public function hasTargetArrow(): bool
    {
        return in_array($this->arrow_type, [self::ARROW_FORWARD, self::ARROW_BOTH]);
    }

    /**
     * Get the connection's visual properties as an array.
     */
    public function getVisualPropertiesAttribute(): array
    {
        $sentiment = $this->sentiment ?? self::SENTIMENT_NEUTRAL;

        return [
            'style' => $this->style ?? self::STYLE_SOLID,
            'pathType' => $this->path_type ?? self::PATH_CURVED,
            'color' => $this->color ?? '#6b7280',
            'thickness' => (float) ($this->thickness ?? 2),
            'arrowType' => $this->arrow_type ?? self::ARROW_FORWARD,
            'strokeDashArray' => $this->stroke_dash_array,
            'hasSourceArrow' => $this->hasSourceArrow(),
            'hasTargetArrow' => $this->hasTargetArrow(),
            'fromSide' => $this->from_side ?? self::ANCHOR_RIGHT,
            'toSide' => $this->to_side ?? self::ANCHOR_LEFT,
            'sentiment' => $sentiment,
            'sentimentColor' => self::SENTIMENT_COLORS[$sentiment] ?? self::SENTIMENT_COLORS[self::SENTIMENT_NEUTRAL],
        ];
    }

    /**
     * Get the relationship semantics as an array.
     */
    public function getRelationshipPropertiesAttribute(): array
    {
        return [
            'type' => $this->relationship_type,
            'label' => $this->display_label,
            'weight' => $this->weight ?? 5,
            'confidence' => $this->confidence_level,
            'sentiment' => $this->sentiment ?? self::SENTIMENT_NEUTRAL,
            'notes' => $this->notes,
        ];
    }

    /**
     * Check if this connection involves a specific node.
     */
    public function involvesNode(string $nodeId): bool
    {
        return $this->from_node_id === $nodeId || $this->to_node_id === $nodeId;
    }

    /**
     * Get the other node in this connection (given one node ID).
     */
    public function getOtherNodeId(string $nodeId): ?string
    {
        if ($this->from_node_id === $nodeId) {
            return $this->to_node_id;
        }
        if ($this->to_node_id === $nodeId) {
            return $this->from_node_id;
        }
        return null;
    }
}
