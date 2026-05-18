import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DrawingToolsPanel } from '../components/DrawingToolsPanel';
import { useInvestigationsStore } from '@/modules/investigations/store';

// Mock the investigations store
vi.mock('@/modules/investigations/store', () => ({
  useInvestigationsStore: vi.fn(),
}));

describe('DrawingToolsPanel', () => {
  const mockSetDrawingTool = vi.fn();
  const mockSetDrawColor = vi.fn();
  const mockSetDrawSize = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useInvestigationsStore).mockReturnValue({
      drawingTool: 'pencil',
      drawColor: '#ef4444',
      drawSize: 4,
      setDrawingTool: mockSetDrawingTool,
      setDrawColor: mockSetDrawColor,
      setDrawSize: mockSetDrawSize,
    });
  });

  it('renders nothing when closed', () => {
    const { container } = render(<DrawingToolsPanel isOpen={false} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders the panel when open', () => {
    render(<DrawingToolsPanel isOpen={true} />);

    expect(screen.getByText('Drawing Tools')).toBeInTheDocument();
    expect(screen.getByText('Tool')).toBeInTheDocument();
    expect(screen.getByText('Color')).toBeInTheDocument();
    expect(screen.getByText('Size')).toBeInTheDocument();
  });

  it('renders all drawing tool buttons', () => {
    render(<DrawingToolsPanel isOpen={true} />);

    expect(screen.getByTitle('Pencil')).toBeInTheDocument();
    expect(screen.getByTitle('Line')).toBeInTheDocument();
    expect(screen.getByTitle('Rectangle')).toBeInTheDocument();
    expect(screen.getByTitle('Circle')).toBeInTheDocument();
    expect(screen.getByTitle('Arrow')).toBeInTheDocument();
    expect(screen.getByTitle('Text Label')).toBeInTheDocument();
  });

  it('calls setDrawingTool when tool button is clicked', () => {
    render(<DrawingToolsPanel isOpen={true} />);

    const lineButton = screen.getByTitle('Line');
    fireEvent.click(lineButton);

    expect(mockSetDrawingTool).toHaveBeenCalledWith('line');
  });

  it('highlights the active drawing tool', () => {
    vi.mocked(useInvestigationsStore).mockReturnValue({
      drawingTool: 'rectangle',
      drawColor: '#ef4444',
      drawSize: 4,
      setDrawingTool: mockSetDrawingTool,
      setDrawColor: mockSetDrawColor,
      setDrawSize: mockSetDrawSize,
    });

    render(<DrawingToolsPanel isOpen={true} />);

    const rectangleButton = screen.getByTitle('Rectangle');
    expect(rectangleButton).toHaveClass('bg-accent');
  });

  it('renders color preset buttons', () => {
    render(<DrawingToolsPanel isOpen={true} />);

    // There should be 10 color preset buttons
    const colorButtons = screen.getAllByTitle(/#[0-9a-f]{6}/i);
    expect(colorButtons.length).toBe(10);
  });

  it('calls setDrawColor when color preset is clicked', () => {
    render(<DrawingToolsPanel isOpen={true} />);

    const blueButton = screen.getByTitle('#3b82f6');
    fireEvent.click(blueButton);

    expect(mockSetDrawColor).toHaveBeenCalledWith('#3b82f6');
  });

  it('highlights the active color', () => {
    render(<DrawingToolsPanel isOpen={true} />);

    const redButton = screen.getByTitle('#ef4444');
    expect(redButton).toHaveClass('border-white');
  });

  it('renders custom color input', () => {
    render(<DrawingToolsPanel isOpen={true} />);

    const colorInput = screen.getByText('Custom').previousElementSibling;
    expect(colorInput).toHaveAttribute('type', 'color');
  });

  it('calls setDrawColor when custom color changes', () => {
    render(<DrawingToolsPanel isOpen={true} />);

    const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement;
    fireEvent.change(colorInput, { target: { value: '#123456' } });

    expect(mockSetDrawColor).toHaveBeenCalledWith('#123456');
  });

  it('renders size preset buttons', () => {
    render(<DrawingToolsPanel isOpen={true} />);

    expect(screen.getByText('S')).toBeInTheDocument();
    expect(screen.getByText('M')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(screen.getByText('XL')).toBeInTheDocument();
  });

  it('calls setDrawSize when size preset is clicked', () => {
    render(<DrawingToolsPanel isOpen={true} />);

    const largeButton = screen.getByText('L');
    fireEvent.click(largeButton);

    expect(mockSetDrawSize).toHaveBeenCalledWith(8);
  });

  it('highlights the active size', () => {
    render(<DrawingToolsPanel isOpen={true} />);

    const mediumButton = screen.getByText('M');
    expect(mediumButton).toHaveClass('bg-accent');
  });

  it('renders size slider', () => {
    render(<DrawingToolsPanel isOpen={true} />);

    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue('4');
    expect(slider).toHaveAttribute('min', '1');
    expect(slider).toHaveAttribute('max', '32');
  });

  it('calls setDrawSize when slider changes', () => {
    render(<DrawingToolsPanel isOpen={true} />);

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '16' } });

    expect(mockSetDrawSize).toHaveBeenCalledWith(16);
  });

  it('displays current size value', () => {
    vi.mocked(useInvestigationsStore).mockReturnValue({
      drawingTool: 'pencil',
      drawColor: '#ef4444',
      drawSize: 12,
      setDrawingTool: mockSetDrawingTool,
      setDrawColor: mockSetDrawColor,
      setDrawSize: mockSetDrawSize,
    });

    render(<DrawingToolsPanel isOpen={true} />);

    expect(screen.getByText('12px')).toBeInTheDocument();
  });

  it('displays min and max size labels', () => {
    render(<DrawingToolsPanel isOpen={true} />);

    expect(screen.getByText('1px')).toBeInTheDocument();
    expect(screen.getByText('32px')).toBeInTheDocument();
  });
});
