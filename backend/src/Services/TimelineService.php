<?php

namespace NewSolari\Investigations\Services;

use NewSolari\Identity\Models\IdentityUser;
use NewSolari\Investigations\InvestigationsPlugin;
use NewSolari\Investigations\Models\Investigation;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Service for extracting and processing timeline data from investigation entities.
 *
 * This service handles:
 * - Extracting date fields from linked entities
 * - Sorting events chronologically
 * - Calculating date ranges
 * - Supporting timeline zoom levels
 */
class TimelineService
{
    protected InvestigationsPlugin $plugin;

    public function __construct(InvestigationsPlugin $plugin)
    {
        $this->plugin = $plugin;
    }

    /**
     * Extract timeline events from an investigation's linked entities.
     *
     * @param Investigation $investigation The investigation to extract events from
     * @param IdentityUser $user The user requesting the data (for access filtering)
     * @return array Timeline data including events, count, and date range
     */
    public function extractTimeline(Investigation $investigation, IdentityUser $user): array
    {
        $timelineDateFields = $this->plugin->getTimelineDateFields();
        $events = [];

        // Get visible nodes for this user
        $visibleNodes = $this->plugin->getVisibleNodesForUser($investigation->nodes, $user);

        foreach ($visibleNodes as $node) {
            $nodeEvents = $this->extractEventsFromNode($node, $timelineDateFields);
            $events = array_merge($events, $nodeEvents);
        }

        // Sort by date
        usort($events, fn($a, $b) => strcmp($a['date'], $b['date']));

        // Calculate date range
        $dateRange = $this->calculateDateRange($events);

        return [
            'events' => $events,
            'count' => count($events),
            'date_range' => $dateRange,
        ];
    }

    /**
     * Extract timeline events from a single node.
     *
     * @param array $node The node data
     * @param array $timelineDateFields Mapping of entity types to date fields
     * @return array Events extracted from this node
     */
    protected function extractEventsFromNode(array $node, array $timelineDateFields): array
    {
        $events = [];
        $entityType = $node['entity_type'];
        $entityId = $node['entity_id'];

        // Get date fields for this entity type
        $dateFields = $timelineDateFields[$entityType] ?? [];
        if (empty($dateFields)) {
            return $events;
        }

        // Resolve the entity to get its data
        $entity = $this->plugin->resolveEntity($entityType, $entityId);
        if (!$entity) {
            return $events;
        }

        // Extract timeline dates
        foreach ($dateFields as $field) {
            $dateValue = $entity->$field ?? null;
            if ($dateValue) {
                $dateString = $this->formatDate($dateValue);

                $events[] = [
                    'node_id' => $node['record_id'],
                    'entity_type' => $entityType,
                    'entity_id' => $entityId,
                    'date' => $dateString,
                    'date_field' => $field,
                    'label' => $node['label_override'] ?? $entity->name ?? $entity->title ?? 'Unknown',
                    'x' => $node['x'],
                    'y' => $node['y'],
                ];
            }
        }

        return $events;
    }

    /**
     * Format a date value to ISO8601 string.
     *
     * @param mixed $dateValue The date value to format
     * @return string ISO8601 formatted date string
     */
    protected function formatDate($dateValue): string
    {
        if ($dateValue instanceof Carbon || $dateValue instanceof \DateTime) {
            return $dateValue->toIso8601String();
        }

        // Try to parse as Carbon if it's a string
        if (is_string($dateValue)) {
            try {
                return Carbon::parse($dateValue)->toIso8601String();
            } catch (\Exception $e) {
                return $dateValue;
            }
        }

        return (string) $dateValue;
    }

    /**
     * Calculate the date range from a list of events.
     *
     * @param array $events Sorted array of events
     * @return array Date range with min and max
     */
    protected function calculateDateRange(array $events): array
    {
        if (empty($events)) {
            return [
                'min' => null,
                'max' => null,
                'span_days' => 0,
            ];
        }

        $minDate = $events[0]['date'];
        $maxDate = $events[count($events) - 1]['date'];

        // Calculate span in days
        $spanDays = 0;
        try {
            $start = Carbon::parse($minDate);
            $end = Carbon::parse($maxDate);
            $spanDays = $start->diffInDays($end);
        } catch (\Exception $e) {
            // Ignore parsing errors
        }

        return [
            'min' => $minDate,
            'max' => $maxDate,
            'span_days' => $spanDays,
        ];
    }

    /**
     * Group timeline events by time period for zoom levels.
     *
     * @param array $events The events to group
     * @param string $period The period to group by (day, week, month, year)
     * @return array Grouped events
     */
    public function groupEventsByPeriod(array $events, string $period = 'day'): array
    {
        $grouped = [];

        foreach ($events as $event) {
            try {
                $date = Carbon::parse($event['date']);

                $key = match ($period) {
                    'year' => $date->format('Y'),
                    'month' => $date->format('Y-m'),
                    'week' => $date->format('Y-W'),
                    'day' => $date->format('Y-m-d'),
                    default => $date->format('Y-m-d'),
                };

                if (!isset($grouped[$key])) {
                    $grouped[$key] = [
                        'period' => $key,
                        'start_date' => $this->getPeriodStart($date, $period),
                        'end_date' => $this->getPeriodEnd($date, $period),
                        'events' => [],
                        'count' => 0,
                    ];
                }

                $grouped[$key]['events'][] = $event;
                $grouped[$key]['count']++;
            } catch (\Exception $e) {
                // Skip events with unparseable dates
                continue;
            }
        }

        return array_values($grouped);
    }

    /**
     * Get the start date for a period.
     */
    protected function getPeriodStart(Carbon $date, string $period): string
    {
        return match ($period) {
            'year' => $date->copy()->startOfYear()->toIso8601String(),
            'month' => $date->copy()->startOfMonth()->toIso8601String(),
            'week' => $date->copy()->startOfWeek()->toIso8601String(),
            'day' => $date->copy()->startOfDay()->toIso8601String(),
            default => $date->copy()->startOfDay()->toIso8601String(),
        };
    }

    /**
     * Get the end date for a period.
     */
    protected function getPeriodEnd(Carbon $date, string $period): string
    {
        return match ($period) {
            'year' => $date->copy()->endOfYear()->toIso8601String(),
            'month' => $date->copy()->endOfMonth()->toIso8601String(),
            'week' => $date->copy()->endOfWeek()->toIso8601String(),
            'day' => $date->copy()->endOfDay()->toIso8601String(),
            default => $date->copy()->endOfDay()->toIso8601String(),
        };
    }

    /**
     * Filter events by date range.
     *
     * @param array $events The events to filter
     * @param string|null $startDate Start date (ISO8601)
     * @param string|null $endDate End date (ISO8601)
     * @return array Filtered events
     */
    public function filterByDateRange(array $events, ?string $startDate = null, ?string $endDate = null): array
    {
        if (!$startDate && !$endDate) {
            return $events;
        }

        $start = $startDate ? Carbon::parse($startDate) : null;
        $end = $endDate ? Carbon::parse($endDate) : null;

        return array_values(array_filter($events, function ($event) use ($start, $end) {
            try {
                $eventDate = Carbon::parse($event['date']);

                if ($start && $eventDate->lt($start)) {
                    return false;
                }
                if ($end && $eventDate->gt($end)) {
                    return false;
                }

                return true;
            } catch (\Exception $e) {
                return false;
            }
        }));
    }

    /**
     * Get timeline positions for nodes based on their dates.
     * This can be used to position nodes on a timeline layout.
     *
     * @param array $events The timeline events
     * @param float $startX Starting X position
     * @param float $endX Ending X position
     * @return array Node positions keyed by node_id
     */
    public function calculateTimelinePositions(array $events, float $startX = 50, float $endX = 1000): array
    {
        if (empty($events)) {
            return [];
        }

        $positions = [];
        $dateRange = $this->calculateDateRange($events);

        if (!$dateRange['min'] || !$dateRange['max'] || $dateRange['span_days'] === 0) {
            // All events on same day, space evenly
            $spacing = ($endX - $startX) / max(1, count($events) - 1);
            foreach ($events as $index => $event) {
                $positions[$event['node_id']] = $startX + ($index * $spacing);
            }
            return $positions;
        }

        try {
            $minDate = Carbon::parse($dateRange['min']);
            $totalSpan = $dateRange['span_days'];
            $xRange = $endX - $startX;

            foreach ($events as $event) {
                $eventDate = Carbon::parse($event['date']);
                $daysFromStart = $minDate->diffInDays($eventDate);
                $ratio = $daysFromStart / $totalSpan;
                $positions[$event['node_id']] = $startX + ($ratio * $xRange);
            }
        } catch (\Exception $e) {
            // Fallback to even spacing
            $spacing = ($endX - $startX) / max(1, count($events) - 1);
            foreach ($events as $index => $event) {
                $positions[$event['node_id']] = $startX + ($index * $spacing);
            }
        }

        return $positions;
    }
}
