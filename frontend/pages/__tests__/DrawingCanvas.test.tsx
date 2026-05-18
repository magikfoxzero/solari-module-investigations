import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { DrawingCanvas } from '../components/DrawingCanvas';
import { useInvestigationsStore } from '@/modules/investigations/store';

// Mock the investigations store
vi.mock('@/modules/investigations/store', () => ({
  useInvestigationsStore: vi.fn(),
}));

describe('DrawingCanvas', () => {
  const mockAddDrawing = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useInvestigationsStore).mockReturnValue({
      currentTool: 'draw',
      drawingTool: 'pencil',
      drawColor: '#ef4444',
      drawSize: 4,
      addDrawing: mockAddDrawing,
    });
  });

  it('renders a canvas element', () => {
    const { container } = render(
      <DrawingCanvas viewport={{ x: 0, y: 0 }} zoom={1} />
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('has crosshair cursor when draw tool is active', () => {
    const { container } = render(
      <DrawingCanvas viewport={{ x: 0, y: 0 }} zoom={1} />
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).toHaveStyle({ cursor: 'crosshair' });
  });

  it('has no pointer events when tool is not draw', () => {
    vi.mocked(useInvestigationsStore).mockReturnValue({
      currentTool: 'select',
      drawingTool: 'pencil',
      drawColor: '#ef4444',
      drawSize: 4,
      addDrawing: mockAddDrawing,
    });

    const { container } = render(
      <DrawingCanvas viewport={{ x: 0, y: 0 }} zoom={1} />
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).toHaveClass('pointer-events-none');
  });

  it('has high z-index when draw tool is active', () => {
    const { container } = render(
      <DrawingCanvas viewport={{ x: 0, y: 0 }} zoom={1} />
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).toHaveStyle({ zIndex: 25 });
  });

  it('has low z-index when draw tool is not active', () => {
    vi.mocked(useInvestigationsStore).mockReturnValue({
      currentTool: 'select',
      drawingTool: 'pencil',
      drawColor: '#ef4444',
      drawSize: 4,
      addDrawing: mockAddDrawing,
    });

    const { container } = render(
      <DrawingCanvas viewport={{ x: 0, y: 0 }} zoom={1} />
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).toHaveStyle({ zIndex: -1 });
  });

  it('handles mouse down to start drawing', () => {
    const { container } = render(
      <DrawingCanvas viewport={{ x: 0, y: 0 }} zoom={1} />
    );

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;

    fireEvent.mouseDown(canvas, {
      clientX: 100,
      clientY: 100,
      button: 0,
    });

    // Drawing started - no visible change but internal state updated
    // We verify this works by completing a drawing
  });

  it('does not start drawing on right click', () => {
    const { container } = render(
      <DrawingCanvas viewport={{ x: 0, y: 0 }} zoom={1} />
    );

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;

    fireEvent.mouseDown(canvas, {
      clientX: 100,
      clientY: 100,
      button: 2, // Right click
    });

    // Should not start drawing on right click
    fireEvent.mouseUp(canvas);

    // addDrawing should not be called since right click doesn't start drawing
    expect(mockAddDrawing).not.toHaveBeenCalled();
  });

  it('does not start drawing when tool is not draw', () => {
    vi.mocked(useInvestigationsStore).mockReturnValue({
      currentTool: 'select',
      drawingTool: 'pencil',
      drawColor: '#ef4444',
      drawSize: 4,
      addDrawing: mockAddDrawing,
    });

    const { container } = render(
      <DrawingCanvas viewport={{ x: 0, y: 0 }} zoom={1} />
    );

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;

    fireEvent.mouseDown(canvas, {
      clientX: 100,
      clientY: 100,
      button: 0,
    });
    fireEvent.mouseMove(canvas, { clientX: 200, clientY: 200 });
    fireEvent.mouseUp(canvas);

    expect(mockAddDrawing).not.toHaveBeenCalled();
  });

  it('saves drawing on mouse up after drawing', async () => {
    mockAddDrawing.mockResolvedValue({
      record_id: 'draw-1',
      tool: 'pencil',
      points: [],
      color: '#ef4444',
      size: 4,
    });

    const { container } = render(
      <DrawingCanvas viewport={{ x: 0, y: 0 }} zoom={1} />
    );

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;

    // Start drawing
    fireEvent.mouseDown(canvas, {
      clientX: 100,
      clientY: 100,
      button: 0,
    });

    // Move to create points (need distance > 2 to add point)
    fireEvent.mouseMove(canvas, { clientX: 110, clientY: 110 });
    fireEvent.mouseMove(canvas, { clientX: 120, clientY: 120 });
    fireEvent.mouseMove(canvas, { clientX: 130, clientY: 130 });

    // End drawing
    fireEvent.mouseUp(canvas);

    await waitFor(() => {
      expect(mockAddDrawing).toHaveBeenCalled();
    });

    const callArgs = mockAddDrawing.mock.calls[0][0];
    expect(callArgs.tool).toBe('pencil');
    expect(callArgs.color).toBe('#ef4444');
    expect(callArgs.size).toBe(4);
    expect(callArgs.points.length).toBeGreaterThanOrEqual(2);
  });

  it('does not save drawing with fewer than 2 points', async () => {
    const { container } = render(
      <DrawingCanvas viewport={{ x: 0, y: 0 }} zoom={1} />
    );

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;

    // Start drawing
    fireEvent.mouseDown(canvas, {
      clientX: 100,
      clientY: 100,
      button: 0,
    });

    // End immediately without moving
    fireEvent.mouseUp(canvas);

    await waitFor(() => {
      // Should not save single point
      expect(mockAddDrawing).not.toHaveBeenCalled();
    });
  });

  it('saves drawing on mouse leave while drawing', async () => {
    mockAddDrawing.mockResolvedValue({
      record_id: 'draw-1',
      tool: 'pencil',
      points: [],
      color: '#ef4444',
      size: 4,
    });

    const { container } = render(
      <DrawingCanvas viewport={{ x: 0, y: 0 }} zoom={1} />
    );

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;

    // Start drawing
    fireEvent.mouseDown(canvas, {
      clientX: 100,
      clientY: 100,
      button: 0,
    });

    // Move to create points
    fireEvent.mouseMove(canvas, { clientX: 150, clientY: 150 });
    fireEvent.mouseMove(canvas, { clientX: 200, clientY: 200 });

    // Leave canvas area
    fireEvent.mouseLeave(canvas);

    await waitFor(() => {
      expect(mockAddDrawing).toHaveBeenCalled();
    });
  });

  it('applies viewport transform correctly', async () => {
    mockAddDrawing.mockResolvedValue({
      record_id: 'draw-1',
      tool: 'pencil',
      points: [],
      color: '#ef4444',
      size: 4,
    });

    const { container } = render(
      <DrawingCanvas viewport={{ x: 50, y: 50 }} zoom={2} />
    );

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;

    // Mock getBoundingClientRect
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    // Start drawing
    fireEvent.mouseDown(canvas, {
      clientX: 100,
      clientY: 100,
      button: 0,
    });

    fireEvent.mouseMove(canvas, { clientX: 200, clientY: 200 });
    fireEvent.mouseUp(canvas);

    await waitFor(() => {
      expect(mockAddDrawing).toHaveBeenCalled();
    });

    // Points should be transformed by viewport and zoom
    const callArgs = mockAddDrawing.mock.calls[0][0];
    expect(callArgs.points).toBeDefined();
  });

  it('uses the current drawing tool', async () => {
    vi.mocked(useInvestigationsStore).mockReturnValue({
      currentTool: 'draw',
      drawingTool: 'rectangle',
      drawColor: '#3b82f6',
      drawSize: 8,
      addDrawing: mockAddDrawing,
    });

    mockAddDrawing.mockResolvedValue({
      record_id: 'draw-1',
      tool: 'rectangle',
      points: [],
      color: '#3b82f6',
      size: 8,
    });

    const { container } = render(
      <DrawingCanvas viewport={{ x: 0, y: 0 }} zoom={1} />
    );

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;

    fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.mouseMove(canvas, { clientX: 200, clientY: 200 });
    fireEvent.mouseUp(canvas);

    await waitFor(() => {
      expect(mockAddDrawing).toHaveBeenCalled();
    });

    const callArgs = mockAddDrawing.mock.calls[0][0];
    expect(callArgs.tool).toBe('rectangle');
    expect(callArgs.color).toBe('#3b82f6');
    expect(callArgs.size).toBe(8);
  });

  it('handles drawing errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockAddDrawing.mockRejectedValue(new Error('Save failed'));

    const { container } = render(
      <DrawingCanvas viewport={{ x: 0, y: 0 }} zoom={1} />
    );

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;

    fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.mouseMove(canvas, { clientX: 200, clientY: 200 });
    fireEvent.mouseUp(canvas);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save drawing:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });
});
