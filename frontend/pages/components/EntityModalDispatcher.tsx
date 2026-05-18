import { useState, useEffect } from 'react';
import type { LinkableEntityType } from '@/modules/investigations/types';
import { LoadingRocket } from '@/components/common/LoadingRocket';

// Import form modals (static imports since they're already bundled via EntitySearchPanel)
import { PersonFormModal } from '@/pages/apps/people';
import { EntityFormModal } from '@/pages/apps/entities';
import { PlaceFormModal } from '@/pages/apps/places';
import { EventFormModal } from '@/pages/apps/events';
import { NoteFormModal } from '@/pages/apps/notes';
import { TaskFormModal } from '@/pages/apps/tasks';
import { HypothesisFormModal } from '@/pages/apps/hypotheses';
import { MotiveFormModal } from '@/pages/apps/motives';
import { InventoryFormModal } from '@/pages/apps/inventory';
import { TagFormModal } from '@/pages/apps/tags';
// Note: Files don't have an edit modal - they are view-only

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

// Import types
import type { Person, Entity, Place, Event, Note, Task, Hypothesis, Motive, InventoryObject, Tag, TagCreateInput } from '@/types/models';

interface EntityModalDispatcherProps {
  entityType: LinkableEntityType;
  entityId: string;
  onClose: () => void;
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

export function EntityModalDispatcher({ entityType, entityId, onClose }: EntityModalDispatcherProps) {
  const [entityData, setEntityData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEntity = async () => {
      const fetchFn = getFetchFn(entityType);
      if (!fetchFn) {
        setError('Unknown entity type');
        setLoading(false);
        return;
      }

      try {
        const data = await fetchFn(entityId);
        setEntityData(data);
      } catch {
        console.error('Failed to fetch entity for editing');
        setError('Failed to load entity');
      } finally {
        setLoading(false);
      }
    };

    fetchEntity();
  }, [entityType, entityId]);

  // Handle onComplete callback (most modals)
  const handleComplete = () => {
    onClose();
  };

  // Handle onSave callback (PersonFormModal, TagFormModal)
  const handleSave = async () => {
    onClose();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-space-800 rounded-xl p-8">
          <LoadingRocket text="Loading entity..." />
        </div>
      </div>
    );
  }

  if (error || !entityData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-space-800 rounded-xl p-8 max-w-md mx-4">
          <p className="text-red-400 mb-4">{error || 'Failed to load entity'}</p>
          <button
            onClick={onClose}
            className="btn-gradient px-4 py-2"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Render the appropriate modal based on entity type, wrapped in Suspense for lazy loading
  const renderModal = () => {
    switch (entityType) {
      case 'person':
        return (
          <PersonFormModal
            person={entityData as Person}
            onClose={onClose}
            onSave={handleSave}
          />
        );

      case 'entity':
        return (
          <EntityFormModal
            entity={entityData as Entity}
            onClose={onClose}
            onComplete={handleComplete}
          />
        );

      case 'place':
        return (
          <PlaceFormModal
            place={entityData as Place}
            onClose={onClose}
            onComplete={handleComplete}
          />
        );

      case 'event':
        return (
          <EventFormModal
            event={entityData as Event}
            onClose={onClose}
            onComplete={handleComplete}
          />
        );

      case 'note':
        return (
          <NoteFormModal
            note={entityData as Note}
            onClose={onClose}
            onComplete={handleComplete}
          />
        );

      case 'task':
        return (
          <TaskFormModal
            task={entityData as Task}
            onClose={onClose}
            onComplete={handleComplete}
          />
        );

      case 'hypothesis':
        return (
          <HypothesisFormModal
            hypothesis={entityData as Hypothesis}
            onClose={onClose}
            onComplete={handleComplete}
          />
        );

      case 'motive':
        return (
          <MotiveFormModal
            motive={entityData as Motive}
            onClose={onClose}
            onComplete={handleComplete}
          />
        );

      case 'inventory_object':
        return (
          <InventoryFormModal
            item={entityData as InventoryObject}
            onClose={onClose}
            onComplete={handleComplete}
          />
        );

      case 'file':
        // Files are view-only - show info message with link to detail page
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-space-800 rounded-xl p-6 max-w-md mx-4 border border-space-600">
              <h3 className="text-lg font-semibold mb-3">File: {(entityData as { original_filename?: string }).original_filename || 'Unknown'}</h3>
              <p className="text-space-400 mb-4">
                Files cannot be edited directly. You can view or download the file from the Files app.
              </p>
              <div className="flex gap-3">
                <a
                  href={`/apps/files/${entityId}`}
                  className="btn-gradient px-4 py-2"
                >
                  View File
                </a>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-space-700 hover:bg-space-600 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );

      case 'tag':
        return (
          <TagFormModal
            tag={entityData as Tag}
            onClose={onClose}
            onSave={handleSave as (data: TagCreateInput) => Promise<void>}
          />
        );

      default:
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-space-800 rounded-xl p-8 max-w-md mx-4">
              <p className="text-space-300 mb-4">
                Editing is not available for this entity type.
              </p>
              <button
                onClick={onClose}
                className="btn-gradient px-4 py-2"
              >
                Close
              </button>
            </div>
          </div>
        );
    }
  };

  return renderModal();
}
