import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import type { LinkableEntityType } from '@/modules/investigations/types';

// Sanitize text to prevent XSS - strips HTML tags and limits length
function sanitizeText(text: string | null | undefined, maxLength = 500): string {
  if (!text) return '';
  return String(text).replace(/<[^>]*>/g, '').slice(0, maxLength);
}

// Simple in-memory cache for entity preview data with TTL
interface CacheEntry {
  data: Record<string, unknown>;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const entityPreviewCache = new Map<string, CacheEntry>();

function getCacheKey(entityType: LinkableEntityType, entityId: string): string {
  return `${entityType}:${entityId}`;
}

function getCachedData(entityType: LinkableEntityType, entityId: string): Record<string, unknown> | null {
  const key = getCacheKey(entityType, entityId);
  const entry = entityPreviewCache.get(key);

  if (!entry) return null;

  // Check if cache has expired
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    entityPreviewCache.delete(key);
    return null;
  }

  return entry.data;
}

function setCachedData(entityType: LinkableEntityType, entityId: string, data: Record<string, unknown>): void {
  const key = getCacheKey(entityType, entityId);
  entityPreviewCache.set(key, {
    data,
    timestamp: Date.now(),
  });

  // Clean up old entries periodically (keep cache from growing unbounded)
  if (entityPreviewCache.size > 200) {
    const now = Date.now();
    for (const [k, v] of entityPreviewCache.entries()) {
      if (now - v.timestamp > CACHE_TTL_MS) {
        entityPreviewCache.delete(k);
      }
    }
  }
}

// Import fetch APIs
import { getPerson } from '@/modules/people/api';
import { getEntity } from '@/modules/entities/api';
import { getNote } from '@/modules/notes/api';
import { getTask } from '@/modules/tasks/api';
import { getEvent } from '@/modules/events/api';
import { getPlace } from '@/modules/places/api';
import { getHypothesis } from '@/modules/hypotheses/api';
import { getMotive } from '@/modules/motives/api';
import { getInventoryObject } from '@/modules/inventory/api';
import { getFile } from '@/modules/files/api';
import { getTag } from '@/modules/tags/api';

interface EntityPreviewProps {
  entityType: LinkableEntityType;
  entityId: string;
}

// Get fetch function for entity type
function getFetchFn(entityType: LinkableEntityType): ((id: string) => Promise<unknown>) | null {
  switch (entityType) {
    case 'person': return getPerson;
    case 'entity': return getEntity;
    case 'note': return getNote;
    case 'task': return getTask;
    case 'event': return getEvent;
    case 'place': return getPlace;
    case 'hypothesis': return getHypothesis;
    case 'motive': return getMotive;
    case 'inventory_object': return getInventoryObject;
    case 'file': return getFile;
    case 'tag': return getTag;
    default: return null;
  }
}

// Preview field type
interface PreviewField {
  label: string;
  value: string | null | undefined;
}

// Extract preview fields based on entity type
function extractPreviewFields(entityType: LinkableEntityType, data: Record<string, unknown>): PreviewField[] {
  const fields: PreviewField[] = [];

  switch (entityType) {
    case 'person':
      if (data.email) fields.push({ label: 'Email', value: String(data.email) });
      if (data.phone) fields.push({ label: 'Phone', value: String(data.phone) });
      if (data.title) fields.push({ label: 'Title', value: String(data.title) });
      if (data.company) fields.push({ label: 'Company', value: String(data.company) });
      if (data.address) fields.push({ label: 'Address', value: String(data.address) });
      break;

    case 'entity':
      if (data.entity_type) fields.push({ label: 'Type', value: String(data.entity_type) });
      if (data.industry) fields.push({ label: 'Industry', value: String(data.industry) });
      if (data.website) fields.push({ label: 'Website', value: String(data.website) });
      if (data.email) fields.push({ label: 'Email', value: String(data.email) });
      if (data.phone) fields.push({ label: 'Phone', value: String(data.phone) });
      break;

    case 'note':
      if (data.content) {
        const content = String(data.content);
        fields.push({ label: 'Content', value: content.length > 200 ? content.slice(0, 200) + '...' : content });
      }
      if (data.tags && Array.isArray(data.tags)) {
        fields.push({ label: 'Tags', value: data.tags.join(', ') });
      }
      break;

    case 'task':
      if (data.status) fields.push({ label: 'Status', value: String(data.status) });
      if (data.priority) fields.push({ label: 'Priority', value: String(data.priority) });
      if (data.due_date) fields.push({ label: 'Due Date', value: formatDate(data.due_date) });
      if (data.description) {
        const desc = String(data.description);
        fields.push({ label: 'Description', value: desc.length > 150 ? desc.slice(0, 150) + '...' : desc });
      }
      break;

    case 'event':
      if (data.event_type) fields.push({ label: 'Type', value: String(data.event_type) });
      if (data.start_date) fields.push({ label: 'Start', value: formatDate(data.start_date) });
      if (data.end_date) fields.push({ label: 'End', value: formatDate(data.end_date) });
      if (data.location) fields.push({ label: 'Location', value: String(data.location) });
      break;

    case 'place':
      if (data.place_type) fields.push({ label: 'Type', value: String(data.place_type) });
      if (data.address) fields.push({ label: 'Address', value: String(data.address) });
      if (data.city) fields.push({ label: 'City', value: String(data.city) });
      if (data.country) fields.push({ label: 'Country', value: String(data.country) });
      break;

    case 'hypothesis':
      if (data.status) fields.push({ label: 'Status', value: String(data.status) });
      if (data.confidence) fields.push({ label: 'Confidence', value: `${data.confidence}%` });
      if (data.description) {
        const desc = String(data.description);
        fields.push({ label: 'Description', value: desc.length > 150 ? desc.slice(0, 150) + '...' : desc });
      }
      break;

    case 'motive':
      if (data.motive_type) fields.push({ label: 'Type', value: String(data.motive_type) });
      if (data.strength) fields.push({ label: 'Strength', value: String(data.strength) });
      if (data.description) {
        const desc = String(data.description);
        fields.push({ label: 'Description', value: desc.length > 150 ? desc.slice(0, 150) + '...' : desc });
      }
      break;

    case 'inventory_object':
      if (data.condition) fields.push({ label: 'Condition', value: String(data.condition) });
      if (data.quantity) fields.push({ label: 'Quantity', value: String(data.quantity) });
      if (data.location) fields.push({ label: 'Location', value: String(data.location) });
      if (data.serial_number) fields.push({ label: 'Serial #', value: String(data.serial_number) });
      break;

    case 'file':
      if (data.original_filename) fields.push({ label: 'Filename', value: String(data.original_filename) });
      if (data.mime_type) fields.push({ label: 'Type', value: String(data.mime_type) });
      if (data.file_size) fields.push({ label: 'Size', value: formatFileSize(Number(data.file_size)) });
      break;

    case 'tag':
      if (data.color) fields.push({ label: 'Color', value: String(data.color) });
      if (data.description) {
        const desc = String(data.description);
        fields.push({ label: 'Description', value: desc.length > 150 ? desc.slice(0, 150) + '...' : desc });
      }
      break;
  }

  // Add description as fallback if no specific fields and we have one
  if (fields.length === 0 && data.description) {
    const desc = String(data.description);
    fields.push({ label: 'Description', value: desc.length > 200 ? desc.slice(0, 200) + '...' : desc });
  }

  // Add created date if available
  if (data.created_at && fields.length < 4) {
    fields.push({ label: 'Created', value: formatDate(data.created_at) });
  }

  return fields.slice(0, 5); // Limit to 5 fields
}

// Format date helper
function formatDate(value: unknown): string {
  if (!value) return '';
  try {
    return new Date(String(value)).toLocaleDateString();
  } catch {
    return String(value);
  }
}

// Format file size helper
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function EntityPreview({ entityType, entityId }: EntityPreviewProps) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (skipCache = false) => {
    const fetchFn = getFetchFn(entityType);
    if (!fetchFn) {
      setError('Unknown entity type');
      setLoading(false);
      return;
    }

    // Check cache first (unless explicitly skipped for refresh)
    if (!skipCache) {
      const cached = getCachedData(entityType, entityId);
      if (cached) {
        setData(cached);
        setLoading(false);
        setError(null);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFn(entityId);
      // Validate result is a proper object before using
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        const entityData = result as Record<string, unknown>;
        setCachedData(entityType, entityId, entityData);
        setData(entityData);
      } else {
        setError('Invalid entity data received');
      }
    } catch {
      // Log only error type, not full message which may contain sensitive data
      console.error('Failed to fetch entity preview');
      setError('Failed to load entity details');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="bg-space-750 rounded-lg p-3 space-y-2 animate-pulse">
        <div className="h-3 bg-space-600 rounded w-1/3" />
        <div className="h-3 bg-space-600 rounded w-2/3" />
        <div className="h-3 bg-space-600 rounded w-1/2" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
        <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
        <p className="text-xs text-red-400 flex-1">{error}</p>
        <button
          onClick={() => fetchData(true)}
          className="p-1 hover:bg-red-500/20 rounded transition-colors"
          title="Retry"
        >
          <RefreshCw size={14} className="text-red-400" />
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-space-750 rounded-lg p-3 text-sm text-space-400">
        No data available
      </div>
    );
  }

  const fields = extractPreviewFields(entityType, data);

  if (fields.length === 0) {
    return (
      <div className="bg-space-750 rounded-lg p-3 text-sm text-space-400">
        No preview available
      </div>
    );
  }

  return (
    <div className="bg-space-750 rounded-lg p-3 space-y-2">
      {fields.map((field, index) => (
        <div key={index} className="flex gap-2 text-xs">
          <span className="text-space-400 flex-shrink-0 w-20">{sanitizeText(field.label, 50)}:</span>
          <span className="text-space-200 break-words">{sanitizeText(field.value, 300) || '-'}</span>
        </div>
      ))}
    </div>
  );
}
