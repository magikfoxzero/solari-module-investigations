<?php

namespace Tests\Unit\Services;

use NewSolari\Identity\Models\IdentityPartition;
use NewSolari\Identity\Models\IdentityUser;
use NewSolari\Investigations\InvestigationsPlugin;
use NewSolari\Investigations\Models\Investigation;
use NewSolari\Investigations\Models\InvestigationNode;
use NewSolari\Investigations\Services\TimelineService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TimelineServiceTest extends TestCase
{
    use RefreshDatabase;

    protected TimelineService $service;
    protected InvestigationsPlugin $plugin;
    protected $partition;
    protected $user;
    protected $investigation;

    protected function setUp(): void
    {
        parent::setUp();

        $this->plugin = new InvestigationsPlugin();
        $this->service = new TimelineService($this->plugin);

        $this->partition = IdentityPartition::create([
            'record_id' => 'timeline-test-partition',
            'name' => 'Timeline Test Partition',
            'description' => 'Test partition for timeline service tests',
        ]);

        $this->user = IdentityUser::create([
            'record_id' => 'timeline-test-user',
            'username' => 'timelinetestuser',
            'email' => 'timelinetest@example.com',
            'password_hash' => 'password',
            'partition_id' => $this->partition->record_id,
            'is_active' => true,
        ]);
        $this->user->setSystemUser(true);

        $this->investigation = Investigation::create([
            'record_id' => 'timeline-test-investigation',
            'title' => 'Timeline Test Investigation',
            'case_number' => 'CASE-TIMELINE-001',
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
            'is_public' => true,
        ]);
    }

    /** @test */
    public function it_extracts_empty_timeline_for_investigation_without_nodes()
    {
        $result = $this->service->extractTimeline($this->investigation, $this->user);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('events', $result);
        $this->assertArrayHasKey('count', $result);
        $this->assertArrayHasKey('date_range', $result);
        $this->assertEmpty($result['events']);
        $this->assertEquals(0, $result['count']);
    }

    /** @test */
    public function it_groups_events_by_day()
    {
        $events = [
            ['node_id' => 'node1', 'date' => '2024-01-15T10:00:00Z', 'label' => 'Event 1'],
            ['node_id' => 'node2', 'date' => '2024-01-15T14:00:00Z', 'label' => 'Event 2'],
            ['node_id' => 'node3', 'date' => '2024-01-16T09:00:00Z', 'label' => 'Event 3'],
        ];

        $grouped = $this->service->groupEventsByPeriod($events, 'day');

        $this->assertCount(2, $grouped);
        $this->assertEquals('2024-01-15', $grouped[0]['period']);
        $this->assertEquals(2, $grouped[0]['count']);
        $this->assertEquals('2024-01-16', $grouped[1]['period']);
        $this->assertEquals(1, $grouped[1]['count']);
    }

    /** @test */
    public function it_groups_events_by_week()
    {
        $events = [
            ['node_id' => 'node1', 'date' => '2024-01-15T10:00:00Z', 'label' => 'Event 1'],
            ['node_id' => 'node2', 'date' => '2024-01-17T10:00:00Z', 'label' => 'Event 2'],
            ['node_id' => 'node3', 'date' => '2024-01-22T10:00:00Z', 'label' => 'Event 3'],
        ];

        $grouped = $this->service->groupEventsByPeriod($events, 'week');

        $this->assertCount(2, $grouped);
        // Events in the same week should be grouped together
        $this->assertEquals(2, $grouped[0]['count']);
        $this->assertEquals(1, $grouped[1]['count']);
    }

    /** @test */
    public function it_groups_events_by_month()
    {
        $events = [
            ['node_id' => 'node1', 'date' => '2024-01-15T10:00:00Z', 'label' => 'Event 1'],
            ['node_id' => 'node2', 'date' => '2024-01-25T10:00:00Z', 'label' => 'Event 2'],
            ['node_id' => 'node3', 'date' => '2024-02-10T10:00:00Z', 'label' => 'Event 3'],
        ];

        $grouped = $this->service->groupEventsByPeriod($events, 'month');

        $this->assertCount(2, $grouped);
        $this->assertEquals('2024-01', $grouped[0]['period']);
        $this->assertEquals(2, $grouped[0]['count']);
        $this->assertEquals('2024-02', $grouped[1]['period']);
        $this->assertEquals(1, $grouped[1]['count']);
    }

    /** @test */
    public function it_groups_events_by_year()
    {
        $events = [
            ['node_id' => 'node1', 'date' => '2023-06-15T10:00:00Z', 'label' => 'Event 1'],
            ['node_id' => 'node2', 'date' => '2024-01-15T10:00:00Z', 'label' => 'Event 2'],
            ['node_id' => 'node3', 'date' => '2024-12-15T10:00:00Z', 'label' => 'Event 3'],
        ];

        $grouped = $this->service->groupEventsByPeriod($events, 'year');

        $this->assertCount(2, $grouped);
        $this->assertEquals('2023', $grouped[0]['period']);
        $this->assertEquals(1, $grouped[0]['count']);
        $this->assertEquals('2024', $grouped[1]['period']);
        $this->assertEquals(2, $grouped[1]['count']);
    }

    /** @test */
    public function it_returns_empty_array_when_grouping_empty_events()
    {
        $grouped = $this->service->groupEventsByPeriod([], 'day');
        $this->assertEmpty($grouped);
    }

    /** @test */
    public function it_skips_events_with_invalid_dates_when_grouping()
    {
        $events = [
            ['node_id' => 'node1', 'date' => '2024-01-15T10:00:00Z', 'label' => 'Event 1'],
            ['node_id' => 'node2', 'date' => 'invalid-date', 'label' => 'Event 2'],
            ['node_id' => 'node3', 'date' => '2024-01-16T10:00:00Z', 'label' => 'Event 3'],
        ];

        $grouped = $this->service->groupEventsByPeriod($events, 'day');

        // Should only have 2 groups (invalid date is skipped)
        $this->assertCount(2, $grouped);
    }

    /** @test */
    public function it_filters_events_by_date_range()
    {
        $events = [
            ['node_id' => 'node1', 'date' => '2024-01-10T10:00:00Z', 'label' => 'Event 1'],
            ['node_id' => 'node2', 'date' => '2024-01-15T10:00:00Z', 'label' => 'Event 2'],
            ['node_id' => 'node3', 'date' => '2024-01-20T10:00:00Z', 'label' => 'Event 3'],
            ['node_id' => 'node4', 'date' => '2024-01-25T10:00:00Z', 'label' => 'Event 4'],
        ];

        $filtered = $this->service->filterByDateRange($events, '2024-01-12', '2024-01-22');

        $this->assertCount(2, $filtered);
        $this->assertEquals('node2', $filtered[0]['node_id']);
        $this->assertEquals('node3', $filtered[1]['node_id']);
    }

    /** @test */
    public function it_filters_events_with_only_start_date()
    {
        $events = [
            ['node_id' => 'node1', 'date' => '2024-01-10T10:00:00Z', 'label' => 'Event 1'],
            ['node_id' => 'node2', 'date' => '2024-01-15T10:00:00Z', 'label' => 'Event 2'],
            ['node_id' => 'node3', 'date' => '2024-01-20T10:00:00Z', 'label' => 'Event 3'],
        ];

        $filtered = $this->service->filterByDateRange($events, '2024-01-12', null);

        $this->assertCount(2, $filtered);
        $this->assertEquals('node2', $filtered[0]['node_id']);
        $this->assertEquals('node3', $filtered[1]['node_id']);
    }

    /** @test */
    public function it_filters_events_with_only_end_date()
    {
        $events = [
            ['node_id' => 'node1', 'date' => '2024-01-10T10:00:00Z', 'label' => 'Event 1'],
            ['node_id' => 'node2', 'date' => '2024-01-15T10:00:00Z', 'label' => 'Event 2'],
            ['node_id' => 'node3', 'date' => '2024-01-20T10:00:00Z', 'label' => 'Event 3'],
        ];

        $filtered = $this->service->filterByDateRange($events, null, '2024-01-17');

        $this->assertCount(2, $filtered);
        $this->assertEquals('node1', $filtered[0]['node_id']);
        $this->assertEquals('node2', $filtered[1]['node_id']);
    }

    /** @test */
    public function it_returns_all_events_without_date_filter()
    {
        $events = [
            ['node_id' => 'node1', 'date' => '2024-01-10T10:00:00Z', 'label' => 'Event 1'],
            ['node_id' => 'node2', 'date' => '2024-01-15T10:00:00Z', 'label' => 'Event 2'],
        ];

        $filtered = $this->service->filterByDateRange($events, null, null);

        $this->assertCount(2, $filtered);
    }

    /** @test */
    public function it_calculates_timeline_positions()
    {
        $events = [
            ['node_id' => 'node1', 'date' => '2024-01-01T10:00:00Z'],
            ['node_id' => 'node2', 'date' => '2024-01-15T10:00:00Z'],
            ['node_id' => 'node3', 'date' => '2024-01-31T10:00:00Z'],
        ];

        $positions = $this->service->calculateTimelinePositions($events, 0, 1000);

        $this->assertCount(3, $positions);

        // First event should be at startX
        $this->assertEquals(0, $positions['node1']);

        // Last event should be at endX
        $this->assertEquals(1000, $positions['node3']);

        // Middle event should be somewhere in between
        $this->assertGreaterThan($positions['node1'], $positions['node2']);
        $this->assertLessThan($positions['node3'], $positions['node2']);
    }

    /** @test */
    public function it_distributes_events_evenly_when_same_day()
    {
        $events = [
            ['node_id' => 'node1', 'date' => '2024-01-15T10:00:00Z'],
            ['node_id' => 'node2', 'date' => '2024-01-15T14:00:00Z'],
            ['node_id' => 'node3', 'date' => '2024-01-15T18:00:00Z'],
        ];

        $positions = $this->service->calculateTimelinePositions($events, 50, 950);

        $this->assertCount(3, $positions);

        // Events on same day should be evenly spaced
        $spacing = ($positions['node2'] - $positions['node1']);
        $this->assertEqualsWithDelta($spacing, $positions['node3'] - $positions['node2'], 0.01);
    }

    /** @test */
    public function it_returns_empty_positions_for_empty_events()
    {
        $positions = $this->service->calculateTimelinePositions([]);
        $this->assertEmpty($positions);
    }

    /** @test */
    public function it_includes_period_dates_in_grouped_events()
    {
        $events = [
            ['node_id' => 'node1', 'date' => '2024-01-15T10:00:00Z', 'label' => 'Event 1'],
        ];

        $grouped = $this->service->groupEventsByPeriod($events, 'month');

        $this->assertArrayHasKey('start_date', $grouped[0]);
        $this->assertArrayHasKey('end_date', $grouped[0]);
        $this->assertArrayHasKey('events', $grouped[0]);
        $this->assertArrayHasKey('count', $grouped[0]);
    }
}
