import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EntitySearchPanel } from '../components/EntitySearchPanel';
import { useInvestigationsStore } from '@/modules/investigations/store';
import type { Investigation, InvestigationNode } from '@/modules/investigations/types';

// Mock the investigations store
vi.mock('@/modules/investigations/store', () => ({
  useInvestigationsStore: vi.fn(),
}));

// Mock the apps store
vi.mock('@/store/appsStore', () => ({
  useAppsStore: vi.fn(() => ({
    isAppEnabled: vi.fn(() => true), // All apps enabled by default
  })),
}));

// Mock the API client to prevent actual network calls
vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn().mockRejectedValue(new Error('Mocked')),
  },
  unwrapResponse: vi.fn((response) => response.data?.data),
}));

describe('EntitySearchPanel', () => {
  const mockAddNode = vi.fn();
  const mockInvestigation: Investigation = {
    record_id: 'inv-1',
    partition_id: 'partition-1',
    title: 'Test Investigation',
    description: 'A test investigation',
    status: 'open',
    priority: 'medium',
    case_number: 'CASE-001',
    is_public: false,
    canvas_state: null,
    assigned_to: null,
    due_date: null,
    created_by: 'user-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    deleted_at: null,
    nodes: [],
    connections: [],
    drawings: [],
  };

  const mockNodes: InvestigationNode[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useInvestigationsStore).mockReturnValue({
      nodes: mockNodes,
      addNode: mockAddNode,
      currentInvestigation: mockInvestigation,
      viewport: { x: 0, y: 0 },
      zoom: 1,
    });
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <EntitySearchPanel isOpen={false} onClose={vi.fn()} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders the panel when open', () => {
    render(<EntitySearchPanel isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Add Entity')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search entities...')).toBeInTheDocument();
  });

  it('renders type filter buttons', () => {
    render(<EntitySearchPanel isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Person')).toBeInTheDocument();
    expect(screen.getByText('Entity')).toBeInTheDocument();
    expect(screen.getByText('Place')).toBeInTheDocument();
    expect(screen.getByText('Event')).toBeInTheDocument();
    expect(screen.getByText('Note')).toBeInTheDocument();
  });

  it('calls onClose when X button is clicked', () => {
    const mockOnClose = vi.fn();
    render(<EntitySearchPanel isOpen={true} onClose={mockOnClose} />);

    // Find the close button by looking for buttons without text (X icon)
    const buttons = screen.getAllByRole('button');
    const closeButton = buttons.find(btn => btn.querySelector('svg.lucide-x'));
    expect(closeButton).toBeDefined();
    fireEvent.click(closeButton!);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows empty state when no search term', () => {
    render(<EntitySearchPanel isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Type to search or create new entities')).toBeInTheDocument();
  });

  it('updates search input value', () => {
    render(<EntitySearchPanel isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText('Search entities...');
    fireEvent.change(input, { target: { value: 'John' } });

    expect(input).toHaveValue('John');
  });

  it('toggles type filter when button clicked', () => {
    render(<EntitySearchPanel isOpen={true} onClose={vi.fn()} />);

    const personButton = screen.getByText('Person');
    expect(personButton).not.toHaveClass('bg-accent');

    fireEvent.click(personButton);

    // Person button should now be active (has accent color class)
    expect(personButton).toHaveClass('bg-accent');
  });

  it('deselects filter when clicking the same filter again', () => {
    render(<EntitySearchPanel isOpen={true} onClose={vi.fn()} />);

    const personButton = screen.getByText('Person');

    // Click to select
    fireEvent.click(personButton);
    expect(personButton).toHaveClass('bg-accent');

    // Click again to deselect
    fireEvent.click(personButton);
    expect(personButton).not.toHaveClass('bg-accent');
  });

  it('shows "All" button as active by default', () => {
    render(<EntitySearchPanel isOpen={true} onClose={vi.fn()} />);

    const allButton = screen.getByText('All');
    expect(allButton).toHaveClass('bg-accent');
  });

  it('deactivates "All" when type filter is selected', () => {
    render(<EntitySearchPanel isOpen={true} onClose={vi.fn()} />);

    const allButton = screen.getByText('All');
    const personButton = screen.getByText('Person');

    expect(allButton).toHaveClass('bg-accent');

    fireEvent.click(personButton);

    expect(allButton).not.toHaveClass('bg-accent');
    expect(personButton).toHaveClass('bg-accent');
  });

  it('reactivates "All" when clicking active type filter', () => {
    render(<EntitySearchPanel isOpen={true} onClose={vi.fn()} />);

    const allButton = screen.getByText('All');
    const personButton = screen.getByText('Person');

    fireEvent.click(personButton);
    expect(allButton).not.toHaveClass('bg-accent');

    fireEvent.click(personButton); // Click again to deselect
    expect(allButton).toHaveClass('bg-accent');
  });

  it('displays correct entity type labels', () => {
    render(<EntitySearchPanel isOpen={true} onClose={vi.fn()} />);

    // All 11 entity type buttons are shown (no blocknote)
    expect(screen.getByText('Person')).toBeInTheDocument();
    expect(screen.getByText('Entity')).toBeInTheDocument();
    expect(screen.getByText('Place')).toBeInTheDocument();
    expect(screen.getByText('Event')).toBeInTheDocument();
    expect(screen.getByText('Note')).toBeInTheDocument();
    expect(screen.getByText('Task')).toBeInTheDocument();
    expect(screen.getByText('File')).toBeInTheDocument();
    expect(screen.getByText('Hypothesis')).toBeInTheDocument();
    expect(screen.getByText('Motive')).toBeInTheDocument();
    expect(screen.getByText('Inventory')).toBeInTheDocument();
    expect(screen.getByText('Tag')).toBeInTheDocument();
  });

  it('correctly tracks existing entities on canvas', () => {
    const existingNode: InvestigationNode = {
      record_id: 'node-1',
      partition_id: 'partition-1',
      investigation_id: 'inv-1',
      entity_type: 'person',
      entity_id: 'person-1',
      x: 100,
      y: 100,
      width: 200,
      height: 80,
      z_index: 0,
      settings: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      deleted_at: null,
    };

    vi.mocked(useInvestigationsStore).mockReturnValue({
      nodes: [existingNode],
      addNode: mockAddNode,
      currentInvestigation: mockInvestigation,
      viewport: { x: 0, y: 0 },
      zoom: 1,
    });

    render(<EntitySearchPanel isOpen={true} onClose={vi.fn()} />);

    // Panel should render without errors when nodes exist
    expect(screen.getByText('Add Entity')).toBeInTheDocument();
  });
});
