<?php

namespace NewSolari\Investigations\Services;

use NewSolari\Investigations\Models\Investigation;

/**
 * Service for calculating node positions using various layout algorithms.
 *
 * Supported layouts:
 * - Grid: Arranges nodes in a square grid pattern
 * - Hierarchical: Tree structure based on connection depth
 * - Radial: Concentric circles from center node
 * - Timeline: Horizontal arrangement by date/order
 * - Force-directed: Physics simulation with spring forces
 * - Freeform: Preserves existing positions
 */
class LayoutService
{
    /**
     * Default layout parameters.
     * Minimum gap ensures nodes never touch.
     */
    protected array $defaults = [
        'padding' => 50.0,
        'node_width' => 200.0,
        'node_height' => 100.0,
        'spacing' => 100.0,
        'min_gap' => 30.0, // Minimum 30px between nodes
        'canvas_width' => 2000.0, // Larger canvas for more room
        'canvas_height' => 1500.0,
    ];

    /**
     * Calculate node positions based on layout algorithm.
     *
     * @param string $layoutType The layout algorithm to use
     * @param array $nodes Array of node data
     * @param array $connections Array of connection data
     * @param array $options Layout options (padding, node_width, etc.)
     * @return array Node positions keyed by record_id
     */
    public function calculateLayout(string $layoutType, array $nodes, array $connections, array $options = []): array
    {
        if (empty($nodes)) {
            return [];
        }

        // Merge options with defaults
        $opts = array_merge($this->defaults, $options);
        $padding = (float) $opts['padding'];
        $nodeWidth = (float) $opts['node_width'];
        $nodeHeight = (float) $opts['node_height'];
        $spacing = (float) $opts['spacing'];

        return match ($layoutType) {
            Investigation::LAYOUT_GRID => $this->calculateGridLayout($nodes, $nodeWidth, $nodeHeight, $spacing, $padding),
            Investigation::LAYOUT_HIERARCHICAL => $this->calculateHierarchicalLayout($nodes, $connections, $nodeWidth, $nodeHeight, $spacing, $padding),
            Investigation::LAYOUT_RADIAL => $this->calculateRadialLayout($nodes, $connections, $padding),
            Investigation::LAYOUT_TIMELINE => $this->calculateTimelineLayout($nodes, $nodeWidth, $nodeHeight, $spacing, $padding),
            Investigation::LAYOUT_FORCE => $this->calculateForceDirectedLayout($nodes, $connections, $opts),
            default => $this->preservePositions($nodes),
        };
    }

    /**
     * Preserve existing node positions (freeform layout).
     */
    public function preservePositions(array $nodes): array
    {
        $positions = [];
        foreach ($nodes as $node) {
            $positions[$node['record_id']] = [
                'x' => (float) ($node['x'] ?? 0),
                'y' => (float) ($node['y'] ?? 0),
            ];
        }
        return $positions;
    }

    /**
     * Calculate grid layout positions.
     * Arranges nodes in a square grid pattern with guaranteed minimum gap.
     */
    public function calculateGridLayout(
        array $nodes,
        float $nodeWidth = 200,
        float $nodeHeight = 100,
        float $spacing = 50,
        float $padding = 50
    ): array {
        $positions = [];
        $nodeCount = count($nodes);

        if ($nodeCount === 0) {
            return $positions;
        }

        // Ensure minimum gap of 30px between nodes
        $minGap = max(30, $spacing);
        $columns = max(1, (int) ceil(sqrt($nodeCount)));
        $cellWidth = $nodeWidth + $minGap;
        $cellHeight = $nodeHeight + $minGap;

        foreach ($nodes as $index => $node) {
            $col = $index % $columns;
            $row = (int) floor($index / $columns);

            $positions[$node['record_id']] = [
                'x' => $padding + ($col * $cellWidth),
                'y' => $padding + ($row * $cellHeight),
            ];
        }

        return $positions;
    }

    /**
     * Calculate hierarchical layout positions.
     * Places nodes in levels based on connection depth using BFS.
     */
    public function calculateHierarchicalLayout(
        array $nodes,
        array $connections,
        float $nodeWidth = 200,
        float $nodeHeight = 100,
        float $spacing = 50,
        float $padding = 50
    ): array {
        $positions = [];

        if (empty($nodes)) {
            return $positions;
        }

        // Build adjacency lists
        $incoming = [];
        $outgoing = [];
        foreach ($connections as $conn) {
            $outgoing[$conn['from_node_id']][] = $conn['to_node_id'];
            $incoming[$conn['to_node_id']][] = $conn['from_node_id'];
        }

        // Find root nodes (no incoming connections)
        $roots = [];
        foreach ($nodes as $node) {
            if (empty($incoming[$node['record_id']])) {
                $roots[] = $node['record_id'];
            }
        }

        // If no roots found, use first node
        if (empty($roots)) {
            $roots[] = $nodes[0]['record_id'];
        }

        // BFS to assign levels
        $levels = [];
        $visited = [];
        $queue = [];
        foreach ($roots as $root) {
            $queue[] = ['id' => $root, 'level' => 0];
        }

        while (!empty($queue)) {
            $current = array_shift($queue);
            $nodeId = $current['id'];
            $level = $current['level'];

            if (isset($visited[$nodeId])) {
                continue;
            }
            $visited[$nodeId] = true;
            $levels[$level][] = $nodeId;

            foreach ($outgoing[$nodeId] ?? [] as $childId) {
                if (!isset($visited[$childId])) {
                    $queue[] = ['id' => $childId, 'level' => $level + 1];
                }
            }
        }

        // Add unvisited nodes to the last level
        foreach ($nodes as $node) {
            if (!isset($visited[$node['record_id']])) {
                $maxLevel = empty($levels) ? 0 : max(array_keys($levels));
                $levels[$maxLevel][] = $node['record_id'];
            }
        }

        // Calculate positions with generous spacing for connections
        // Ensure minimum 30px gap between nodes
        $minGap = max(30, $spacing);
        $horizontalSpacing = $nodeWidth + $minGap * 2; // More room for horizontal connections
        $levelHeight = $nodeHeight + $minGap * 3; // More room for vertical connections

        foreach ($levels as $level => $nodeIds) {
            // Center nodes within their level
            $levelWidth = count($nodeIds) * $horizontalSpacing;
            $startX = $padding;

            foreach ($nodeIds as $index => $nodeId) {
                $positions[$nodeId] = [
                    'x' => $startX + ($index * $horizontalSpacing),
                    'y' => $padding + ($level * $levelHeight),
                ];
            }
        }

        return $positions;
    }

    /**
     * Calculate radial layout positions.
     * Places nodes in concentric circles from a center node.
     * Uses BFS to organize nodes by connection depth from center.
     */
    public function calculateRadialLayout(
        array $nodes,
        array $connections,
        float $padding = 50
    ): array {
        $positions = [];
        $nodeCount = count($nodes);

        if ($nodeCount === 0) {
            return $positions;
        }

        $centerX = 600 + $padding;
        $centerY = 500 + $padding;
        $minGap = 30;
        $nodeWidth = 200;
        $nodeHeight = 100;

        // Calculate minimum radius to prevent overlap
        // For n nodes in a circle, arc length between nodes should be > node width + gap
        $minArcLength = $nodeWidth + $minGap * 2;

        // Build connection maps
        $incoming = [];
        $outgoing = [];
        foreach ($connections as $conn) {
            $incoming[$conn['to_node_id']][] = $conn['from_node_id'];
            $outgoing[$conn['from_node_id']][] = $conn['to_node_id'];
        }

        // Find center node (node with most total connections)
        $centerNode = null;
        $maxConnections = -1;
        foreach ($nodes as $node) {
            $connCount = count($incoming[$node['record_id']] ?? []) + count($outgoing[$node['record_id']] ?? []);
            if ($connCount > $maxConnections) {
                $centerNode = $node['record_id'];
                $maxConnections = $connCount;
            }
        }

        // Default to first node if no connections
        if ($centerNode === null) {
            $centerNode = $nodes[0]['record_id'];
        }

        // If only one node, place at center
        if ($nodeCount === 1) {
            $positions[$nodes[0]['record_id']] = ['x' => $centerX, 'y' => $centerY];
            return $positions;
        }

        // BFS to organize nodes by ring (distance from center)
        $rings = [];
        $visited = [$centerNode => true];
        $queue = [['id' => $centerNode, 'ring' => 0]];

        while (!empty($queue)) {
            $current = array_shift($queue);
            $nodeId = $current['id'];
            $ring = $current['ring'];

            $rings[$ring][] = $nodeId;

            // Add connected nodes to next ring
            $connected = array_merge(
                $outgoing[$nodeId] ?? [],
                $incoming[$nodeId] ?? []
            );

            foreach ($connected as $connId) {
                if (!isset($visited[$connId])) {
                    $visited[$connId] = true;
                    $queue[] = ['id' => $connId, 'ring' => $ring + 1];
                }
            }
        }

        // Add any unvisited nodes to the last ring
        foreach ($nodes as $node) {
            if (!isset($visited[$node['record_id']])) {
                $maxRing = empty($rings) ? 0 : max(array_keys($rings));
                $rings[$maxRing + 1][] = $node['record_id'];
            }
        }

        // Place center node
        $positions[$centerNode] = ['x' => $centerX, 'y' => $centerY];

        // Place nodes in concentric rings
        $baseRadius = max(300, $nodeWidth * 1.5 + $minGap); // Start with adequate radius
        $ringSpacing = max($nodeHeight + $minGap * 2, 150); // Space between rings

        ksort($rings);
        foreach ($rings as $ring => $nodeIds) {
            if ($ring === 0) continue; // Skip center node

            // Calculate radius for this ring
            $radius = $baseRadius + (($ring - 1) * $ringSpacing);

            // Ensure radius is large enough so nodes don't overlap
            // Arc length = 2*PI*r / n, must be > minArcLength
            $nodesInRing = count($nodeIds);
            $requiredRadius = ($nodesInRing * $minArcLength) / (2 * M_PI);
            $radius = max($radius, $requiredRadius);

            $angleStep = (2 * M_PI) / $nodesInRing;
            $startAngle = -M_PI / 2; // Start at top

            foreach ($nodeIds as $index => $nodeId) {
                $angle = $startAngle + ($index * $angleStep);
                $positions[$nodeId] = [
                    'x' => $centerX + $radius * cos($angle),
                    'y' => $centerY + $radius * sin($angle),
                ];
            }
        }

        return $positions;
    }

    /**
     * Calculate timeline layout positions.
     * Arranges nodes horizontally with guaranteed minimum gap.
     */
    public function calculateTimelineLayout(
        array $nodes,
        float $nodeWidth = 200,
        float $nodeHeight = 100,
        float $spacing = 50,
        float $padding = 50
    ): array {
        $positions = [];
        $minGap = max(30, $spacing);
        $timelineY = $padding + 100;
        $startX = $padding;
        $cellWidth = $nodeWidth + $minGap;

        foreach ($nodes as $index => $node) {
            $positions[$node['record_id']] = [
                'x' => $startX + ($index * $cellWidth),
                'y' => $timelineY,
            ];
        }

        return $positions;
    }

    /**
     * Calculate force-directed layout positions.
     * Uses Fruchterman-Reingold inspired physics simulation optimized for:
     * 1. Evenly spaced web-like distribution
     * 2. No node overlapping
     * 3. Minimal connection crossings
     * 4. Separate constellations for disconnected components
     */
    public function calculateForceDirectedLayout(
        array $nodes,
        array $connections,
        array $options = []
    ): array {
        $positions = [];
        $nodeCount = count($nodes);

        if ($nodeCount === 0) {
            return $positions;
        }

        // Node dimensions
        $nodeWidth = (float) ($options['node_width'] ?? 200);
        $nodeHeight = (float) ($options['node_height'] ?? 100);
        $minGap = 50.0; // Comfortable gap between nodes

        // Build adjacency data
        $adjacency = [];
        foreach ($nodes as $node) {
            $adjacency[$node['record_id']] = [];
        }
        foreach ($connections as $conn) {
            $from = $conn['from_node_id'];
            $to = $conn['to_node_id'];
            if (isset($adjacency[$from]) && isset($adjacency[$to])) {
                $adjacency[$from][] = $to;
                $adjacency[$to][] = $from;
            }
        }

        // Find connected components using BFS
        $components = $this->findConnectedComponents($nodes, $adjacency);

        // Lay out each component separately
        $componentPositions = [];
        $componentBounds = [];

        foreach ($components as $componentIndex => $componentNodeIds) {
            // Get nodes for this component
            $componentNodes = array_filter($nodes, function ($node) use ($componentNodeIds) {
                return in_array($node['record_id'], $componentNodeIds);
            });
            $componentNodes = array_values($componentNodes);

            // Get connections within this component
            $componentConnections = array_filter($connections, function ($conn) use ($componentNodeIds) {
                return in_array($conn['from_node_id'], $componentNodeIds)
                    && in_array($conn['to_node_id'], $componentNodeIds);
            });
            $componentConnections = array_values($componentConnections);

            // Lay out this component
            $compPositions = $this->layoutSingleComponent(
                $componentNodes,
                $componentConnections,
                $nodeWidth,
                $nodeHeight,
                $minGap
            );

            // Calculate bounds of this component
            $bounds = $this->calculateComponentBounds($compPositions, $componentNodes, $nodeWidth, $nodeHeight);
            $componentPositions[$componentIndex] = $compPositions;
            $componentBounds[$componentIndex] = $bounds;
        }

        // Arrange components so they don't overlap
        $arrangedPositions = $this->arrangeComponents(
            $componentPositions,
            $componentBounds,
            $minGap * 3 // Larger gap between constellations
        );

        // Normalize all positions to start near origin
        $minX = PHP_FLOAT_MAX;
        $minY = PHP_FLOAT_MAX;
        foreach ($arrangedPositions as $pos) {
            $minX = min($minX, $pos['x']);
            $minY = min($minY, $pos['y']);
        }

        $offsetX = 100 - $minX;
        $offsetY = 100 - $minY;

        foreach ($nodes as $node) {
            $id = $node['record_id'];
            $positions[$id] = [
                'x' => round($arrangedPositions[$id]['x'] + $offsetX, 2),
                'y' => round($arrangedPositions[$id]['y'] + $offsetY, 2),
            ];
        }

        return $positions;
    }

    /**
     * Find connected components in the graph using BFS.
     *
     * @return array Array of arrays, each containing node IDs in a component
     */
    protected function findConnectedComponents(array $nodes, array $adjacency): array
    {
        $visited = [];
        $components = [];

        foreach ($nodes as $node) {
            $nodeId = $node['record_id'];

            if (isset($visited[$nodeId])) {
                continue;
            }

            // BFS to find all nodes in this component
            $component = [];
            $queue = [$nodeId];
            $visited[$nodeId] = true;

            while (!empty($queue)) {
                $current = array_shift($queue);
                $component[] = $current;

                foreach ($adjacency[$current] ?? [] as $neighbor) {
                    if (!isset($visited[$neighbor])) {
                        $visited[$neighbor] = true;
                        $queue[] = $neighbor;
                    }
                }
            }

            $components[] = $component;
        }

        // Sort components by size (largest first) for better arrangement
        usort($components, function ($a, $b) {
            return count($b) - count($a);
        });

        return $components;
    }

    /**
     * Layout a single connected component using force-directed algorithm.
     */
    protected function layoutSingleComponent(
        array $nodes,
        array $connections,
        float $nodeWidth,
        float $nodeHeight,
        float $minGap
    ): array {
        $nodeCount = count($nodes);

        if ($nodeCount === 0) {
            return [];
        }

        // Single node - place at origin
        if ($nodeCount === 1) {
            return [
                $nodes[0]['record_id'] => [
                    'x' => 0.0,
                    'y' => 0.0,
                    'width' => (float) ($nodes[0]['width'] ?? $nodeWidth),
                    'height' => (float) ($nodes[0]['height'] ?? $nodeHeight),
                ]
            ];
        }

        // Calculate optimal area for this component
        $optimalArea = $nodeCount * ($nodeWidth + $minGap) * ($nodeHeight + $minGap) * 2.5;
        $optimalSize = sqrt($optimalArea);
        $width = max(800, $optimalSize);
        $height = max(600, $optimalSize * 0.75);

        // Fruchterman-Reingold parameters
        $iterations = 400;
        $k = sqrt(($width * $height) / $nodeCount) * 0.85;
        $temperature = $width / 8;
        $cooling = 0.95;

        $centerX = $width / 2;
        $centerY = $height / 2;
        $centerGravity = 0.08; // Gentle pull toward component center

        // Build degree map
        $degree = [];
        foreach ($nodes as $node) {
            $degree[$node['record_id']] = 0;
        }
        foreach ($connections as $conn) {
            if (isset($degree[$conn['from_node_id']])) {
                $degree[$conn['from_node_id']]++;
            }
            if (isset($degree[$conn['to_node_id']])) {
                $degree[$conn['to_node_id']]++;
            }
        }

        // Sort nodes by degree for initial placement
        $sortedNodes = $nodes;
        usort($sortedNodes, function ($a, $b) use ($degree) {
            return ($degree[$b['record_id']] ?? 0) - ($degree[$a['record_id']] ?? 0);
        });

        // Initialize positions in golden angle spiral
        $nodePositions = [];
        $placed = 0;

        foreach ($sortedNodes as $node) {
            $id = $node['record_id'];

            if ($placed === 0) {
                $x = $centerX;
                $y = $centerY;
            } else {
                $radius = 100 + ($placed * 40);
                $angle = $placed * 2.39996; // Golden angle
                $x = $centerX + $radius * cos($angle);
                $y = $centerY + $radius * sin($angle);
            }

            $nodePositions[$id] = [
                'x' => $x,
                'y' => $y,
                'dx' => 0.0,
                'dy' => 0.0,
                'width' => (float) ($node['width'] ?? $nodeWidth),
                'height' => (float) ($node['height'] ?? $nodeHeight),
            ];
            $placed++;
        }

        // Run force simulation
        for ($iter = 0; $iter < $iterations; $iter++) {
            // Reset displacements
            foreach ($nodePositions as &$pos) {
                $pos['dx'] = 0.0;
                $pos['dy'] = 0.0;
            }
            unset($pos);

            // Repulsive forces between all pairs
            foreach ($nodes as $i => $node1) {
                $id1 = $node1['record_id'];
                $pos1 = &$nodePositions[$id1];

                foreach ($nodes as $j => $node2) {
                    if ($i >= $j) continue;

                    $id2 = $node2['record_id'];
                    $pos2 = &$nodePositions[$id2];

                    $dx = $pos1['x'] - $pos2['x'];
                    $dy = $pos1['y'] - $pos2['y'];
                    $dist = sqrt($dx * $dx + $dy * $dy);

                    if ($dist < 0.01) {
                        $dx = (mt_rand() / mt_getrandmax() - 0.5) * 10;
                        $dy = (mt_rand() / mt_getrandmax() - 0.5) * 10;
                        $dist = sqrt($dx * $dx + $dy * $dy);
                    }

                    $minDist = (($pos1['width'] + $pos2['width']) / 2 + $minGap);
                    $repulsion = ($k * $k) / $dist;

                    if ($dist < $minDist) {
                        $repulsion *= 3.0 * ($minDist / $dist);
                    }

                    $fx = ($dx / $dist) * $repulsion;
                    $fy = ($dy / $dist) * $repulsion;

                    $pos1['dx'] += $fx;
                    $pos1['dy'] += $fy;
                    $pos2['dx'] -= $fx;
                    $pos2['dy'] -= $fy;
                }
                unset($pos2);
            }
            unset($pos1);

            // Attractive forces for connected nodes
            foreach ($connections as $conn) {
                $from = $conn['from_node_id'];
                $to = $conn['to_node_id'];

                if (!isset($nodePositions[$from]) || !isset($nodePositions[$to])) {
                    continue;
                }

                $pos1 = &$nodePositions[$from];
                $pos2 = &$nodePositions[$to];

                $dx = $pos1['x'] - $pos2['x'];
                $dy = $pos1['y'] - $pos2['y'];
                $dist = sqrt($dx * $dx + $dy * $dy);

                if ($dist < 0.01) continue;

                $idealDist = $k * 0.7;
                $minConnDist = (($pos1['width'] + $pos2['width']) / 2 + $minGap);

                if ($dist > $minConnDist) {
                    $attraction = ($dist * $dist) / $k;

                    if ($dist < $idealDist) {
                        $attraction *= 0.3;
                    }

                    $fx = ($dx / $dist) * $attraction;
                    $fy = ($dy / $dist) * $attraction;

                    $pos1['dx'] -= $fx;
                    $pos1['dy'] -= $fy;
                    $pos2['dx'] += $fx;
                    $pos2['dy'] += $fy;
                }

                unset($pos1, $pos2);
            }

            // Center gravity for this component
            foreach ($nodePositions as $id => &$pos) {
                $dx = $centerX - $pos['x'];
                $dy = $centerY - $pos['y'];
                $dist = sqrt($dx * $dx + $dy * $dy);

                if ($dist > 0.01) {
                    $pos['dx'] += $dx * $centerGravity;
                    $pos['dy'] += $dy * $centerGravity;
                }
            }
            unset($pos);

            // Apply displacements
            foreach ($nodePositions as $id => &$pos) {
                $disp = sqrt($pos['dx'] * $pos['dx'] + $pos['dy'] * $pos['dy']);

                if ($disp > 0.01) {
                    $limitedDisp = min($disp, $temperature);
                    $pos['x'] += ($pos['dx'] / $disp) * $limitedDisp;
                    $pos['y'] += ($pos['dy'] / $disp) * $limitedDisp;
                }
            }
            unset($pos);

            $temperature *= $cooling;

            if ($temperature < 0.5) {
                break;
            }
        }

        // Post-processing: enforce minimum gaps within component
        $this->enforceMinimumGap($nodePositions, $nodes, $minGap);

        return $nodePositions;
    }

    /**
     * Calculate bounding box for a component.
     */
    protected function calculateComponentBounds(
        array $positions,
        array $nodes,
        float $defaultWidth,
        float $defaultHeight
    ): array {
        $minX = PHP_FLOAT_MAX;
        $minY = PHP_FLOAT_MAX;
        $maxX = PHP_FLOAT_MIN;
        $maxY = PHP_FLOAT_MIN;

        foreach ($nodes as $node) {
            $id = $node['record_id'];
            if (!isset($positions[$id])) continue;

            $x = $positions[$id]['x'];
            $y = $positions[$id]['y'];
            $w = $positions[$id]['width'] ?? $defaultWidth;
            $h = $positions[$id]['height'] ?? $defaultHeight;

            $minX = min($minX, $x);
            $minY = min($minY, $y);
            $maxX = max($maxX, $x + $w);
            $maxY = max($maxY, $y + $h);
        }

        return [
            'minX' => $minX,
            'minY' => $minY,
            'maxX' => $maxX,
            'maxY' => $maxY,
            'width' => $maxX - $minX,
            'height' => $maxY - $minY,
        ];
    }

    /**
     * Arrange multiple components so they don't overlap.
     * Uses a simple row-based packing algorithm.
     */
    protected function arrangeComponents(
        array $componentPositions,
        array $componentBounds,
        float $componentGap
    ): array {
        $allPositions = [];
        $numComponents = count($componentPositions);

        if ($numComponents === 0) {
            return $allPositions;
        }

        // Single component - just normalize to origin
        if ($numComponents === 1) {
            $compPositions = reset($componentPositions);
            $bounds = reset($componentBounds);

            foreach ($compPositions as $nodeId => $pos) {
                $allPositions[$nodeId] = [
                    'x' => $pos['x'] - $bounds['minX'],
                    'y' => $pos['y'] - $bounds['minY'],
                ];
            }
            return $allPositions;
        }

        // Multiple components - arrange in rows
        // Calculate ideal row width based on total area
        $totalWidth = 0;
        $maxHeight = 0;
        foreach ($componentBounds as $bounds) {
            $totalWidth += $bounds['width'] + $componentGap;
            $maxHeight = max($maxHeight, $bounds['height']);
        }

        // Target roughly square arrangement
        $targetRowWidth = sqrt($totalWidth * $maxHeight) * 1.5;

        // Pack components into rows
        $currentX = 0;
        $currentY = 0;
        $rowHeight = 0;
        $componentIndex = 0;

        foreach ($componentPositions as $compIndex => $compPositions) {
            $bounds = $componentBounds[$compIndex];

            // Check if we need to start a new row
            if ($currentX > 0 && $currentX + $bounds['width'] > $targetRowWidth) {
                $currentX = 0;
                $currentY += $rowHeight + $componentGap;
                $rowHeight = 0;
            }

            // Calculate offset to move component to current position
            $offsetX = $currentX - $bounds['minX'];
            $offsetY = $currentY - $bounds['minY'];

            // Apply offset to all nodes in this component
            foreach ($compPositions as $nodeId => $pos) {
                $allPositions[$nodeId] = [
                    'x' => $pos['x'] + $offsetX,
                    'y' => $pos['y'] + $offsetY,
                ];
            }

            // Update position for next component
            $currentX += $bounds['width'] + $componentGap;
            $rowHeight = max($rowHeight, $bounds['height']);
            $componentIndex++;
        }

        return $allPositions;
    }

    /**
     * Post-processing to enforce minimum gap between all nodes.
     * Uses iterative axis-aligned separation to push overlapping nodes apart.
     * Runs until no overlaps remain.
     */
    protected function enforceMinimumGap(array &$nodePositions, array $nodes, float $minGap): void
    {
        $maxIterations = 100; // More iterations to ensure complete separation

        for ($iter = 0; $iter < $maxIterations; $iter++) {
            $hasOverlap = false;

            foreach ($nodes as $i => $node1) {
                $id1 = $node1['record_id'];

                foreach ($nodes as $j => $node2) {
                    if ($i >= $j) continue; // Only check each pair once

                    $id2 = $node2['record_id'];

                    // Get current positions and dimensions
                    $x1 = $nodePositions[$id1]['x'];
                    $y1 = $nodePositions[$id1]['y'];
                    $w1 = $nodePositions[$id1]['width'];
                    $h1 = $nodePositions[$id1]['height'];

                    $x2 = $nodePositions[$id2]['x'];
                    $y2 = $nodePositions[$id2]['y'];
                    $w2 = $nodePositions[$id2]['width'];
                    $h2 = $nodePositions[$id2]['height'];

                    // Calculate required separation on each axis
                    // Node 1 right edge + gap should be <= Node 2 left edge (or vice versa)
                    // Node 1 bottom edge + gap should be <= Node 2 top edge (or vice versa)

                    // Calculate the gap between nodes on each axis
                    $gapX = max($x2 - ($x1 + $w1), $x1 - ($x2 + $w2));
                    $gapY = max($y2 - ($y1 + $h1), $y1 - ($y2 + $h2));

                    // If either gap is >= minGap, nodes don't overlap
                    if ($gapX >= $minGap || $gapY >= $minGap) {
                        continue;
                    }

                    // Nodes are overlapping or too close
                    $hasOverlap = true;

                    // Calculate how much to push apart on each axis
                    $pushNeededX = $minGap - $gapX;
                    $pushNeededY = $minGap - $gapY;

                    // Determine push direction based on center positions
                    $centerX1 = $x1 + $w1 / 2;
                    $centerY1 = $y1 + $h1 / 2;
                    $centerX2 = $x2 + $w2 / 2;
                    $centerY2 = $y2 + $h2 / 2;

                    // Push along the axis with less overlap (easier to resolve)
                    // This reduces line crossings by preferring horizontal or vertical separation
                    if ($pushNeededX <= $pushNeededY) {
                        // Push horizontally
                        $pushAmount = ($pushNeededX / 2) + 1;
                        if ($centerX1 < $centerX2) {
                            $nodePositions[$id1]['x'] -= $pushAmount;
                            $nodePositions[$id2]['x'] += $pushAmount;
                        } else {
                            $nodePositions[$id1]['x'] += $pushAmount;
                            $nodePositions[$id2]['x'] -= $pushAmount;
                        }
                    } else {
                        // Push vertically
                        $pushAmount = ($pushNeededY / 2) + 1;
                        if ($centerY1 < $centerY2) {
                            $nodePositions[$id1]['y'] -= $pushAmount;
                            $nodePositions[$id2]['y'] += $pushAmount;
                        } else {
                            $nodePositions[$id1]['y'] += $pushAmount;
                            $nodePositions[$id2]['y'] -= $pushAmount;
                        }
                    }
                }
            }

            if (!$hasOverlap) {
                break;
            }
        }
    }

    /**
     * Calculate canvas bounds from nodes and drawings.
     */
    public function calculateCanvasBounds(array $nodes, array $drawings = []): array
    {
        $minX = PHP_FLOAT_MAX;
        $minY = PHP_FLOAT_MAX;
        $maxX = PHP_FLOAT_MIN;
        $maxY = PHP_FLOAT_MIN;

        foreach ($nodes as $node) {
            $x = (float) ($node['x'] ?? 0);
            $y = (float) ($node['y'] ?? 0);
            $width = (float) ($node['width'] ?? 200);
            $height = (float) ($node['height'] ?? 100);

            $minX = min($minX, $x);
            $minY = min($minY, $y);
            $maxX = max($maxX, $x + $width);
            $maxY = max($maxY, $y + $height);
        }

        foreach ($drawings as $drawing) {
            if (isset($drawing['bounds'])) {
                $minX = min($minX, $drawing['bounds']['left'] ?? $minX);
                $minY = min($minY, $drawing['bounds']['top'] ?? $minY);
                $maxX = max($maxX, $drawing['bounds']['right'] ?? $maxX);
                $maxY = max($maxY, $drawing['bounds']['bottom'] ?? $maxY);
            }
        }

        // Handle empty canvas
        if ($minX === PHP_FLOAT_MAX) {
            return [
                'left' => 0,
                'top' => 0,
                'right' => 1000,
                'bottom' => 800,
                'width' => 1000,
                'height' => 800,
            ];
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
     * Get valid layout types.
     */
    public function getValidLayoutTypes(): array
    {
        return Investigation::VALID_LAYOUTS;
    }

    /**
     * Check if a layout type is valid.
     */
    public function isValidLayoutType(string $layoutType): bool
    {
        return in_array($layoutType, $this->getValidLayoutTypes());
    }
}
