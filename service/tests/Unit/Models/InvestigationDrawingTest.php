<?php

namespace Tests\Unit\Models;

use NewSolari\Core\Identity\Models\IdentityPartition;
use NewSolari\Core\Identity\Models\IdentityUser;
use NewSolari\Investigations\Models\Investigation;
use NewSolari\Investigations\Models\InvestigationDrawing;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvestigationDrawingTest extends TestCase
{
    use RefreshDatabase;

    protected $partition;
    protected $user;
    protected $investigation;

    protected function setUp(): void
    {
        parent::setUp();

        $this->partition = IdentityPartition::create([
            'record_id' => 'drawing-test-partition',
            'name' => 'Drawing Test Partition',
            'description' => 'Test partition for investigation drawing tests',
        ]);

        $this->user = IdentityUser::create([
            'record_id' => 'drawing-test-user',
            'username' => 'drawingtestuser',
            'email' => 'drawingtest@example.com',
            'password_hash' => 'password',
            'partition_id' => $this->partition->record_id,
            'is_active' => true,
        ]);

        $this->investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Test Investigation for Drawings',
            'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
        ]);
    }

    /** @test */
    public function it_can_create_a_drawing()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_PENCIL,
            'points' => [['x' => 10, 'y' => 20], ['x' => 30, 'y' => 40]],
            'color' => '#ff0000',
            'size' => 3.5,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertInstanceOf(InvestigationDrawing::class, $drawing);
        $this->assertEquals(InvestigationDrawing::TOOL_PENCIL, $drawing->tool);
        $this->assertEquals('#ff0000', $drawing->color);
        $this->assertEquals(3.5, (float) $drawing->size);
    }

    /** @test */
    public function it_auto_generates_uuid()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_LINE,
            'points' => [['x' => 0, 'y' => 0], ['x' => 100, 'y' => 100]],
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertNotEmpty($drawing->record_id);
        $this->assertTrue(\Str::isUuid($drawing->record_id));
    }

    /** @test */
    public function it_uses_provided_uuid_if_set()
    {
        $customUuid = (string) \Str::uuid();
        $drawing = InvestigationDrawing::create([
            'record_id' => $customUuid,
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_LINE,
            'points' => [['x' => 0, 'y' => 0]],
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals($customUuid, $drawing->record_id);
    }

    /** @test */
    public function it_has_investigation_relationship()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_RECTANGLE,
            'points' => [['x' => 0, 'y' => 0], ['x' => 100, 'y' => 100]],
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertInstanceOf(Investigation::class, $drawing->investigation);
        $this->assertEquals($this->investigation->record_id, $drawing->investigation->record_id);
    }

    /** @test */
    public function it_casts_points_to_array()
    {
        $points = [['x' => 10, 'y' => 20], ['x' => 30, 'y' => 40], ['x' => 50, 'y' => 60]];
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_PENCIL,
            'points' => $points,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertIsArray($drawing->points);
        $this->assertCount(3, $drawing->points);
        $this->assertEquals($points, $drawing->points);
    }

    /** @test */
    public function it_calculates_bounds_correctly()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_PENCIL,
            'points' => [
                ['x' => 10, 'y' => 20],
                ['x' => 50, 'y' => 80],
                ['x' => 30, 'y' => 40],
            ],
            'partition_id' => $this->partition->record_id,
        ]);

        $bounds = $drawing->bounds;

        $this->assertIsArray($bounds);
        $this->assertEquals(10, $bounds['left']);
        $this->assertEquals(20, $bounds['top']);
        $this->assertEquals(50, $bounds['right']);
        $this->assertEquals(80, $bounds['bottom']);
        $this->assertEquals(40, $bounds['width']); // 50 - 10
        $this->assertEquals(60, $bounds['height']); // 80 - 20
    }

    /** @test */
    public function it_returns_null_bounds_for_empty_points()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_PENCIL,
            'points' => [],
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertNull($drawing->bounds);
    }

    /** @test */
    public function it_returns_null_bounds_for_model_with_no_valid_points()
    {
        // Test the attribute directly on a model instance without persisting
        // since the database has NOT NULL constraint on points
        $drawing = new InvestigationDrawing([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_PENCIL,
            'points' => null,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertNull($drawing->bounds);
    }

    /** @test */
    public function it_skips_invalid_points_when_calculating_bounds()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_PENCIL,
            'points' => [
                ['x' => 10, 'y' => 20],
                ['invalid' => 'data'],
                ['x' => 50], // missing y
                ['y' => 100], // missing x
                ['x' => 30, 'y' => 40],
            ],
            'partition_id' => $this->partition->record_id,
        ]);

        $bounds = $drawing->bounds;

        // Should only consider valid points (first and last)
        $this->assertEquals(10, $bounds['left']);
        $this->assertEquals(20, $bounds['top']);
        $this->assertEquals(30, $bounds['right']);
        $this->assertEquals(40, $bounds['bottom']);
    }

    /** @test */
    public function it_calculates_center_correctly()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_RECTANGLE,
            'points' => [
                ['x' => 0, 'y' => 0],
                ['x' => 100, 'y' => 50],
            ],
            'partition_id' => $this->partition->record_id,
        ]);

        $center = $drawing->center;

        $this->assertIsArray($center);
        $this->assertEquals(50, $center['x']); // 0 + (100/2)
        $this->assertEquals(25, $center['y']); // 0 + (50/2)
    }

    /** @test */
    public function it_returns_null_center_for_empty_points()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_PENCIL,
            'points' => [],
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertNull($drawing->center);
    }

    /** @test */
    public function it_returns_correct_stroke_dash_array_for_solid()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_LINE,
            'points' => [['x' => 0, 'y' => 0], ['x' => 100, 'y' => 100]],
            'line_style' => InvestigationDrawing::STYLE_SOLID,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals('none', $drawing->stroke_dash_array);
    }

    /** @test */
    public function it_returns_correct_stroke_dash_array_for_dashed()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_LINE,
            'points' => [['x' => 0, 'y' => 0], ['x' => 100, 'y' => 100]],
            'line_style' => InvestigationDrawing::STYLE_DASHED,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals('8,4', $drawing->stroke_dash_array);
    }

    /** @test */
    public function it_returns_correct_stroke_dash_array_for_dotted()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_LINE,
            'points' => [['x' => 0, 'y' => 0], ['x' => 100, 'y' => 100]],
            'line_style' => InvestigationDrawing::STYLE_DOTTED,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals('2,4', $drawing->stroke_dash_array);
    }

    /** @test */
    public function it_returns_none_stroke_dash_array_for_null_style()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_LINE,
            'points' => [['x' => 0, 'y' => 0], ['x' => 100, 'y' => 100]],
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals('none', $drawing->stroke_dash_array);
    }

    /** @test */
    public function it_returns_correct_visual_properties()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_ARROW,
            'points' => [['x' => 0, 'y' => 0], ['x' => 100, 'y' => 100]],
            'color' => '#0000ff',
            'size' => 5,
            'line_style' => InvestigationDrawing::STYLE_DASHED,
            'thickness' => 2.5,
            'arrow_type' => InvestigationDrawing::ARROW_ONE_WAY,
            'text' => 'Arrow Label',
            'z_index' => 10,
            'partition_id' => $this->partition->record_id,
        ]);

        $props = $drawing->visual_properties;

        $this->assertIsArray($props);
        $this->assertEquals(InvestigationDrawing::TOOL_ARROW, $props['tool']);
        $this->assertEquals('#0000ff', $props['color']);
        $this->assertEquals(5, $props['size']);
        $this->assertEquals(InvestigationDrawing::STYLE_DASHED, $props['lineStyle']);
        $this->assertEquals(2.5, $props['thickness']);
        $this->assertEquals(InvestigationDrawing::ARROW_ONE_WAY, $props['arrowType']);
        $this->assertEquals('8,4', $props['strokeDashArray']);
        $this->assertEquals('Arrow Label', $props['text']);
        $this->assertEquals(10, $props['zIndex']);
    }

    /** @test */
    public function it_returns_default_visual_properties_when_not_set()
    {
        // Use non-persisted model to test defaults since DB has NOT NULL constraints
        $drawing = new InvestigationDrawing([
            'investigation_id' => $this->investigation->record_id,
            'tool' => null, // Test null tool
            'points' => [],
            'partition_id' => $this->partition->record_id,
        ]);

        $props = $drawing->visual_properties;

        $this->assertEquals(InvestigationDrawing::TOOL_PENCIL, $props['tool']);
        $this->assertEquals('#000000', $props['color']);
        $this->assertEquals(2, $props['size']);
        $this->assertEquals(0, $props['zIndex']);
    }

    /** @test */
    public function it_identifies_shapes_correctly()
    {
        $shapeTools = [
            InvestigationDrawing::TOOL_RECTANGLE,
            InvestigationDrawing::TOOL_CIRCLE,
            InvestigationDrawing::TOOL_TRIANGLE,
            InvestigationDrawing::TOOL_CLOUD,
        ];

        foreach ($shapeTools as $tool) {
            $drawing = new InvestigationDrawing(['tool' => $tool]);
            $this->assertTrue($drawing->isShape(), "Tool $tool should be identified as a shape");
        }
    }

    /** @test */
    public function it_identifies_non_shapes_correctly()
    {
        $nonShapeTools = [
            InvestigationDrawing::TOOL_PENCIL,
            InvestigationDrawing::TOOL_LINE,
            InvestigationDrawing::TOOL_ARROW,
            InvestigationDrawing::TOOL_LABEL,
            InvestigationDrawing::TOOL_ERASER,
        ];

        foreach ($nonShapeTools as $tool) {
            $drawing = new InvestigationDrawing(['tool' => $tool]);
            $this->assertFalse($drawing->isShape(), "Tool $tool should not be identified as a shape");
        }
    }

    /** @test */
    public function it_identifies_lines_correctly()
    {
        $lineTools = [
            InvestigationDrawing::TOOL_LINE,
            InvestigationDrawing::TOOL_ARROW,
        ];

        foreach ($lineTools as $tool) {
            $drawing = new InvestigationDrawing(['tool' => $tool]);
            $this->assertTrue($drawing->isLine(), "Tool $tool should be identified as a line");
        }
    }

    /** @test */
    public function it_identifies_non_lines_correctly()
    {
        $nonLineTools = [
            InvestigationDrawing::TOOL_PENCIL,
            InvestigationDrawing::TOOL_RECTANGLE,
            InvestigationDrawing::TOOL_CIRCLE,
            InvestigationDrawing::TOOL_TRIANGLE,
            InvestigationDrawing::TOOL_CLOUD,
            InvestigationDrawing::TOOL_LABEL,
            InvestigationDrawing::TOOL_ERASER,
        ];

        foreach ($nonLineTools as $tool) {
            $drawing = new InvestigationDrawing(['tool' => $tool]);
            $this->assertFalse($drawing->isLine(), "Tool $tool should not be identified as a line");
        }
    }

    /** @test */
    public function it_identifies_labels_correctly()
    {
        $drawing = new InvestigationDrawing(['tool' => InvestigationDrawing::TOOL_LABEL]);
        $this->assertTrue($drawing->isLabel());
    }

    /** @test */
    public function it_identifies_non_labels_correctly()
    {
        $nonLabelTools = [
            InvestigationDrawing::TOOL_PENCIL,
            InvestigationDrawing::TOOL_LINE,
            InvestigationDrawing::TOOL_RECTANGLE,
            InvestigationDrawing::TOOL_CIRCLE,
            InvestigationDrawing::TOOL_TRIANGLE,
            InvestigationDrawing::TOOL_ARROW,
            InvestigationDrawing::TOOL_CLOUD,
            InvestigationDrawing::TOOL_ERASER,
        ];

        foreach ($nonLabelTools as $tool) {
            $drawing = new InvestigationDrawing(['tool' => $tool]);
            $this->assertFalse($drawing->isLabel(), "Tool $tool should not be identified as a label");
        }
    }

    /** @test */
    public function it_translates_points_correctly()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_PENCIL,
            'points' => [
                ['x' => 10, 'y' => 20],
                ['x' => 30, 'y' => 40],
            ],
            'partition_id' => $this->partition->record_id,
        ]);

        $result = $drawing->translate(5, 10);

        $this->assertTrue($result);
        $drawing->refresh();

        $this->assertEquals(15, $drawing->points[0]['x']); // 10 + 5
        $this->assertEquals(30, $drawing->points[0]['y']); // 20 + 10
        $this->assertEquals(35, $drawing->points[1]['x']); // 30 + 5
        $this->assertEquals(50, $drawing->points[1]['y']); // 40 + 10
    }

    /** @test */
    public function it_translates_with_negative_offset()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_LINE,
            'points' => [
                ['x' => 100, 'y' => 200],
                ['x' => 300, 'y' => 400],
            ],
            'partition_id' => $this->partition->record_id,
        ]);

        $result = $drawing->translate(-50, -100);

        $this->assertTrue($result);
        $drawing->refresh();

        $this->assertEquals(50, $drawing->points[0]['x']);
        $this->assertEquals(100, $drawing->points[0]['y']);
        $this->assertEquals(250, $drawing->points[1]['x']);
        $this->assertEquals(300, $drawing->points[1]['y']);
    }

    /** @test */
    public function it_handles_translate_with_empty_points()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_PENCIL,
            'points' => [],
            'partition_id' => $this->partition->record_id,
        ]);

        $result = $drawing->translate(10, 20);

        $this->assertTrue($result);
        $drawing->refresh();
        $this->assertEmpty($drawing->points);
    }

    /** @test */
    public function it_skips_invalid_points_when_translating()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_PENCIL,
            'points' => [
                ['x' => 10, 'y' => 20],
                ['invalid' => 'data'],
                ['x' => 30, 'y' => 40],
            ],
            'partition_id' => $this->partition->record_id,
        ]);

        $result = $drawing->translate(5, 5);

        $this->assertTrue($result);
        $drawing->refresh();

        // Only valid points should be translated (and invalid ones skipped)
        $this->assertCount(2, $drawing->points);
        $this->assertEquals(15, $drawing->points[0]['x']);
        $this->assertEquals(25, $drawing->points[0]['y']);
        $this->assertEquals(35, $drawing->points[1]['x']);
        $this->assertEquals(45, $drawing->points[1]['y']);
    }

    /** @test */
    public function it_has_all_valid_tools_defined()
    {
        $expectedTools = [
            InvestigationDrawing::TOOL_PENCIL,
            InvestigationDrawing::TOOL_LINE,
            InvestigationDrawing::TOOL_RECTANGLE,
            InvestigationDrawing::TOOL_CIRCLE,
            InvestigationDrawing::TOOL_TRIANGLE,
            InvestigationDrawing::TOOL_DIAMOND,
            InvestigationDrawing::TOOL_ARROW,
            InvestigationDrawing::TOOL_CLOUD,
            InvestigationDrawing::TOOL_LABEL,
            InvestigationDrawing::TOOL_ERASER,
        ];

        $this->assertEquals($expectedTools, InvestigationDrawing::VALID_TOOLS);
        $this->assertCount(10, InvestigationDrawing::VALID_TOOLS);
    }

    /** @test */
    public function it_has_correct_tool_constant_values()
    {
        $this->assertEquals('pencil', InvestigationDrawing::TOOL_PENCIL);
        $this->assertEquals('line', InvestigationDrawing::TOOL_LINE);
        $this->assertEquals('rectangle', InvestigationDrawing::TOOL_RECTANGLE);
        $this->assertEquals('circle', InvestigationDrawing::TOOL_CIRCLE);
        $this->assertEquals('triangle', InvestigationDrawing::TOOL_TRIANGLE);
        $this->assertEquals('diamond', InvestigationDrawing::TOOL_DIAMOND);
        $this->assertEquals('arrow', InvestigationDrawing::TOOL_ARROW);
        $this->assertEquals('cloud', InvestigationDrawing::TOOL_CLOUD);
        $this->assertEquals('label', InvestigationDrawing::TOOL_LABEL);
        $this->assertEquals('eraser', InvestigationDrawing::TOOL_ERASER);
    }

    /** @test */
    public function it_has_correct_line_style_constant_values()
    {
        $this->assertEquals('solid', InvestigationDrawing::STYLE_SOLID);
        $this->assertEquals('dashed', InvestigationDrawing::STYLE_DASHED);
        $this->assertEquals('dotted', InvestigationDrawing::STYLE_DOTTED);
    }

    /** @test */
    public function it_has_correct_arrow_type_constant_values()
    {
        $this->assertEquals('none', InvestigationDrawing::ARROW_NONE);
        $this->assertEquals('one-way', InvestigationDrawing::ARROW_ONE_WAY);
        $this->assertEquals('two-way', InvestigationDrawing::ARROW_TWO_WAY);
    }

    /** @test */
    public function it_can_soft_delete()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_PENCIL,
            'points' => [['x' => 0, 'y' => 0]],
            'partition_id' => $this->partition->record_id,
        ]);

        $recordId = $drawing->record_id;
        $drawing->delete();

        // Should not be found normally
        $this->assertNull(InvestigationDrawing::find($recordId));

        // Should be found with withDeleted scope (custom SoftDeletes trait)
        $trashedDrawing = InvestigationDrawing::withDeleted()->find($recordId);
        $this->assertNotNull($trashedDrawing);
        $this->assertTrue($trashedDrawing->deleted);
    }

    /** @test */
    public function it_tracks_deleted_by()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_PENCIL,
            'points' => [['x' => 0, 'y' => 0]],
            'partition_id' => $this->partition->record_id,
        ]);

        $drawing->deleted_by = $this->user->record_id;
        $drawing->delete();

        // Use withDeleted scope (custom SoftDeletes trait)
        $trashedDrawing = InvestigationDrawing::withDeleted()->find($drawing->record_id);
        $this->assertEquals($this->user->record_id, $trashedDrawing->deleted_by);
    }

    /** @test */
    public function it_stores_z_index()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_RECTANGLE,
            'points' => [['x' => 0, 'y' => 0], ['x' => 100, 'y' => 100]],
            'z_index' => 50,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals(50, $drawing->z_index);
    }

    /** @test */
    public function it_stores_text_for_labels()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_LABEL,
            'points' => [['x' => 100, 'y' => 200]],
            'text' => 'This is a label annotation',
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals('This is a label annotation', $drawing->text);
    }

    /** @test */
    public function it_stores_thickness()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_LINE,
            'points' => [['x' => 0, 'y' => 0], ['x' => 100, 'y' => 100]],
            'thickness' => 4.5,
            'partition_id' => $this->partition->record_id,
        ]);

        $this->assertEquals(4.5, (float) $drawing->thickness);
    }

    /** @test */
    public function it_handles_single_point_bounds()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_LABEL,
            'points' => [['x' => 50, 'y' => 75]],
            'partition_id' => $this->partition->record_id,
        ]);

        $bounds = $drawing->bounds;

        $this->assertIsArray($bounds);
        $this->assertEquals(50, $bounds['left']);
        $this->assertEquals(75, $bounds['top']);
        $this->assertEquals(50, $bounds['right']);
        $this->assertEquals(75, $bounds['bottom']);
        $this->assertEquals(0, $bounds['width']);
        $this->assertEquals(0, $bounds['height']);
    }

    /** @test */
    public function it_handles_negative_coordinates()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_PENCIL,
            'points' => [
                ['x' => -100, 'y' => -50],
                ['x' => 50, 'y' => 100],
            ],
            'partition_id' => $this->partition->record_id,
        ]);

        $bounds = $drawing->bounds;

        $this->assertEquals(-100, $bounds['left']);
        $this->assertEquals(-50, $bounds['top']);
        $this->assertEquals(50, $bounds['right']);
        $this->assertEquals(100, $bounds['bottom']);
        $this->assertEquals(150, $bounds['width']);
        $this->assertEquals(150, $bounds['height']);
    }

    /** @test */
    public function it_handles_float_coordinates_in_bounds()
    {
        $drawing = InvestigationDrawing::create([
            'investigation_id' => $this->investigation->record_id,
            'tool' => InvestigationDrawing::TOOL_PENCIL,
            'points' => [
                ['x' => 10.5, 'y' => 20.25],
                ['x' => 50.75, 'y' => 80.125],
            ],
            'partition_id' => $this->partition->record_id,
        ]);

        $bounds = $drawing->bounds;

        $this->assertEquals(10.5, $bounds['left']);
        $this->assertEquals(20.25, $bounds['top']);
        $this->assertEquals(50.75, $bounds['right']);
        $this->assertEquals(80.125, $bounds['bottom']);
    }
}
