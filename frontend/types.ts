import type { BaseEntity } from '@/types/models';

// ============================================
// Investigation Status and Priority Enums
// ============================================

export type InvestigationStatus = 'open' | 'active' | 'in_progress' | 'on_hold' | 'closed' | 'archived';
export type InvestigationPriority = 'low' | 'medium' | 'high' | 'critical';
export type InvestigationLayout = 'freeform' | 'grid' | 'timeline' | 'hierarchical' | 'radial' | 'force-directed';

// ============================================
// Linkable Entity Types (11 types - no blocknote)
// ============================================

export type LinkableEntityType =
  | 'person'
  | 'entity'
  | 'place'
  | 'event'
  | 'note'
  | 'task'
  | 'file'
  | 'hypothesis'
  | 'motive'
  | 'inventory_object'
  | 'tag';

// ============================================
// Connection Types
// ============================================

export type ConnectionStyle = 'solid' | 'dashed' | 'dotted';
export type ConnectionPathType = 'curved' | 'straight' | 'orthogonal';
export type ConnectionArrowType = 'none' | 'forward' | 'backward' | 'both';
export type ConnectionSentiment = 'neutral' | 'positive' | 'negative';
export type ConnectionAnchor =
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left'
  | 'top-left';

// ============================================
// Drawing Types
// ============================================

export type DrawingTool =
  | 'pencil'
  | 'line'
  | 'rectangle'
  | 'circle'
  | 'triangle'
  | 'diamond'
  | 'arrow'
  | 'cloud'
  | 'label'
  | 'eraser';

export type DrawingLineStyle = 'solid' | 'dashed' | 'dotted';
export type DrawingArrowType = 'none' | 'one-way' | 'two-way';

// ============================================
// Canvas Tool Types
// ============================================

export type CanvasTool = 'select' | 'connect' | 'draw' | 'pan';

// ============================================
// Investigation Model
// ============================================

export interface Investigation extends BaseEntity {
  title: string;
  description: string | null;
  status: InvestigationStatus;
  priority: InvestigationPriority;
  case_number: string | null;
  start_date: string | null;
  end_date: string | null;
  due_date: string | null;
  canvas_state: CanvasState | null;
  default_layout: InvestigationLayout;
  // Original schema fields
  lead_investigator_id: string | null;
  lead_investigator_name: string | null;
  case_type: string | null;
  jurisdiction: string | null;
  location: string | null;
  agency: string | null;
  is_confidential: boolean;
  is_sensitive: boolean;
  access_level: string | null;
  tags: string | null;
  related_cases: string | null;
  // Relations (when loaded)
  nodes?: InvestigationNode[];
  connections?: InvestigationConnection[];
  drawings?: InvestigationDrawing[];
  visible_nodes?: InvestigationNode[];
  creator?: {
    record_id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
  };
  // Computed attributes from backend
  nodes_count?: number;
  connection_count?: number;
  drawing_count?: number;
  status_info?: {
    icon: string;
    color: string;
    label: string;
  };
  priority_info?: {
    icon: string;
    color: string;
    label: string;
  };
  is_overdue?: boolean;
}

export interface InvestigationCreateInput {
  title: string;
  description?: string;
  status?: InvestigationStatus;
  priority?: InvestigationPriority;
  case_number?: string;
  start_date?: string;
  end_date?: string;
  due_date?: string;
  default_layout?: InvestigationLayout;
  lead_investigator_id?: string;
  lead_investigator_name?: string;
  case_type?: string;
  jurisdiction?: string;
  location?: string;
  agency?: string;
  is_confidential?: boolean;
  is_sensitive?: boolean;
  tags?: string;
  is_public?: boolean;
}

export type InvestigationUpdateInput = Partial<InvestigationCreateInput>;

// ============================================
// Canvas State
// ============================================

export interface CanvasState {
  zoom?: number;
  panX?: number;
  panY?: number;
  layoutType?: InvestigationLayout;
}

// ============================================
// Investigation Node Model
// ============================================

export interface InvestigationNode {
  record_id: string;
  investigation_id: string;
  entity_type: LinkableEntityType;
  entity_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  style: Record<string, unknown> | null;
  label_override: string | null;
  notes: string | null;
  tags: string[] | null;
  is_pinned: boolean;
  is_collapsed: boolean;
  partition_id: string;
  created_at: string;
  updated_at: string;
  // Computed attributes
  display_label?: string;
  center_x?: number;
  center_y?: number;
  bounds?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  effective_style?: {
    backgroundColor: string;
    borderColor: string;
    textColor: string;
  };
  // Visual config from plugin
  visual_config?: EntityVisualConfig;
}

export interface InvestigationNodeCreateInput {
  entity_type: LinkableEntityType;
  entity_id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  z_index?: number;
  style?: Record<string, unknown>;
  label_override?: string;
  notes?: string;
  tags?: string[];
  is_pinned?: boolean;
  is_collapsed?: boolean;
}

export interface InvestigationNodeUpdateInput {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  z_index?: number;
  style?: Record<string, unknown>;
  label_override?: string;
  notes?: string;
  tags?: string[];
  is_pinned?: boolean;
  is_collapsed?: boolean;
}

export interface NodePositionUpdate {
  node_id: string;
  x: number;
  y: number;
  z_index?: number;
}

export interface BulkNodeInput {
  entity_type: LinkableEntityType;
  entity_id: string;
  x?: number;
  y?: number;
}

// ============================================
// Investigation Connection Model
// ============================================

export interface InvestigationConnection {
  record_id: string;
  investigation_id: string;
  from_node_id: string;
  to_node_id: string;
  from_side: ConnectionAnchor | null;
  to_side: ConnectionAnchor | null;
  style: ConnectionStyle | null;
  path_type: ConnectionPathType | null;
  color: string | null;
  thickness: number | null;
  arrow_type: ConnectionArrowType | null;
  relationship_type: string | null;
  relationship_label: string | null;
  sentiment: ConnectionSentiment | null;
  weight: number | null;
  notes: string | null;
  partition_id: string;
  created_at: string;
  updated_at: string;
  // Computed attributes
  display_label?: string;
  stroke_dash_array?: string;
  confidence_level?: 'low' | 'medium' | 'high';
  visual_properties?: ConnectionVisualProperties;
  relationship_properties?: ConnectionRelationshipProperties;
}

export interface ConnectionVisualProperties {
  style: ConnectionStyle;
  pathType: ConnectionPathType;
  color: string;
  thickness: number;
  arrowType: ConnectionArrowType;
  strokeDashArray: string;
  hasSourceArrow: boolean;
  hasTargetArrow: boolean;
  fromSide: ConnectionAnchor;
  toSide: ConnectionAnchor;
  sentiment: ConnectionSentiment;
  sentimentColor: string;
}

export interface ConnectionRelationshipProperties {
  type: string | null;
  label: string | null;
  weight: number;
  confidence: 'low' | 'medium' | 'high';
  sentiment: ConnectionSentiment;
  notes: string | null;
}

export interface InvestigationConnectionCreateInput {
  from_node_id: string;
  to_node_id: string;
  from_side?: ConnectionAnchor;
  to_side?: ConnectionAnchor;
  style?: ConnectionStyle;
  path_type?: ConnectionPathType;
  color?: string;
  thickness?: number;
  arrow_type?: ConnectionArrowType;
  relationship_type?: string;
  relationship_label?: string;
  sentiment?: ConnectionSentiment;
  weight?: number;
  notes?: string;
}

export type InvestigationConnectionUpdateInput = Partial<Omit<InvestigationConnectionCreateInput, 'from_node_id' | 'to_node_id'>>;

// ============================================
// Investigation Drawing Model
// ============================================

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface InvestigationDrawing {
  record_id: string;
  investigation_id: string;
  tool: DrawingTool;
  points: DrawingPoint[];
  color: string | null;
  size: number | null;
  line_style: DrawingLineStyle | null;
  thickness: number | null;
  arrow_type: DrawingArrowType | null;
  text: string | null;
  z_index: number;
  partition_id: string;
  created_at: string;
  updated_at: string;
  // Computed attributes
  bounds?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  } | null;
  center?: {
    x: number;
    y: number;
  } | null;
  stroke_dash_array?: string;
  visual_properties?: DrawingVisualProperties;
}

export interface DrawingVisualProperties {
  tool: DrawingTool;
  color: string;
  size: number;
  lineStyle: DrawingLineStyle | null;
  thickness: number | null;
  arrowType: DrawingArrowType | null;
  strokeDashArray: string;
  text: string | null;
  zIndex: number;
}

export interface InvestigationDrawingCreateInput {
  tool: DrawingTool;
  points: DrawingPoint[];
  color?: string;
  size?: number;
  line_style?: DrawingLineStyle;
  thickness?: number;
  arrow_type?: DrawingArrowType;
  text?: string;
  z_index?: number;
}

export type InvestigationDrawingUpdateInput = Partial<Omit<InvestigationDrawingCreateInput, 'tool'>>;

export interface BatchDrawingInput {
  record_id?: string; // If present, update; otherwise create
  tool: DrawingTool;
  points: DrawingPoint[];
  color?: string;
  size?: number;
  line_style?: DrawingLineStyle;
  thickness?: number;
  arrow_type?: DrawingArrowType;
  text?: string;
  z_index?: number;
}

// ============================================
// Entity Visual Configuration
// ============================================

export interface EntityVisualConfig {
  icon: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
}

export const ENTITY_VISUAL_CONFIG: Record<LinkableEntityType, EntityVisualConfig> = {
  person: {
    icon: 'user',
    color: '#3b82f6',
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
  },
  entity: {
    icon: 'building',
    color: '#8b5cf6',
    backgroundColor: '#ede9fe',
    borderColor: '#8b5cf6',
  },
  place: {
    icon: 'map-pin',
    color: '#10b981',
    backgroundColor: '#d1fae5',
    borderColor: '#10b981',
  },
  event: {
    icon: 'calendar',
    color: '#ef4444',
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  note: {
    icon: 'file-text',
    color: '#f59e0b',
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  task: {
    icon: 'check-square',
    color: '#06b6d4',
    backgroundColor: '#cffafe',
    borderColor: '#06b6d4',
  },
  file: {
    icon: 'paperclip',
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    borderColor: '#6b7280',
  },
  hypothesis: {
    icon: 'lightbulb',
    color: '#eab308',
    backgroundColor: '#fef9c3',
    borderColor: '#eab308',
  },
  motive: {
    icon: 'target',
    color: '#f97316',
    backgroundColor: '#ffedd5',
    borderColor: '#f97316',
  },
  inventory_object: {
    icon: 'package',
    color: '#84cc16',
    backgroundColor: '#ecfccb',
    borderColor: '#84cc16',
  },
  tag: {
    icon: 'tag',
    color: '#ec4899',
    backgroundColor: '#fce7f3',
    borderColor: '#ec4899',
  },
};

// Sentiment color mapping
export const SENTIMENT_COLORS: Record<ConnectionSentiment, string> = {
  neutral: '#6b7280',
  positive: '#22c55e',
  negative: '#ef4444',
};

// ============================================
// Timeline Types
// ============================================

export interface TimelineEvent {
  node_id: string;
  entity_type: LinkableEntityType;
  entity_id: string;
  date: string;
  date_field: string;
  label: string;
  x: number;
  y: number;
}

export interface TimelineData {
  events: TimelineEvent[];
  count: number;
  date_range: {
    min: string | null;
    max: string | null;
    span_days: number;
  };
  grouped?: TimelineGroup[];
}

export interface TimelineGroup {
  period: string;
  start_date: string;
  end_date: string;
  events: TimelineEvent[];
  count: number;
}

// ============================================
// Graph Data Types
// ============================================

export interface GraphData {
  nodes: InvestigationNode[];
  connections: InvestigationConnection[];
  drawings: InvestigationDrawing[];
  canvas_state: CanvasState | null;
  bounds: CanvasBounds;
  counts: {
    nodes: number;
    connections: number;
    drawings: number;
  };
}

export interface CanvasBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

// ============================================
// Layout Types
// ============================================

export interface LayoutResult {
  positions: Record<string, { x: number; y: number }>;
  layout_type: InvestigationLayout;
  node_count: number;
}

// ============================================
// Relationship Detection Types
// ============================================

export interface ExistingRelationship {
  relationship_id: string;
  relationship_type: string;
  relationship_label: string;
  source_entity_type: string;
  source_entity_id: string;
  target_entity_type: string;
  target_entity_id: string;
  direction: 'forward' | 'reverse';
}

// ============================================
// Statistics Types
// ============================================

export interface InvestigationStatistics {
  total: number;
  total_investigations?: number;
  open_investigations?: number;
  in_progress_investigations?: number;
  on_hold_investigations?: number;
  closed_investigations?: number;
  archived_investigations?: number;
  by_status?: Record<string, number>;
  by_priority?: Record<string, number>;
  total_nodes?: number;
  total_connections?: number;
  public_investigations?: number;
  private_investigations?: number;
}

// ============================================
// Presence Types (for real-time collaboration)
// ============================================

export interface OnlineUser {
  userId: string;
  username: string;
  color: string;
}

export interface CursorPosition {
  x: number;
  y: number;
}

// ============================================
// WebSocket Event Payloads
// ============================================

export interface NodeAddedEvent {
  node: InvestigationNode;
  user: { id: string; username: string };
  timestamp: string;
}

export interface NodeMovedEvent {
  node_id: string;
  x: number;
  y: number;
  z_index: number | null;
  user: { id: string; username: string };
  timestamp: string;
}

export interface NodeUpdatedEvent {
  node: InvestigationNode;
  user: { id: string; username: string };
  timestamp: string;
}

export interface NodeRemovedEvent {
  node_id: string;
  investigation_id: string;
  user: { id: string; username: string };
  timestamp: string;
}

export interface ConnectionAddedEvent {
  connection: InvestigationConnection;
  user: { id: string; username: string };
  timestamp: string;
}

export interface ConnectionUpdatedEvent {
  connection: InvestigationConnection;
  user: { id: string; username: string };
  timestamp: string;
}

export interface ConnectionRemovedEvent {
  connection_id: string;
  investigation_id: string;
  user: { id: string; username: string };
  timestamp: string;
}

export interface DrawingAddedEvent {
  drawing: InvestigationDrawing;
  user: { id: string; username: string };
  timestamp: string;
}

export interface DrawingUpdatedEvent {
  drawing: InvestigationDrawing;
  user: { id: string; username: string };
  timestamp: string;
}

export interface DrawingRemovedEvent {
  drawing_id: string;
  investigation_id: string;
  user: { id: string; username: string };
  timestamp: string;
}

export interface UserJoinedEvent {
  user: { id: string; username: string };
  investigation_id: string;
  joined_at: string;
}

export interface UserLeftEvent {
  user: { id: string; username: string };
  investigation_id: string;
  left_at: string;
}

export interface CanvasStateUpdatedEvent {
  investigation_id: string;
  canvas_state: CanvasState;
  user: { id: string; username: string };
  timestamp: string;
}

export interface UserCursorMovedEvent {
  user: { id: string; username: string };
  x: number;
  y: number;
  timestamp: string;
}

// ============================================
// AI Feature Types
// ============================================

export type AIDetailLevel = 'brief' | 'standard' | 'comprehensive';

export interface DocumentSummary {
  summary: string;
  keyPoints: string[];
}

export interface InvestigationSummary {
  overview: string;
  totalNodes: number;
  totalConnections: number;
  mainThemes: string[];
  suggestions: string[];
}

export interface CorrelationCluster {
  theme: string;
  nodeIds: string[];
  description: string;
}

export interface CorrelationAnalysis {
  clusters: CorrelationCluster[];
  insights: string[];
  recommendations: string[];
}

export interface GeneratedNode {
  id: string;
  content: string;
  type: 'person' | 'place' | 'organization' | 'concept' | 'event' | 'idea';
  description: string;
  tags: string[];
  importance: 1 | 2 | 3;
}

export interface GeneratedConnection {
  fromId: string;
  toId: string;
  relationshipType: 'positive' | 'negative' | 'neutral';
  label?: string;
  strength: number;
}

export interface MindMapGenerationResult {
  mainTopic: {
    title: string;
    description: string;
  };
  nodes: GeneratedNode[];
  connections: GeneratedConnection[];
}

export interface ApplyMindMapResult {
  nodesCreated: number;
  nodesReused: number;
  connectionsCreated: number;
  connectionsSkipped: number;
  nodes: {
    id: string;
    entity_type: string;
    entity_id: string;
    title: string;
  }[];
  reusedNodes: {
    id: string;
    title: string;
    reused: boolean;
  }[];
  connections: {
    id: string;
    from: string;
    to: string;
  }[];
}

// ============================================
// AI Suggestion Types (Duplicates & Connections)
// ============================================

export type SuggestionType =
  | 'exact_duplicate'
  | 'semantic_duplicate'
  | 'database_connection'
  | 'ai_connection';

export interface SuggestionNodePreview {
  record_id: string;
  entity_type: LinkableEntityType;
  entity_id: string;
  display_label: string;
  x: number;
  y: number;
  visual_config?: EntityVisualConfig;
}

export interface DuplicateSuggestion {
  id: string;
  type: 'exact_duplicate' | 'semantic_duplicate';
  confidence: number;
  reason: string;
  keepNode: SuggestionNodePreview;
  duplicateNode: SuggestionNodePreview;
  connectionCount: number;
}

export interface ConnectionSuggestion {
  id: string;
  type: 'database_connection' | 'ai_connection';
  confidence: number;
  reason: string;
  fromNode: SuggestionNodePreview;
  toNode: SuggestionNodePreview;
  relationshipType: string;
  relationshipLabel: string;
}

export type Suggestion = DuplicateSuggestion | ConnectionSuggestion;

export interface SuggestionsAnalysisResult {
  suggestions: Suggestion[];
  summary: {
    exactDuplicates: number;
    semanticDuplicates: number;
    databaseConnections: number;
    aiConnections: number;
    total: number;
  };
}

export interface AcceptDuplicateResult {
  success: boolean;
  transferredConnections: number;
  deletedNodeId: string;
}

export interface AcceptConnectionResult {
  success: boolean;
  connection: InvestigationConnection;
}

export type SuggestionWizardStatus =
  | 'idle'
  | 'loading'
  | 'analyzing'
  | 'ready'
  | 'processing'
  | 'complete'
  | 'error'
  | 'empty';

export interface SuggestionWizardState {
  status: SuggestionWizardStatus;
  suggestions: Suggestion[];
  currentIndex: number;
  accepted: number;
  skipped: number;
  error?: string;
}
