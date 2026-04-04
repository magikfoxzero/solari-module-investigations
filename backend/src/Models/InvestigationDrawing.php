<?php

namespace NewSolari\Investigations\Models;

use NewSolari\Core\Entity\Traits\SoftDeletes;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * InvestigationDrawing model - represents a freehand drawing/annotation on the canvas.
 *
 * Drawings are visual-only elements that allow users to annotate investigations
 * with shapes, lines, text labels, and freehand sketches.
 *
 * Security:
 * - Access controlled via parent Investigation
 */
class InvestigationDrawing extends Model
{
    use SoftDeletes;

    /**
     * The table associated with the model.
     */
    protected $table = 'investigation_drawings';

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
        'tool',
        'points',
        'color',
        'size',
        'line_style',
        'thickness',
        'arrow_type',
        'text',
        'z_index',
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
        'tool' => 'string',
        'points' => 'array',
        'color' => 'string',
        'size' => 'decimal:1',
        'line_style' => 'string',
        'thickness' => 'decimal:1',
        'arrow_type' => 'string',
        'text' => 'string',
        'z_index' => 'integer',
        'partition_id' => 'string',
        'deleted' => 'boolean',
        'deleted_by' => 'string',
    ];

    protected $validations = [
        'record_id' => 'nullable|string|max:36',
        'partition_id' => 'sometimes|string|max:36|exists:identity_partitions,record_id',
        'investigation_id' => 'required|string|max:36|exists:investigations,record_id',
        'tool' => 'required|string|in:pencil,line,rectangle,circle,triangle,diamond,arrow,cloud,label,eraser',
        'points' => 'required|array',
        'color' => 'nullable|string|max:20',
        'size' => 'nullable|numeric|min:1|max:100',
        'line_style' => 'nullable|string|in:solid,dashed,dotted',
        'thickness' => 'nullable|numeric|min:0.5|max:20',
        'arrow_type' => 'nullable|string|in:none,one-way,two-way',
        'text' => 'nullable|string|max:500',
        'z_index' => 'nullable|integer|min:0',
        'deleted' => 'boolean',
        'deleted_by' => 'nullable|string|max:36|exists:identity_users,record_id',
    ];

    /**
     * Drawing tool constants.
     */
    public const TOOL_PENCIL = 'pencil';
    public const TOOL_LINE = 'line';
    public const TOOL_RECTANGLE = 'rectangle';
    public const TOOL_CIRCLE = 'circle';
    public const TOOL_TRIANGLE = 'triangle';
    public const TOOL_DIAMOND = 'diamond';
    public const TOOL_ARROW = 'arrow';
    public const TOOL_CLOUD = 'cloud';
    public const TOOL_LABEL = 'label';
    public const TOOL_ERASER = 'eraser';

    /**
     * Valid drawing tools.
     */
    public const VALID_TOOLS = [
        self::TOOL_PENCIL,
        self::TOOL_LINE,
        self::TOOL_RECTANGLE,
        self::TOOL_CIRCLE,
        self::TOOL_TRIANGLE,
        self::TOOL_DIAMOND,
        self::TOOL_ARROW,
        self::TOOL_CLOUD,
        self::TOOL_LABEL,
        self::TOOL_ERASER,
    ];

    /**
     * Line style constants.
     */
    public const STYLE_SOLID = 'solid';
    public const STYLE_DASHED = 'dashed';
    public const STYLE_DOTTED = 'dotted';

    /**
     * Arrow type constants.
     */
    public const ARROW_NONE = 'none';
    public const ARROW_ONE_WAY = 'one-way';
    public const ARROW_TWO_WAY = 'two-way';

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
     * Get the investigation this drawing belongs to.
     */
    public function investigation(): BelongsTo
    {
        return $this->belongsTo(Investigation::class, 'investigation_id', 'record_id');
    }

    /**
     * Get the bounding box of this drawing.
     */
    public function getBoundsAttribute(): ?array
    {
        $points = $this->points ?? [];
        if (empty($points)) {
            return null;
        }

        $minX = PHP_FLOAT_MAX;
        $minY = PHP_FLOAT_MAX;
        $maxX = PHP_FLOAT_MIN;
        $maxY = PHP_FLOAT_MIN;

        foreach ($points as $point) {
            if (isset($point['x'], $point['y'])) {
                $minX = min($minX, (float) $point['x']);
                $minY = min($minY, (float) $point['y']);
                $maxX = max($maxX, (float) $point['x']);
                $maxY = max($maxY, (float) $point['y']);
            }
        }

        if ($minX === PHP_FLOAT_MAX) {
            return null;
        }

        return [
            'left' => $minX,
            'top' => $minY,
            'right' => $maxX,
            'bottom' => $maxY,
            'width' => $maxX - $minX,
            'height' => $maxY - $minY,
        ];
    }

    /**
     * Get the center point of this drawing.
     */
    public function getCenterAttribute(): ?array
    {
        $bounds = $this->bounds;
        if (!$bounds) {
            return null;
        }

        return [
            'x' => $bounds['left'] + ($bounds['width'] / 2),
            'y' => $bounds['top'] + ($bounds['height'] / 2),
        ];
    }

    /**
     * Get the CSS dash array for the line style.
     */
    public function getStrokeDashArrayAttribute(): string
    {
        return match ($this->line_style) {
            self::STYLE_DASHED => '8,4',
            self::STYLE_DOTTED => '2,4',
            default => 'none',
        };
    }

    /**
     * Get the visual properties for frontend rendering.
     */
    public function getVisualPropertiesAttribute(): array
    {
        return [
            'tool' => $this->tool ?? self::TOOL_PENCIL,
            'color' => $this->color ?? '#000000',
            'size' => (float) ($this->size ?? 2),
            'lineStyle' => $this->line_style,
            'thickness' => $this->thickness ? (float) $this->thickness : null,
            'arrowType' => $this->arrow_type,
            'strokeDashArray' => $this->stroke_dash_array,
            'text' => $this->text,
            'zIndex' => $this->z_index ?? 0,
        ];
    }

    /**
     * Check if this drawing is a shape (vs freehand).
     */
    public function isShape(): bool
    {
        return in_array($this->tool, [
            self::TOOL_RECTANGLE,
            self::TOOL_CIRCLE,
            self::TOOL_TRIANGLE,
            self::TOOL_DIAMOND,
            self::TOOL_CLOUD,
        ]);
    }

    /**
     * Check if this drawing is a line-based tool.
     */
    public function isLine(): bool
    {
        return in_array($this->tool, [
            self::TOOL_LINE,
            self::TOOL_ARROW,
        ]);
    }

    /**
     * Check if this is a text label.
     */
    public function isLabel(): bool
    {
        return $this->tool === self::TOOL_LABEL;
    }

    /**
     * Translate all points by the given offset.
     */
    public function translate(float $dx, float $dy): bool
    {
        $points = $this->points ?? [];
        $translated = [];

        foreach ($points as $point) {
            if (isset($point['x'], $point['y'])) {
                $translated[] = [
                    'x' => (float) $point['x'] + $dx,
                    'y' => (float) $point['y'] + $dy,
                ];
            }
        }

        $this->points = $translated;
        return $this->save();
    }
}
