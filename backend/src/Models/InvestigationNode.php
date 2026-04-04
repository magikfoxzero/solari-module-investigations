<?php

namespace NewSolari\Investigations\Models;

use NewSolari\Core\Entity\BaseEntity;
use NewSolari\Core\Identity\Models\EntityTypeRegistry;
use NewSolari\Core\Entity\Traits\SoftDeletes;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * InvestigationNode model - represents an entity placed on the investigation canvas.
 *
 * Each node links to an entity from a mini-app (Person, Place, Event, etc.)
 * and stores its position and visual styling on the canvas.
 *
 * Security:
 * - Access controlled via parent Investigation
 * - Entity access checked separately when viewing details
 */
class InvestigationNode extends Model
{
    use SoftDeletes;

    /**
     * The table associated with the model.
     */
    protected $table = 'investigation_nodes';

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
        'entity_type',
        'entity_id',
        'x',
        'y',
        'width',
        'height',
        'z_index',
        'style',
        'label_override',
        'notes',
        'tags',
        'is_pinned',
        'is_collapsed',
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
        'entity_type' => 'string',
        'entity_id' => 'string',
        'x' => 'float',
        'y' => 'float',
        'width' => 'float',
        'height' => 'float',
        'z_index' => 'integer',
        'style' => 'array',
        'label_override' => 'string',
        'notes' => 'string',
        'tags' => 'array',
        'is_pinned' => 'boolean',
        'is_collapsed' => 'boolean',
        'partition_id' => 'string',
        'deleted' => 'boolean',
        'deleted_by' => 'string',
    ];

    protected $validations = [
        'record_id' => 'nullable|string|max:36',
        'partition_id' => 'sometimes|string|max:36|exists:identity_partitions,record_id',
        'investigation_id' => 'required|string|max:36|exists:investigations,record_id',
        'entity_type' => 'required|string|max:50',
        'entity_id' => 'required|string|max:36',
        'x' => 'required|numeric',
        'y' => 'required|numeric',
        'width' => 'nullable|numeric|min:0',
        'height' => 'nullable|numeric|min:0',
        'z_index' => 'nullable|integer|min:0',
        'style' => 'nullable|array',
        'label_override' => 'nullable|string|max:255',
        'notes' => 'nullable|string',
        'tags' => 'nullable|array',
        'is_pinned' => 'boolean',
        'is_collapsed' => 'boolean',
        'deleted' => 'boolean',
        'deleted_by' => 'nullable|string|max:36|exists:identity_users,record_id',
    ];

    /**
     * Default node dimensions by entity type.
     */
    public const DEFAULT_DIMENSIONS = [
        'person' => ['width' => 180, 'height' => 80],
        'entity' => ['width' => 200, 'height' => 80],
        'place' => ['width' => 180, 'height' => 80],
        'event' => ['width' => 200, 'height' => 100],
        'note' => ['width' => 160, 'height' => 120],
        'task' => ['width' => 180, 'height' => 80],
        'file' => ['width' => 160, 'height' => 60],
        'hypothesis' => ['width' => 200, 'height' => 100],
        'motive' => ['width' => 180, 'height' => 80],
        'blocknote' => ['width' => 180, 'height' => 80],
        'inventory_object' => ['width' => 180, 'height' => 80],
        'default' => ['width' => 180, 'height' => 80],
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
            // Set default dimensions based on entity type
            if (empty($model->width) || empty($model->height)) {
                $dims = self::DEFAULT_DIMENSIONS[$model->entity_type] ?? self::DEFAULT_DIMENSIONS['default'];
                $model->width = $model->width ?? $dims['width'];
                $model->height = $model->height ?? $dims['height'];
            }
        });

        // When deleting a node, also delete its connections
        static::deleting(function ($node) {
            // Connections are deleted via CASCADE on foreign key
        });
    }

    /**
     * Get the investigation this node belongs to.
     */
    public function investigation(): BelongsTo
    {
        return $this->belongsTo(Investigation::class, 'investigation_id', 'record_id');
    }

    /**
     * Get connections where this node is the source.
     */
    public function outgoingConnections(): HasMany
    {
        return $this->hasMany(InvestigationConnection::class, 'from_node_id', 'record_id');
    }

    /**
     * Get connections where this node is the target.
     */
    public function incomingConnections(): HasMany
    {
        return $this->hasMany(InvestigationConnection::class, 'to_node_id', 'record_id');
    }

    /**
     * Resolve the linked entity from the mini-app.
     */
    public function resolveEntity(): ?BaseEntity
    {
        $registry = EntityTypeRegistry::where('type_key', $this->entity_type)->first();
        if (! $registry || ! $registry->model_class) {
            return null;
        }

        $modelClass = $registry->model_class;
        if (! class_exists($modelClass)) {
            return null;
        }

        return $modelClass::find($this->entity_id);
    }

    /**
     * Get the display label for this node.
     * Uses label_override if set, otherwise extracts from entity.
     * Matches how each mini-app displays its items in list views.
     */
    public function getDisplayLabelAttribute(): string
    {
        if (! empty($this->label_override)) {
            return $this->label_override;
        }

        $entity = $this->resolveEntity();
        if (! $entity) {
            return 'Unknown Entity';
        }

        // For people, use full_name accessor (includes prefix, first, middle, last, suffix)
        if ($this->entity_type === 'person') {
            if (! empty($entity->full_name)) {
                return $this->truncateLabel($entity->full_name);
            }
            // Fallback to first + last name if full_name not available
            if (! empty($entity->first_name) || ! empty($entity->last_name)) {
                return $this->truncateLabel(trim(($entity->first_name ?? '') . ' ' . ($entity->last_name ?? '')));
            }
        }

        // Try common label fields in priority order
        $labelFields = ['title', 'name', 'original_filename', 'subject', 'description'];
        foreach ($labelFields as $field) {
            if (! empty($entity->$field)) {
                return $this->truncateLabel($entity->$field);
            }
        }

        return $entity->record_id ?? 'Unknown';
    }

    /**
     * Truncate a label to a reasonable display length.
     */
    protected function truncateLabel(string $label, int $maxLength = 50): string
    {
        $label = trim($label);
        if (strlen($label) > $maxLength) {
            return substr($label, 0, $maxLength - 3) . '...';
        }
        return $label;
    }

    /**
     * Get the center X position of the node.
     */
    public function getCenterXAttribute(): float
    {
        return (float) $this->x + ((float) $this->width / 2);
    }

    /**
     * Get the center Y position of the node.
     */
    public function getCenterYAttribute(): float
    {
        return (float) $this->y + ((float) $this->height / 2);
    }

    /**
     * Get the bounds of this node (for collision detection, etc.)
     */
    public function getBoundsAttribute(): array
    {
        return [
            'left' => (float) $this->x,
            'top' => (float) $this->y,
            'right' => (float) $this->x + (float) $this->width,
            'bottom' => (float) $this->y + (float) $this->height,
            'width' => (float) $this->width,
            'height' => (float) $this->height,
        ];
    }

    /**
     * Update the position of this node.
     */
    public function updatePosition(float $x, float $y, ?int $zIndex = null): bool
    {
        $this->x = $x;
        $this->y = $y;
        if ($zIndex !== null) {
            $this->z_index = $zIndex;
        }
        return $this->save();
    }

    /**
     * Update the size of this node.
     */
    public function updateSize(float $width, float $height): bool
    {
        $this->width = $width;
        $this->height = $height;
        return $this->save();
    }

    /**
     * Get the effective style (merged with entity type defaults).
     */
    public function getEffectiveStyleAttribute(): array
    {
        $entityVisuals = $this->getEntityTypeVisuals();
        $customStyle = $this->style ?? [];

        return array_merge([
            'backgroundColor' => $entityVisuals['backgroundColor'] ?? '#f3f4f6',
            'borderColor' => $entityVisuals['borderColor'] ?? '#d1d5db',
            'textColor' => $entityVisuals['textColor'] ?? '#1f2937',
        ], $customStyle);
    }

    /**
     * Get visual configuration for this entity type.
     */
    protected function getEntityTypeVisuals(): array
    {
        $visuals = [
            'person' => ['backgroundColor' => '#dbeafe', 'borderColor' => '#3b82f6', 'textColor' => '#1e40af'],
            'entity' => ['backgroundColor' => '#ede9fe', 'borderColor' => '#8b5cf6', 'textColor' => '#5b21b6'],
            'place' => ['backgroundColor' => '#d1fae5', 'borderColor' => '#10b981', 'textColor' => '#065f46'],
            'event' => ['backgroundColor' => '#fee2e2', 'borderColor' => '#ef4444', 'textColor' => '#991b1b'],
            'note' => ['backgroundColor' => '#fef3c7', 'borderColor' => '#f59e0b', 'textColor' => '#92400e'],
            'task' => ['backgroundColor' => '#cffafe', 'borderColor' => '#06b6d4', 'textColor' => '#0e7490'],
            'file' => ['backgroundColor' => '#f3f4f6', 'borderColor' => '#6b7280', 'textColor' => '#374151'],
            'hypothesis' => ['backgroundColor' => '#fef9c3', 'borderColor' => '#eab308', 'textColor' => '#854d0e'],
            'motive' => ['backgroundColor' => '#ffedd5', 'borderColor' => '#f97316', 'textColor' => '#9a3412'],
            'blocknote' => ['backgroundColor' => '#e2e8f0', 'borderColor' => '#1e293b', 'textColor' => '#0f172a'],
            'inventory_object' => ['backgroundColor' => '#ecfccb', 'borderColor' => '#84cc16', 'textColor' => '#3f6212'],
        ];

        return $visuals[$this->entity_type] ?? [
            'backgroundColor' => '#f3f4f6',
            'borderColor' => '#d1d5db',
            'textColor' => '#1f2937',
        ];
    }
}
