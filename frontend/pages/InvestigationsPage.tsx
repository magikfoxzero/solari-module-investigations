import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { LoadingRocket } from '@/components/common/LoadingRocket';
import { formatDate } from '@/utils/formatters';
import { InvestigationFormModal } from './components/InvestigationFormModal';
import { useInvestigationsStore } from '@/modules/investigations/store';
import { useFolderFilterStore } from '@/modules/folders/folderFilterStore';
import { confirmAction } from '@/store/uiStore';
import { exportInvestigations } from '../api';
import type { Investigation, InvestigationStatus, InvestigationPriority } from '@/modules/investigations/types';
import { useDebounce, useExport } from '@/hooks';
import { DEBOUNCE, PAGINATION } from '@/constants/ui';
import {
  Search,
  Plus,
  Download,
  ChevronLeft,
  ChevronRight,
  Pencil,
  LayoutGrid,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Pause,
  Filter,
  Trash2,
  Folder,
} from 'lucide-react';

// Status configuration for display
const STATUS_CONFIG: Record<InvestigationStatus, { label: string; color: string; icon: React.ReactNode }> = {
  open: { label: 'Open', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <Clock size={14} /> },
  active: { label: 'Active', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <AlertCircle size={14} /> },
  in_progress: { label: 'In Progress', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: <AlertCircle size={14} /> },
  closed: { label: 'Closed', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: <CheckCircle size={14} /> },
  archived: { label: 'Archived', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: <XCircle size={14} /> },
  on_hold: { label: 'On Hold', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: <Pause size={14} /> },
};

// Priority configuration for display
const PRIORITY_CONFIG: Record<InvestigationPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-gray-500/20 text-gray-400' },
  medium: { label: 'Medium', color: 'bg-blue-500/20 text-blue-400' },
  high: { label: 'High', color: 'bg-orange-500/20 text-orange-400' },
  critical: { label: 'Critical', color: 'bg-red-500/20 text-red-400' },
};

export function InvestigationsPage() {
  const {
    investigations,
    listLoading,
    pagination,
    statistics,
    loadInvestigations,
    searchInvestigations,
    loadStatistics,
    deleteInvestigation,
  } = useInvestigationsStore();

  const { selectedFolderId, selectedFolder } = useFolderFilterStore();

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(PAGINATION.DEFAULT_PAGE_SIZE);
  const [statusFilter, setStatusFilter] = useState<InvestigationStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<InvestigationPriority | ''>('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingInvestigation, setEditingInvestigation] = useState<Investigation | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Use debounce hook for search
  const debouncedSearch = useDebounce(searchTerm, DEBOUNCE.FORM_INPUT);
  const prevDebouncedSearch = useRef(debouncedSearch);

  // Reset page when search changes
  useEffect(() => {
    if (prevDebouncedSearch.current !== debouncedSearch) {
      setCurrentPage(1);
      prevDebouncedSearch.current = debouncedSearch;
    }
  }, [debouncedSearch]);

  // Use export hook
  const { exporting, handleExport } = useExport(
    () => exportInvestigations({ format: 'csv', with_relations: true }),
    { resourceName: 'investigations' }
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, priorityFilter, selectedFolderId]);

  // Load statistics on mount
  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  // Fetch investigations
  const loadData = useCallback(async () => {
    const params: { page: number; per_page: number; status?: string; folder_id?: string } = {
      page: currentPage,
      per_page: pageSize,
    };

    if (statusFilter) {
      params.status = statusFilter;
    }

    if (selectedFolderId) {
      params.folder_id = selectedFolderId;
    }

    if (debouncedSearch) {
      await searchInvestigations(debouncedSearch, currentPage, selectedFolderId || undefined);
    } else {
      await loadInvestigations(params);
    }
  }, [currentPage, pageSize, debouncedSearch, statusFilter, selectedFolderId, loadInvestigations, searchInvestigations]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter investigations by priority (client-side since API doesn't support it)
  const filteredInvestigations = priorityFilter
    ? investigations.filter((inv) => inv.priority === priorityFilter)
    : investigations;

  const handleAddInvestigation = () => {
    setEditingInvestigation(null);
    setShowFormModal(true);
  };

  const handleEditInvestigation = (investigation: Investigation) => {
    setEditingInvestigation(investigation);
    setShowFormModal(true);
  };

  const handleCloseModal = () => {
    setShowFormModal(false);
    setEditingInvestigation(null);
  };

  const handleSaveInvestigation = async () => {
    handleCloseModal();
    await loadData();
    await loadStatistics();
  };

  const handleDeleteInvestigation = async (investigation: Investigation) => {
    const confirmed = await confirmAction({
      title: 'Delete Investigation',
      message: `Are you sure you want to delete "${investigation.title}"? This will permanently remove the investigation and all its canvas data (nodes, connections, and drawings). This action cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;

    setDeletingId(investigation.record_id);
    try {
      await deleteInvestigation(investigation.record_id);
      await loadData();
      await loadStatistics();
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: InvestigationStatus) => {
    const config = STATUS_CONFIG[status];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${config.color}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  const getPriorityBadge = (priority: InvestigationPriority) => {
    const config = PRIORITY_CONFIG[priority];
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
              <Search size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Investigations</h1>
              <p className="text-space-300 text-sm">
                Manage and visualize investigation canvases
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 bg-space-700 hover:bg-space-600 rounded-lg transition-colors disabled:opacity-50"
            >
              <Download size={18} />
              {exporting ? 'Exporting...' : 'Export'}
            </button>
            <button onClick={handleAddInvestigation} className="btn-gradient flex items-center gap-2">
              <Plus size={18} />
              New Investigation
            </button>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="glass-card p-4">
            <div className="text-space-400 text-sm mb-1">Total</div>
            <div className="text-2xl font-bold">{statistics.total}</div>
          </div>
          <div className="glass-card p-4">
            <div className="text-space-400 text-sm mb-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Active
            </div>
            <div className="text-2xl font-bold text-green-400">{statistics.by_status?.active || 0}</div>
          </div>
          <div className="glass-card p-4">
            <div className="text-space-400 text-sm mb-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Open
            </div>
            <div className="text-2xl font-bold text-blue-400">{statistics.by_status?.open || 0}</div>
          </div>
          <div className="glass-card p-4">
            <div className="text-space-400 text-sm mb-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Critical
            </div>
            <div className="text-2xl font-bold text-red-400">{statistics.by_priority?.critical || 0}</div>
          </div>
          <div className="glass-card p-4">
            <div className="text-space-400 text-sm mb-1">Total Nodes</div>
            <div className="text-2xl font-bold">{statistics.total_nodes || 0}</div>
          </div>
        </div>
      )}

      {/* Folder Filter Indicator */}
      {selectedFolder && (
        <div className="glass-card p-4 bg-accent/10 border-accent/30">
          <div className="flex items-center gap-2 text-accent">
            <Folder size={18} />
            <span className="text-sm">
              Filtering by folder: <strong>{selectedFolder.name}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="glass-card p-4 space-y-4">
        <div className="flex gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[250px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-space-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Search by title, case number, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-space pl-12 w-full"
            />
          </div>
          <button
            onClick={() => setShowFilters(prev => !prev)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showFilters || statusFilter || priorityFilter
                ? 'bg-accent text-white'
                : 'bg-space-700 hover:bg-space-600'
            }`}
          >
            <Filter size={18} />
            Filters
            {(statusFilter || priorityFilter) && (
              <span className="w-5 h-5 rounded-full bg-white/20 text-xs flex items-center justify-center">
                {(statusFilter ? 1 : 0) + (priorityFilter ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {/* Filter Dropdowns */}
        {showFilters && (
          <div className="flex gap-4 flex-wrap pt-2 border-t border-space-700">
            <div className="flex items-center gap-2">
              <label className="text-space-400 text-sm">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as InvestigationStatus | '')}
                className="input-space py-2 px-3 min-w-[140px]"
              >
                <option value="">All</option>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-space-400 text-sm">Priority:</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as InvestigationPriority | '')}
                className="input-space py-2 px-3 min-w-[140px]"
              >
                <option value="">All</option>
                {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            {(statusFilter || priorityFilter) && (
              <button
                onClick={() => {
                  setStatusFilter('');
                  setPriorityFilter('');
                }}
                className="text-space-400 hover:text-space-200 text-sm underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="glass-card overflow-hidden">
        {listLoading ? (
          <div className="p-12">
            <LoadingRocket text="Loading investigations..." />
          </div>
        ) : filteredInvestigations.length === 0 ? (
          <div className="text-center py-12 text-space-400">
            <Search size={48} className="mx-auto mb-3 opacity-50" />
            <p className="text-lg mb-2">No investigations found</p>
            {debouncedSearch || statusFilter || priorityFilter ? (
              <p className="text-sm">
                Try adjusting your search or filter criteria
              </p>
            ) : (
              <p className="text-sm">
                Click "New Investigation" to create your first investigation
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-space-800 border-b border-space-600">
                <tr>
                  <th className="text-left p-4 text-space-200 font-semibold">
                    Title
                  </th>
                  <th className="text-left p-4 text-space-200 font-semibold">
                    Case #
                  </th>
                  <th className="text-left p-4 text-space-200 font-semibold">
                    Status
                  </th>
                  <th className="text-left p-4 text-space-200 font-semibold">
                    Priority
                  </th>
                  <th className="text-left p-4 text-space-200 font-semibold">
                    Nodes
                  </th>
                  <th className="text-left p-4 text-space-200 font-semibold">
                    Created
                  </th>
                  <th className="text-center p-4 text-space-200 font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredInvestigations.map((investigation, index) => (
                  <tr
                    key={investigation.record_id}
                    className={`border-b border-space-700 hover:bg-space-800/50 transition-colors ${
                      index % 2 === 0 ? 'bg-space-900/20' : ''
                    }`}
                  >
                    <td className="p-4">
                      <div>
                        <div className="font-medium text-space-100">
                          {investigation.title}
                        </div>
                        {investigation.description && (
                          <div className="text-space-400 text-sm truncate max-w-[300px]">
                            {investigation.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-space-300 font-mono text-sm">
                      {investigation.case_number || '-'}
                    </td>
                    <td className="p-4">
                      {getStatusBadge(investigation.status)}
                    </td>
                    <td className="p-4">
                      {getPriorityBadge(investigation.priority)}
                    </td>
                    <td className="p-4 text-space-300">
                      {/* Use nodes_count from withCount('nodes'), fallback to nodes array length */}
                      {investigation.nodes_count ?? investigation.nodes?.length ?? 0}
                    </td>
                    <td className="p-4 text-space-300 text-sm">
                      {formatDate(investigation.created_at)}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditInvestigation(investigation)}
                          className="p-2 hover:bg-space-600 rounded-lg transition-colors"
                          title="Edit Investigation"
                        >
                          <Pencil size={18} className="text-space-300" />
                        </button>
                        <Link
                          to={`/apps/investigations/${investigation.record_id}/canvas`}
                          className="p-2 hover:bg-space-600 rounded-lg transition-colors"
                          title="Open Canvas"
                        >
                          <LayoutGrid size={18} className="text-accent" />
                        </Link>
                        <button
                          onClick={() => handleDeleteInvestigation(investigation)}
                          disabled={deletingId === investigation.record_id}
                          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete Investigation"
                        >
                          <Trash2 size={18} className={deletingId === investigation.record_id ? 'text-space-400 animate-pulse' : 'text-red-400'} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {!listLoading && filteredInvestigations.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="text-space-300 text-sm">
              Showing {pagination.current_page === 1 ? 1 : (pagination.current_page - 1) * pagination.per_page + 1} to{' '}
              {Math.min(pagination.current_page * pagination.per_page, pagination.total)} of{' '}
              {pagination.total} results
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-space-700 hover:bg-space-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
              >
                <ChevronLeft size={18} />
                Previous
              </button>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(pagination.last_page, p + 1))
                }
                disabled={currentPage === pagination.last_page || pagination.last_page === 0}
                className="px-4 py-2 bg-space-700 hover:bg-space-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
              >
                Next
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showFormModal && (
        <InvestigationFormModal
          investigation={editingInvestigation}
          onClose={handleCloseModal}
          onSave={handleSaveInvestigation}
        />
      )}
    </div>
  );
}
