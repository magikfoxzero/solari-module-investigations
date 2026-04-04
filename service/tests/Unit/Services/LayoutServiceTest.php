<?php

namespace Tests\Unit\Services;

use NewSolari\Investigations\Models\Investigation;
use NewSolari\Investigations\Services\LayoutService;
use Tests\TestCase;

class LayoutServiceTest extends TestCase
{
    protected LayoutService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new LayoutService();
    }

    /** @test */
    public function it_returns_empty_array_for_empty_nodes()
    {
        $positions = $this->service->calculateLayout('grid', [], []);
        $this->assertIsArray($positions);
        $this->assertEmpty($positions);
    }

    /** @test */
    public function it_calculates_grid_layout_positions()
    {
        $nodes = [
            ['record_id' => 'node1', 'x' => 0, 'y' => 0],
            ['record_id' => 'node2', 'x' => 0, 'y' => 0],
            ['record_id' => 'node3', 'x' => 0, 'y' => 0],
            ['record_id' => 'node4', 'x' => 0, 'y' => 0],
        ];

        $positions = $this->service->calculateGridLayout($nodes);

        $this->assertCount(4, $positions);
        $this->assertArrayHasKey('node1', $positions);
        $this->assertArrayHasKey('node2', $positions);
        $this->assertArrayHasKey('node3', $positions);
        $this->assertArrayHasKey('node4', $positions);

        // 4 nodes should form a 2x2 grid
        $this->assertEquals(['x' => 50, 'y' => 50], $positions['node1']);
        $this->assertEquals(['x' => 300, 'y' => 50], $positions['node2']); // 50 + 200 + 50
        $this->assertEquals(['x' => 50, 'y' => 200], $positions['node3']); // 50 + 100 + 50
        $this->assertEquals(['x' => 300, 'y' => 200], $positions['node4']);
    }

    /** @test */
    public function it_calculates_grid_layout_with_custom_options()
    {
        $nodes = [
            ['record_id' => 'node1', 'x' => 0, 'y' => 0],
            ['record_id' => 'node2', 'x' => 0, 'y' => 0],
        ];

        $positions = $this->service->calculateGridLayout($nodes, 150, 80, 30, 20);

        $this->assertCount(2, $positions);
        // node1 at padding
        $this->assertEquals(['x' => 20, 'y' => 20], $positions['node1']);
        // node2 next column: 20 + 150 + 30 = 200
        $this->assertEquals(['x' => 200, 'y' => 20], $positions['node2']);
    }

    /** @test */
    public function it_calculates_timeline_layout_positions()
    {
        $nodes = [
            ['record_id' => 'node1', 'x' => 0, 'y' => 0],
            ['record_id' => 'node2', 'x' => 0, 'y' => 0],
            ['record_id' => 'node3', 'x' => 0, 'y' => 0],
        ];

        $positions = $this->service->calculateTimelineLayout($nodes);

        $this->assertCount(3, $positions);

        // All nodes should have the same Y position
        $this->assertEquals($positions['node1']['y'], $positions['node2']['y']);
        $this->assertEquals($positions['node2']['y'], $positions['node3']['y']);

        // Nodes should be arranged horizontally
        $this->assertLessThan($positions['node2']['x'], $positions['node1']['x']);
        $this->assertLessThan($positions['node3']['x'], $positions['node2']['x']);
    }

    /** @test */
    public function it_calculates_radial_layout_for_single_node()
    {
        $nodes = [
            ['record_id' => 'node1', 'x' => 0, 'y' => 0],
        ];

        $positions = $this->service->calculateRadialLayout($nodes, []);

        $this->assertCount(1, $positions);
        $this->assertArrayHasKey('node1', $positions);
        // Single node should be at center (600 + 50 padding, 500 + 50 padding)
        $this->assertEquals(650, $positions['node1']['x']);
        $this->assertEquals(550, $positions['node1']['y']);
    }

    /** @test */
    public function it_calculates_radial_layout_for_multiple_nodes()
    {
        $nodes = [
            ['record_id' => 'node1', 'x' => 0, 'y' => 0],
            ['record_id' => 'node2', 'x' => 0, 'y' => 0],
            ['record_id' => 'node3', 'x' => 0, 'y' => 0],
        ];

        $connections = [
            ['from_node_id' => 'node1', 'to_node_id' => 'node2'],
        ];

        $positions = $this->service->calculateRadialLayout($nodes, $connections);

        $this->assertCount(3, $positions);

        // All nodes should have valid positions
        foreach ($positions as $pos) {
            $this->assertArrayHasKey('x', $pos);
            $this->assertArrayHasKey('y', $pos);
            $this->assertIsNumeric($pos['x']);
            $this->assertIsNumeric($pos['y']);
        }
    }

    /** @test */
    public function it_calculates_hierarchical_layout_with_connections()
    {
        $nodes = [
            ['record_id' => 'root', 'x' => 0, 'y' => 0],
            ['record_id' => 'child1', 'x' => 0, 'y' => 0],
            ['record_id' => 'child2', 'x' => 0, 'y' => 0],
        ];

        $connections = [
            ['from_node_id' => 'root', 'to_node_id' => 'child1'],
            ['from_node_id' => 'root', 'to_node_id' => 'child2'],
        ];

        $positions = $this->service->calculateHierarchicalLayout($nodes, $connections);

        $this->assertCount(3, $positions);

        // Root should be at the top (lower Y value)
        $this->assertLessThan($positions['child1']['y'], $positions['root']['y']);
        $this->assertLessThan($positions['child2']['y'], $positions['root']['y']);

        // Children should be at the same level (same Y value)
        $this->assertEquals($positions['child1']['y'], $positions['child2']['y']);
    }

    /** @test */
    public function it_calculates_hierarchical_layout_without_connections()
    {
        $nodes = [
            ['record_id' => 'node1', 'x' => 0, 'y' => 0],
            ['record_id' => 'node2', 'x' => 0, 'y' => 0],
        ];

        $positions = $this->service->calculateHierarchicalLayout($nodes, []);

        $this->assertCount(2, $positions);
        // Without connections, all nodes should be on the same level
        $this->assertEquals($positions['node1']['y'], $positions['node2']['y']);
    }

    /** @test */
    public function it_calculates_force_directed_layout()
    {
        $nodes = [
            ['record_id' => 'node1', 'x' => 0, 'y' => 0],
            ['record_id' => 'node2', 'x' => 0, 'y' => 0],
            ['record_id' => 'node3', 'x' => 0, 'y' => 0],
        ];

        $connections = [
            ['from_node_id' => 'node1', 'to_node_id' => 'node2'],
        ];

        $positions = $this->service->calculateForceDirectedLayout($nodes, $connections);

        $this->assertCount(3, $positions);

        // All nodes should have valid positions
        foreach ($positions as $nodeId => $pos) {
            $this->assertArrayHasKey('x', $pos);
            $this->assertArrayHasKey('y', $pos);
            $this->assertIsNumeric($pos['x']);
            $this->assertIsNumeric($pos['y']);
            // Positions should be within bounds (canvas is 2000x1500)
            $this->assertGreaterThanOrEqual(50, $pos['x']);
            $this->assertLessThanOrEqual(1900, $pos['x']);
            $this->assertGreaterThanOrEqual(50, $pos['y']);
            $this->assertLessThanOrEqual(1400, $pos['y']);
        }
    }

    /** @test */
    public function it_preserves_positions_for_freeform_layout()
    {
        $nodes = [
            ['record_id' => 'node1', 'x' => 100, 'y' => 200],
            ['record_id' => 'node2', 'x' => 300, 'y' => 400],
        ];

        $positions = $this->service->preservePositions($nodes);

        $this->assertCount(2, $positions);
        $this->assertEquals(100.0, $positions['node1']['x']);
        $this->assertEquals(200.0, $positions['node1']['y']);
        $this->assertEquals(300.0, $positions['node2']['x']);
        $this->assertEquals(400.0, $positions['node2']['y']);
    }

    /** @test */
    public function it_handles_missing_position_values()
    {
        $nodes = [
            ['record_id' => 'node1'],
            ['record_id' => 'node2', 'x' => 100],
        ];

        $positions = $this->service->preservePositions($nodes);

        $this->assertEquals(0.0, $positions['node1']['x']);
        $this->assertEquals(0.0, $positions['node1']['y']);
        $this->assertEquals(100.0, $positions['node2']['x']);
        $this->assertEquals(0.0, $positions['node2']['y']);
    }

    /** @test */
    public function it_calculates_canvas_bounds()
    {
        $nodes = [
            ['record_id' => 'node1', 'x' => 100, 'y' => 50, 'width' => 200, 'height' => 100],
            ['record_id' => 'node2', 'x' => 400, 'y' => 200, 'width' => 150, 'height' => 80],
        ];

        $bounds = $this->service->calculateCanvasBounds($nodes);

        $this->assertEquals(100, $bounds['left']);
        $this->assertEquals(50, $bounds['top']);
        $this->assertEquals(550, $bounds['right']); // 400 + 150
        $this->assertEquals(280, $bounds['bottom']); // 200 + 80
        $this->assertEquals(450, $bounds['width']); // 550 - 100
        $this->assertEquals(230, $bounds['height']); // 280 - 50
    }

    /** @test */
    public function it_calculates_canvas_bounds_with_drawings()
    {
        $nodes = [
            ['record_id' => 'node1', 'x' => 100, 'y' => 100, 'width' => 200, 'height' => 100],
        ];

        $drawings = [
            ['bounds' => ['left' => 50, 'top' => 50, 'right' => 400, 'bottom' => 300]],
        ];

        $bounds = $this->service->calculateCanvasBounds($nodes, $drawings);

        $this->assertEquals(50, $bounds['left']);
        $this->assertEquals(50, $bounds['top']);
        $this->assertEquals(400, $bounds['right']);
        $this->assertEquals(300, $bounds['bottom']);
    }

    /** @test */
    public function it_returns_default_bounds_for_empty_canvas()
    {
        $bounds = $this->service->calculateCanvasBounds([], []);

        $this->assertEquals(0, $bounds['left']);
        $this->assertEquals(0, $bounds['top']);
        $this->assertEquals(1000, $bounds['right']);
        $this->assertEquals(800, $bounds['bottom']);
        $this->assertEquals(1000, $bounds['width']);
        $this->assertEquals(800, $bounds['height']);
    }

    /** @test */
    public function it_uses_default_dimensions_for_nodes_without_size()
    {
        $nodes = [
            ['record_id' => 'node1', 'x' => 0, 'y' => 0],
        ];

        $bounds = $this->service->calculateCanvasBounds($nodes);

        $this->assertEquals(0, $bounds['left']);
        $this->assertEquals(0, $bounds['top']);
        $this->assertEquals(200, $bounds['right']); // default width
        $this->assertEquals(100, $bounds['bottom']); // default height
    }

    /** @test */
    public function it_returns_valid_layout_types()
    {
        $types = $this->service->getValidLayoutTypes();

        $this->assertIsArray($types);
        $this->assertContains(Investigation::LAYOUT_FREEFORM, $types);
        $this->assertContains(Investigation::LAYOUT_GRID, $types);
        $this->assertContains(Investigation::LAYOUT_TIMELINE, $types);
        $this->assertContains(Investigation::LAYOUT_HIERARCHICAL, $types);
        $this->assertContains(Investigation::LAYOUT_RADIAL, $types);
        $this->assertContains(Investigation::LAYOUT_FORCE, $types);
    }

    /** @test */
    public function it_validates_layout_types()
    {
        $this->assertTrue($this->service->isValidLayoutType('grid'));
        $this->assertTrue($this->service->isValidLayoutType('freeform'));
        $this->assertTrue($this->service->isValidLayoutType('hierarchical'));
        $this->assertFalse($this->service->isValidLayoutType('invalid'));
        $this->assertFalse($this->service->isValidLayoutType(''));
    }

    /** @test */
    public function it_uses_calculate_layout_dispatcher()
    {
        $nodes = [
            ['record_id' => 'node1', 'x' => 0, 'y' => 0],
            ['record_id' => 'node2', 'x' => 0, 'y' => 0],
        ];

        // Test grid layout via dispatcher
        $positions = $this->service->calculateLayout('grid', $nodes, []);
        $this->assertCount(2, $positions);
        $this->assertArrayHasKey('node1', $positions);
        $this->assertArrayHasKey('node2', $positions);

        // Test freeform preserves positions
        $nodesWithPositions = [
            ['record_id' => 'node1', 'x' => 100, 'y' => 200],
            ['record_id' => 'node2', 'x' => 300, 'y' => 400],
        ];
        $positions = $this->service->calculateLayout('freeform', $nodesWithPositions, []);
        $this->assertEquals(100.0, $positions['node1']['x']);
        $this->assertEquals(200.0, $positions['node1']['y']);
    }

    /** @test */
    public function it_handles_unknown_layout_type_as_freeform()
    {
        $nodes = [
            ['record_id' => 'node1', 'x' => 50, 'y' => 75],
        ];

        $positions = $this->service->calculateLayout('unknown', $nodes, []);

        // Unknown layout should preserve positions like freeform
        $this->assertEquals(50.0, $positions['node1']['x']);
        $this->assertEquals(75.0, $positions['node1']['y']);
    }
}
