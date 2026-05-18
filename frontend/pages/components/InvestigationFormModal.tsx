import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useInvestigationsStore } from '@/modules/investigations/store';
import { useFolderFilterStore } from '@/modules/folders/folderFilterStore';
import { addItemToFolder } from '@/modules/folders/api';
import { toast } from '@/store/toastStore';
import type {
  Investigation,
  InvestigationCreateInput,
  InvestigationStatus,
  InvestigationPriority,
} from '@/modules/investigations/types';

interface InvestigationFormModalProps {
  investigation: Investigation | null;
  onClose: () => void;
  onSave: () => Promise<void>;
}

interface FormErrors {
  title?: string;
  case_number?: string;
  general?: string;
}

const STATUS_OPTIONS: { value: InvestigationStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
];

const PRIORITY_OPTIONS: { value: InvestigationPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

// Convert date string to YYYY-MM-DD format for HTML date input
const formatDateForInput = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
};

// Parse tags from JSON string to array
const parseTags = (tagsString: string | null | undefined): string[] => {
  if (!tagsString) return [];
  try {
    const parsed = JSON.parse(tagsString);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // If not valid JSON, treat as comma-separated
    return tagsString.split(',').map(t => t.trim()).filter(Boolean);
  }
};

// Convert tags array to JSON string
const stringifyTags = (tags: string[]): string => {
  return tags.length > 0 ? JSON.stringify(tags) : '';
};

export function InvestigationFormModal({
  investigation,
  onClose,
  onSave,
}: InvestigationFormModalProps) {
  const { createInvestigation, updateInvestigation, isSaving } = useInvestigationsStore();
  const { selectedFolderId } = useFolderFilterStore();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    case_number: '',
    status: 'open' as InvestigationStatus,
    priority: 'medium' as InvestigationPriority,
    start_date: '',
    end_date: '',
  });

  // Handle tags separately as an array for UI
  const [localTags, setLocalTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (investigation) {
      setFormData({
        title: investigation.title || '',
        description: investigation.description || '',
        case_number: investigation.case_number || '',
        status: investigation.status || 'open',
        priority: investigation.priority || 'medium',
        start_date: formatDateForInput(investigation.start_date),
        end_date: formatDateForInput(investigation.end_date),
      });
      setLocalTags(parseTags(investigation.tags));
    }
  }, [investigation]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase();
      if (tag && !localTags.includes(tag)) {
        setLocalTags((prev) => [...prev, tag]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setLocalTags((prev) => prev.filter((tag) => tag !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      // Build the submit data
      const submitData: InvestigationCreateInput = {
        title: formData.title,
        description: formData.description || undefined,
        case_number: formData.case_number || undefined,
        status: formData.status,
        priority: formData.priority,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
        tags: stringifyTags(localTags) || undefined,
      };

      let result;
      if (investigation) {
        result = await updateInvestigation(investigation.record_id, submitData);
      } else {
        result = await createInvestigation(submitData);

        // If a folder filter is active, automatically add the new investigation to that folder
        if (result && selectedFolderId) {
          try {
            await addItemToFolder(selectedFolderId, {
              target_id: result.record_id,
              target_type: 'investigation',
              relationship_type: 'contains',
            });
          } catch {
            console.warn('Failed to add investigation to folder');
            toast.warning('Investigation Created', 'Investigation was created but could not be added to the folder');
          }
        }
      }

      if (result) {
        toast.success(
          investigation
            ? 'Investigation updated successfully'
            : 'Investigation created successfully'
        );
        await onSave();
      } else {
        throw new Error('Operation failed');
      }
    } catch {
      console.error('Failed to save investigation');
      toast.error('Failed to save investigation. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-space-800 rounded-xl border border-space-600 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-space-600">
          <h2 className="text-xl font-bold">
            {investigation ? 'Edit Investigation' : 'New Investigation'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-space-700 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-space-200 mb-2">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className={`input-space w-full ${errors.title ? 'border-red-500' : ''}`}
              placeholder="Enter investigation title"
            />
            {errors.title && (
              <p className="text-red-400 text-sm mt-1">{errors.title}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-space-200 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="input-space w-full resize-none"
              placeholder="Enter investigation description"
            />
          </div>

          {/* Case Number */}
          <div>
            <label className="block text-sm font-medium text-space-200 mb-2">
              Case Number
            </label>
            <input
              type="text"
              name="case_number"
              value={formData.case_number}
              onChange={handleChange}
              className="input-space w-full"
              placeholder="e.g., CASE-2025-001"
            />
          </div>

          {/* Status and Priority Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-space-200 mb-2">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="input-space w-full"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-space-200 mb-2">
                Priority
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="input-space w-full"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Range Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-space-200 mb-2">
                Start Date
              </label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                className="input-space w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-space-200 mb-2">
                End Date
              </label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                className="input-space w-full"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-space-200 mb-2">
              Tags
            </label>
            <div className="space-y-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                className="input-space w-full"
                placeholder="Type a tag and press Enter"
              />
              {localTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {localTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-space-700 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-red-400 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-space-600">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-space-700 hover:bg-space-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="btn-gradient px-6 py-2 disabled:opacity-50"
            >
              {isSaving
                ? 'Saving...'
                : investigation
                  ? 'Update Investigation'
                  : 'Create Investigation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
